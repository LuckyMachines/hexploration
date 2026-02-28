#!/usr/bin/env node
/**
 * Auto-register Anvil account #1 into the first open game on local Anvil.
 * Lets a developer quickly test 2-player gameplay without MetaMask setup.
 *
 * Usage: node scripts/join-local-game.mjs
 */
import { createPublicClient, createWalletClient, http } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Load addresses from app/.env.local ─────────────────────────────
dotenv.config({ path: resolve(root, 'app', '.env.local') });

const controllerAddr = process.env.VITE_CONTROLLER_ADDRESS;
const registryAddr = process.env.VITE_GAME_REGISTRY_ADDRESS;
const boardAddr = process.env.VITE_BOARD_ADDRESS;
const summaryAddr = process.env.VITE_GAME_SUMMARY_ADDRESS;

if (!controllerAddr || !registryAddr || !boardAddr || !summaryAddr) {
  console.error('Missing required addresses in app/.env.local');
  process.exit(1);
}

// ── ABIs ────────────────────────────────────────────────────────────
const gameSummaryAbi = JSON.parse(
  readFileSync(resolve(root, 'abi', 'GameSummary.json'), 'utf8'),
);
const controllerAbi = JSON.parse(
  readFileSync(resolve(root, 'abi', 'HexplorationController.json'), 'utf8'),
);

// ── Anvil account #1 ───────────────────────────────────────────────
const ANVIL_PK_1 = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const account = privateKeyToAccount(ANVIL_PK_1);

const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:9955';
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain: foundry, transport });
const walletClient = createWalletClient({ chain: foundry, transport, account });

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log(`Account:  ${account.address}`);
  console.log(`RPC:      ${rpcUrl}\n`);

  const [gameIDs, maxPlayers, currentRegs] = await publicClient.readContract({
    address: summaryAddr,
    abi: gameSummaryAbi,
    functionName: 'getAvailableGames',
    args: [boardAddr, registryAddr],
  });

  const idx = gameIDs.findIndex(
    (_, i) => currentRegs[i] < maxPlayers[i],
  );

  if (idx === -1) {
    console.error('No open games found. Create one first (npm run local).');
    process.exit(1);
  }

  const gameId = gameIDs[idx];
  console.log(`Joining game ${gameId} (${currentRegs[idx]}/${maxPlayers[idx]} players)...`);

  const hash = await walletClient.writeContract({
    address: controllerAddr,
    abi: controllerAbi,
    functionName: 'registerForGame',
    args: [gameId, boardAddr],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Registered in block ${Number(receipt.blockNumber)} (tx: ${hash})`);
  console.log(`\nPlayer ${account.address} joined game ${gameId}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
