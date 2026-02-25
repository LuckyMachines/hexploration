#!/usr/bin/env node
/**
 * Read-only diagnostic — check Hexploration contract state on Sepolia.
 * No private key needed.
 *
 * Usage: node scripts/check-hex-status.mjs
 */
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });
const root = resolve(__dirname, '..');

// ── Load deployments ────────────────────────────────────────────────
const deployments = JSON.parse(
  readFileSync(resolve(root, 'deployments.json'), 'utf8')
);
const addrs = deployments.sepolia;

// ── Minimal ABIs (only the view functions we need) ──────────────────
const vrfAbi = [
  { inputs: [], name: 'useMockVRF', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'useChainlinkVRF', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getMockRequests', outputs: [{ type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
];

const loopAbi = [
  { inputs: [], name: 'shouldProgressLoop', outputs: [{ name: 'loopIsReady', type: 'bool' }, { name: 'progressWithData', type: 'bytes' }], stateMutability: 'view', type: 'function' },
];

const controllerAbi = [
  ...loopAbi,
  { inputs: [], name: 'getActiveGames', outputs: [{ name: 'games', type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
];

// ── Client ──────────────────────────────────────────────────────────
const rpcUrl = process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

// ── Helpers ─────────────────────────────────────────────────────────
async function safeRead(address, abi, functionName) {
  try {
    return await client.readContract({ address, abi, functionName });
  } catch (err) {
    return `ERROR: ${err.shortMessage || err.message}`;
  }
}

function fmtAddr(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Hexploration Contract Status (Sepolia) ===\n');

  // VRF status on GameSetup & Queue
  for (const [label, addr] of [['GAME_SETUP', addrs.GAME_SETUP], ['GAME_QUEUE', addrs.GAME_QUEUE]]) {
    console.log(`${label} (${fmtAddr(addr)}):`);
    const mockVRF = await safeRead(addr, vrfAbi, 'useMockVRF');
    const chainlinkVRF = await safeRead(addr, vrfAbi, 'useChainlinkVRF');
    const mockReqs = await safeRead(addr, vrfAbi, 'getMockRequests');
    console.log(`  useMockVRF      = ${mockVRF}`);
    console.log(`  useChainlinkVRF = ${chainlinkVRF}`);
    if (Array.isArray(mockReqs)) {
      console.log(`  mockRequests    = [${mockReqs.length}] ${mockReqs.map(String).join(', ') || '(none)'}`);
    } else {
      console.log(`  mockRequests    = ${mockReqs}`);
    }
    console.log();
  }

  // shouldProgressLoop on GameSetup, Controller, Gameplay
  for (const [label, addr] of [
    ['GAME_SETUP', addrs.GAME_SETUP],
    ['HEXPLORATION_CONTROLLER', addrs.HEXPLORATION_CONTROLLER],
    ['GAMEPLAY', addrs.GAMEPLAY],
  ]) {
    const abi = label === 'HEXPLORATION_CONTROLLER' ? controllerAbi : loopAbi;
    console.log(`${label} (${fmtAddr(addr)}):`);
    const loop = await safeRead(addr, abi, 'shouldProgressLoop');
    if (Array.isArray(loop)) {
      console.log(`  shouldProgressLoop = ready: ${loop[0]}, data: ${loop[1] === '0x' ? '(empty)' : loop[1].slice(0, 20) + '...'}`);
    } else {
      console.log(`  shouldProgressLoop = ${loop}`);
    }

    if (label === 'HEXPLORATION_CONTROLLER') {
      const games = await safeRead(addr, controllerAbi, 'getActiveGames');
      if (Array.isArray(games)) {
        console.log(`  activeGames        = [${games.length}] ${games.map(String).join(', ') || '(none)'}`);
      } else {
        console.log(`  activeGames        = ${games}`);
      }
    }
    console.log();
  }

  console.log('=== Done ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
