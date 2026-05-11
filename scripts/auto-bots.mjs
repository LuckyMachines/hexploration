#!/usr/bin/env node
/**
 * Auto-bot daemon. For every active survey on the local Anvil node, find
 * any registered bot whose turn it is, and submit `Action.IDLE` so the
 * round can resolve and the game advances.
 *
 * Idle is the simplest valid action with no preconditions. It lets a human
 * test the round-trip of multi-player flow without authoring real bot AI.
 *
 * Run alongside `xenovoya-worker` (which handles VRF + loop progression).
 *
 *   node scripts/auto-bots.mjs
 *   POLL_INTERVAL_MS=1500 node scripts/auto-bots.mjs
 *
 * Reads addresses from app/.env.local. Stops gracefully on SIGINT/SIGTERM.
 */
import { createPublicClient, createWalletClient, http } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ANVIL_KEYS } from './anvil-keys.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
dotenv.config({ path: resolve(root, 'app', '.env.local') });

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:9955';
const POLL_MS = Number(process.env.POLL_INTERVAL_MS) || 2000;

const controllerAddr = process.env.VITE_CONTROLLER_ADDRESS;
const queueAddr      = process.env.VITE_GAME_QUEUE_ADDRESS;
const boardAddr      = process.env.VITE_BOARD_ADDRESS;

if (!controllerAddr || !queueAddr || !boardAddr) {
  console.error('[auto-bots] Missing addresses in app/.env.local — run `npm run local` first.');
  process.exit(1);
}

// ── ABIs ────────────────────────────────────────────────────────────
const controllerAbi = JSON.parse(readFileSync(resolve(root, 'abi', 'XenovoyaController.json'), 'utf8'));
const queueAbi      = JSON.parse(readFileSync(resolve(root, 'abi', 'XenovoyaQueue.json'),     'utf8'));

const ACTION_IDLE = 0;
// XenovoyaQueue.ProcessingPhase enum:
//   0 START, 1 SUBMISSION, 2 PROCESSING, 3 PLAY_THROUGH, 4 PROCESSED, 5 CLOSED, 6 FAILED
const PHASE_SUBMISSION = 1;

const transport    = http(RPC_URL);
const publicClient = createPublicClient({ chain: foundry, transport });

// Identity map: lowercase address → wallet client. Built lazily.
const wallets = new Map();
for (const pk of ANVIL_KEYS) {
  const account = privateKeyToAccount(pk);
  wallets.set(
    account.address.toLowerCase(),
    createWalletClient({ chain: foundry, account, transport }),
  );
}

function log(msg) {
  console.log(`[auto-bots] ${msg}`);
}

async function getActiveGameIds() {
  try {
    return await publicClient.readContract({
      address: controllerAddr,
      abi: controllerAbi,
      functionName: 'getActiveGames',
    });
  } catch {
    return [];
  }
}

async function getPhase(gameId) {
  try {
    return Number(
      await publicClient.readContract({
        address: queueAddr,
        abi: queueAbi,
        functionName: 'currentPhase',
        args: [gameId],
      }),
    );
  } catch {
    return -1;
  }
}

async function getPlayers(gameId) {
  try {
    return await publicClient.readContract({
      address: queueAddr,
      abi: queueAbi,
      functionName: 'getAllPlayers',
      args: [gameId],
    });
  } catch {
    return [];
  }
}

async function hasSubmitted(gameId, playerIdx) {
  try {
    return Boolean(
      await publicClient.readContract({
        address: queueAddr,
        abi: queueAbi,
        functionName: 'playerSubmitted',
        args: [gameId, BigInt(playerIdx)],
      }),
    );
  } catch {
    return true; // safer to skip than to spam
  }
}

async function submitIdle(gameId, playerIdx, walletClient) {
  return walletClient.writeContract({
    address: controllerAddr,
    abi: controllerAbi,
    functionName: 'submitAction',
    args: [BigInt(playerIdx), ACTION_IDLE, [], '', '', gameId, boardAddr],
  });
}

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  log(`Received ${signal}, shutting down...`);
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

async function tick() {
  const games = await getActiveGameIds();
  for (const gameId of games) {
    const phase = await getPhase(gameId);
    if (phase !== PHASE_SUBMISSION) continue;

    const players = await getPlayers(gameId);
    for (let i = 0; i < players.length; i++) {
      const addr = players[i].toLowerCase();
      const wallet = wallets.get(addr);
      if (!wallet) continue; // Not a bot we control (human player)
      if (await hasSubmitted(gameId, i)) continue;

      try {
        const hash = await submitIdle(gameId, i, wallet);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        log(
          `survey #${gameId} · slot ${i} (${addr.slice(0, 10)}…) submitted IDLE — block ${Number(receipt.blockNumber)}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Phase often advances between read and write under poll contention;
        // those reverts are noise. Anything else is worth surfacing.
        if (/wrong phase|already submitted|not your turn/i.test(msg)) continue;
        log(`survey #${gameId} · slot ${i} submit failed: ${msg.split('\n')[0]}`);
      }
    }
  }
}

async function main() {
  log(`watching ${RPC_URL} every ${POLL_MS}ms`);
  while (!stopping) {
    try {
      await tick();
    } catch (err) {
      log(`tick error: ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  log('stopped.');
}

main().catch((err) => {
  console.error('[auto-bots] fatal:', err);
  process.exit(1);
});
