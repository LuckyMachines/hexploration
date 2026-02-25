#!/usr/bin/env node
/**
 * Hexploration automation worker.
 * Polls contracts for pending mock VRF requests and game loop readiness,
 * then fulfills/progresses them automatically.
 *
 * Usage:
 *   cp scripts/hexploration-worker.env.example scripts/.env
 *   node scripts/hexploration-worker.mjs
 */
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });
const root = resolve(__dirname, '..');

// ── Config ──────────────────────────────────────────────────────────
const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const POLL_MS = Number(process.env.POLL_INTERVAL_MS) || 5000;
const VERBOSE = process.env.VERBOSE === 'true';

if (!rpcUrl || !privateKey) {
  console.error('Missing RPC_URL or PRIVATE_KEY. Copy hexploration-worker.env.example → .env');
  process.exit(1);
}

// ── Load deployments ────────────────────────────────────────────────
const deployments = JSON.parse(
  readFileSync(resolve(root, 'deployments.json'), 'utf8')
);
const addrs = deployments.sepolia;

// ── ABIs (minimal — only the functions we call) ─────────────────────
const vrfAbi = [
  { inputs: [], name: 'getMockRequests', outputs: [{ type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'fulfillMockRandomness', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'useMockVRF', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
];

const loopAbi = [
  { inputs: [], name: 'shouldProgressLoop', outputs: [{ name: 'loopIsReady', type: 'bool' }, { name: 'progressWithData', type: 'bytes' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'progressWithData', type: 'bytes' }], name: 'progressLoop', outputs: [], stateMutability: 'nonpayable', type: 'function' },
];

// ── Clients ─────────────────────────────────────────────────────────
const account = privateKeyToAccount(privateKey);
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain: sepolia, transport });
const walletClient = createWalletClient({ chain: sepolia, transport, account });

// ── Helpers ─────────────────────────────────────────────────────────
function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function verbose(...args) {
  if (VERBOSE) log('[VERBOSE]', ...args);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fmtAddr(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── VRF Fulfillment ─────────────────────────────────────────────────
async function fulfillVRF(label, address) {
  try {
    const mockReqs = await publicClient.readContract({
      address,
      abi: vrfAbi,
      functionName: 'getMockRequests',
    });

    const pending = mockReqs.filter((r) => r > 0n);
    if (pending.length === 0) {
      verbose(`${label}: no pending VRF requests`);
      return false;
    }

    log(`${label}: ${pending.length} pending VRF request(s) — fulfilling...`);
    const hash = await walletClient.writeContract({
      address,
      abi: vrfAbi,
      functionName: 'fulfillMockRandomness',
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    log(`${label}: VRF fulfilled (block ${Number(receipt.blockNumber)}, tx ${hash.slice(0, 14)}...)`);
    return true;
  } catch (err) {
    log(`${label}: VRF error — ${err.shortMessage || err.message}`);
    return false;
  }
}

// ── Loop Progression ────────────────────────────────────────────────
async function progressIfReady(label, address) {
  try {
    const [loopIsReady, progressWithData] = await publicClient.readContract({
      address,
      abi: loopAbi,
      functionName: 'shouldProgressLoop',
    });

    if (!loopIsReady) {
      verbose(`${label}: loop not ready`);
      return false;
    }

    log(`${label}: loop ready — progressing...`);
    const hash = await walletClient.writeContract({
      address,
      abi: loopAbi,
      functionName: 'progressLoop',
      args: [progressWithData],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    log(`${label}: loop progressed (block ${Number(receipt.blockNumber)}, tx ${hash.slice(0, 14)}...)`);
    return true;
  } catch (err) {
    log(`${label}: loop error — ${err.shortMessage || err.message}`);
    return false;
  }
}

// ── Preflight Check ─────────────────────────────────────────────────
async function preflight() {
  log('Checking mock VRF status...');
  for (const [label, addr] of [['GAME_SETUP', addrs.GAME_SETUP], ['GAME_QUEUE', addrs.GAME_QUEUE]]) {
    try {
      const mock = await publicClient.readContract({ address: addr, abi: vrfAbi, functionName: 'useMockVRF' });
      log(`  ${label} (${fmtAddr(addr)}): useMockVRF = ${mock}`);
      if (!mock) {
        log(`  WARNING: ${label} is NOT using mock VRF. Run enable-mock-vrf.mjs first.`);
      }
    } catch (err) {
      log(`  ${label}: check failed — ${err.shortMessage || err.message}`);
    }
  }
}

// ── Main Loop ───────────────────────────────────────────────────────
let running = true;

process.on('SIGINT', () => {
  log('Shutting down...');
  running = false;
});
process.on('SIGTERM', () => {
  log('Shutting down...');
  running = false;
});

async function main() {
  log('=== Hexploration Worker Starting ===');
  log(`Worker wallet: ${account.address}`);
  log(`Poll interval: ${POLL_MS}ms`);
  log(`Verbose: ${VERBOSE}`);
  console.log();

  await preflight();
  console.log();
  log('Entering main loop — press Ctrl+C to stop\n');

  while (running) {
    let actionTaken = false;

    // 1. Fulfill mock VRF on GameSetup
    if (await fulfillVRF('GameSetup', addrs.GAME_SETUP)) actionTaken = true;

    // 2. Fulfill mock VRF on Queue
    if (await fulfillVRF('Queue', addrs.GAME_QUEUE)) actionTaken = true;

    // 3. Progress GameSetup loop
    if (await progressIfReady('GameSetup', addrs.GAME_SETUP)) actionTaken = true;

    // 4. Progress Controller loop
    if (await progressIfReady('Controller', addrs.HEXPLORATION_CONTROLLER)) actionTaken = true;

    // 5. Progress Gameplay loop
    if (await progressIfReady('Gameplay', addrs.GAMEPLAY)) actionTaken = true;

    // Fast loop if any action was taken (catch cascading state changes)
    const waitMs = actionTaken ? 1000 : POLL_MS;
    verbose(`Sleeping ${waitMs}ms (actionTaken=${actionTaken})`);
    await sleep(waitMs);
  }

  log('=== Worker Stopped ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
