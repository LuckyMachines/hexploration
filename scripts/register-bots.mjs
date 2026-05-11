#!/usr/bin/env node
/**
 * Register N bot players into the first open game on a local Anvil node.
 * Bots use anvil dev accounts 1..N (account 0 is the deployer / human).
 *
 * Usage:
 *   node scripts/register-bots.mjs              # 1 bot into first open game
 *   node scripts/register-bots.mjs --count=3    # 3 bots
 *   node scripts/register-bots.mjs --game=4     # specific game id
 *
 * Reads contract addresses from app/.env.local (written by run-local-stack).
 * Exits 0 if the requested number of bots are enrolled (or already were).
 */
import { createPublicClient, createWalletClient, http } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { botKeys } from './anvil-keys.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

dotenv.config({ path: resolve(root, 'app', '.env.local') });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:9955';
const controllerAddr = process.env.VITE_CONTROLLER_ADDRESS;
const registryAddr   = process.env.VITE_GAME_REGISTRY_ADDRESS;
const boardAddr      = process.env.VITE_BOARD_ADDRESS;
const summaryAddr    = process.env.VITE_GAME_SUMMARY_ADDRESS;

if (!controllerAddr || !registryAddr || !boardAddr || !summaryAddr) {
  console.error('Missing required addresses in app/.env.local — run `npm run local` first.');
  process.exit(1);
}

const args = process.argv.slice(2);
function arg(name, def) {
  const f = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!f) return def;
  const eq = f.indexOf('=');
  return eq >= 0 ? f.slice(eq + 1) : true;
}
const count   = Number(arg('count', 1));
const gameArg = arg('game', null);

const gameSummaryAbi = JSON.parse(readFileSync(resolve(root, 'abi', 'GameSummary.json'), 'utf8'));
const controllerAbi  = JSON.parse(readFileSync(resolve(root, 'abi', 'XenovoyaController.json'), 'utf8'));

const transport    = http(RPC_URL);
const publicClient = createPublicClient({ chain: foundry, transport });

async function pickOpenGame() {
  const [gameIDs, maxPlayers, currentRegs] = await publicClient.readContract({
    address: summaryAddr,
    abi: gameSummaryAbi,
    functionName: 'getAvailableGames',
    args: [boardAddr, registryAddr],
  });
  if (gameIDs.length === 0) throw new Error('No games found. Run `npm run local:solo` or `npm run local:multi` first.');
  const idx = gameIDs.findIndex((_, i) => currentRegs[i] < maxPlayers[i]);
  if (idx === -1) throw new Error('All games are full.');
  return { id: gameIDs[idx], current: currentRegs[idx], max: maxPlayers[idx] };
}

async function fetchGameState(gameId) {
  // Re-read getAvailableGames to find this id's current count.
  const [gameIDs, maxPlayers, currentRegs] = await publicClient.readContract({
    address: summaryAddr,
    abi: gameSummaryAbi,
    functionName: 'getAvailableGames',
    args: [boardAddr, registryAddr],
  });
  const idx = gameIDs.findIndex((g) => g === gameId);
  if (idx === -1) return null;
  return { id: gameIDs[idx], current: currentRegs[idx], max: maxPlayers[idx] };
}

async function main() {
  let { id: gameId, current, max } = gameArg
    ? await fetchGameState(BigInt(gameArg)).then((g) => {
        if (!g) throw new Error(`Game ${gameArg} not found in registry.`);
        return g;
      })
    : await pickOpenGame();

  console.log(`[register-bots] Target survey #${gameId} — ${current}/${max} enrolled`);

  const slotsLeft = Number(max) - Number(current);
  const need = Math.min(count, slotsLeft);
  if (need <= 0) {
    console.log('[register-bots] Survey already full — nothing to do.');
    return;
  }
  if (need < count) {
    console.warn(`[register-bots] Only ${need} open slot(s); requested ${count}.`);
  }

  const keys = botKeys(need);
  for (let i = 0; i < keys.length; i++) {
    const account = privateKeyToAccount(keys[i]);
    const wallet  = createWalletClient({ chain: foundry, account, transport });
    try {
      const hash = await wallet.writeContract({
        address: controllerAddr,
        abi: controllerAbi,
        functionName: 'registerForGame',
        args: [gameId, boardAddr],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(
        `[register-bots] bot #${i + 1} (${account.address.slice(0, 10)}…) joined — block ${Number(receipt.blockNumber)}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Already registered is fine for idempotency.
      if (/already registered|AlreadyRegistered/i.test(msg)) {
        console.log(`[register-bots] bot #${i + 1} already enrolled — skipping`);
        continue;
      }
      console.error(`[register-bots] bot #${i + 1} failed:`, msg);
      throw err;
    }
  }

  const after = await fetchGameState(gameId);
  console.log(`[register-bots] Done — survey #${gameId} now ${after?.current ?? '?'}/${after?.max ?? '?'} enrolled`);
}

main().catch((err) => {
  console.error('[register-bots] fatal:', err);
  process.exit(1);
});
