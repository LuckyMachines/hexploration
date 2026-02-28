#!/usr/bin/env node
/**
 * Hexploration automation worker.
 * Polls contracts for pending mock VRF requests and game loop readiness,
 * then fulfills/progresses them automatically.
 *
 * Supports two randomness modes for the Gameplay loop:
 *   - Mock VRF (default): separate fulfillment transactions
 *   - AutoLoop VRF: ECVRF proof generated off-chain, verified on-chain in progressLoop
 *
 * GameSetup always uses Mock VRF (one-time cold path, not worth VRF overhead).
 *
 * Usage:
 *   cp scripts/hexploration-worker.env.example scripts/.env
 *   node scripts/hexploration-worker.mjs
 */
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });
const root = resolve(__dirname, '..');

// ── Config ──────────────────────────────────────────────────────────
const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const POLL_MS = Number(process.env.POLL_INTERVAL_MS) || 5000;
const VERBOSE = process.env.VERBOSE === 'true';
const USE_AUTOLOOP_VRF = process.env.USE_AUTOLOOP_VRF === 'true';

if (!rpcUrl || !privateKey) {
  console.error('Missing RPC_URL or PRIVATE_KEY. Copy hexploration-worker.env.example → .env');
  process.exit(1);
}

// ── Chain selection ──────────────────────────────────────────────────
const CHAIN_NAME = process.env.CHAIN || 'sepolia';
const chain = CHAIN_NAME === 'foundry' ? foundry : sepolia;

// ── Load deployments ────────────────────────────────────────────────
const addrs = process.env.DEPLOYMENTS_JSON
  ? JSON.parse(process.env.DEPLOYMENTS_JSON)
  : JSON.parse(readFileSync(resolve(root, 'deployments.json'), 'utf8'))[CHAIN_NAME === 'foundry' ? 'sepolia' : CHAIN_NAME];
// When using DEPLOYMENTS_JSON env var, addresses are passed directly (no network key).
// When reading from file, fall back to the sepolia key (foundry reuses sepolia layout).

// ── ABIs (minimal — only the functions we call) ─────────────────────
const vrfAbi = [
  { inputs: [], name: 'getMockRequests', outputs: [{ type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'fulfillMockRandomness', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'useMockVRF', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
];

const loopAbi = [
  { inputs: [], name: 'shouldProgressLoop', outputs: [{ name: 'loopIsReady', type: 'bool' }, { name: 'progressWithData', type: 'bytes' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'progressWithData', type: 'bytes' }], name: 'progressLoop', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: '_loopID', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

// ── Clients ─────────────────────────────────────────────────────────
const account = privateKeyToAccount(privateKey);
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain, transport });
const walletClient = createWalletClient({ chain, transport, account });

// ── ECVRF (lazy-loaded only in VRF mode) ────────────────────────────
let ecvrfProver = null;
async function getProver() {
  if (!ecvrfProver) {
    ecvrfProver = await import('./ecvrf-prover.mjs');
  }
  return ecvrfProver;
}

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

// ── Retry with exponential backoff ──────────────────────────────────
async function withRetry(fn, label, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      log(`${label}: attempt ${attempt}/${maxAttempts} failed — retrying in ${delayMs}ms (${err.shortMessage || err.message})`);
      await sleep(delayMs);
    }
  }
}

// ── Health-check state ──────────────────────────────────────────────
let lastPollAt = null;
const actions = { vrfFulfilled: 0, loopsProgressed: 0 };

// ── VRF Fulfillment (Mock VRF path) ─────────────────────────────────
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
    const receipt = await withRetry(async () => {
      const hash = await walletClient.writeContract({
        address,
        abi: vrfAbi,
        functionName: 'fulfillMockRandomness',
      });
      return publicClient.waitForTransactionReceipt({ hash });
    }, label);
    log(`${label}: VRF fulfilled (block ${Number(receipt.blockNumber)})`);
    actions.vrfFulfilled++;
    return true;
  } catch (err) {
    log(`${label}: VRF error — ${err.shortMessage || err.message}`);
    return false;
  }
}

// ── Loop Progression (standard — no VRF) ────────────────────────────
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
    const receipt = await withRetry(async () => {
      const hash = await walletClient.writeContract({
        address,
        abi: loopAbi,
        functionName: 'progressLoop',
        args: [progressWithData],
      });
      return publicClient.waitForTransactionReceipt({ hash });
    }, label);
    log(`${label}: loop progressed (block ${Number(receipt.blockNumber)})`);
    actions.loopsProgressed++;
    return true;
  } catch (err) {
    log(`${label}: loop error — ${err.shortMessage || err.message}`);
    return false;
  }
}

// ── Loop Progression with VRF (AutoLoop VRF path) ───────────────────
async function progressWithVRF(label, address) {
  try {
    const [loopIsReady, progressWithData] = await publicClient.readContract({
      address,
      abi: loopAbi,
      functionName: 'shouldProgressLoop',
    });

    if (!loopIsReady) {
      verbose(`${label}: loop not ready (VRF mode)`);
      return false;
    }

    // Read the current loopID from the contract
    const loopID = await publicClient.readContract({
      address,
      abi: loopAbi,
      functionName: '_loopID',
    });

    log(`${label}: loop ready (VRF mode, loopID=${loopID}) — generating proof...`);

    const prover = await getProver();

    // Compute deterministic seed: keccak256(address, loopID)
    const seed = prover.computeSeed(address, loopID);

    // Generate ECVRF proof
    const proof = prover.prove(privateKey, seed);

    // Compute fast-verify parameters for on-chain verification
    const params = prover.computeFastVerifyParams(proof.publicKey, proof, seed);

    // Wrap in VRF envelope
    const vrfEnvelope = prover.encodeVRFEnvelope(proof, params, progressWithData);

    verbose(`${label}: VRF proof generated, envelope size=${vrfEnvelope.length} chars`);

    // Call progressLoop with VRF-wrapped data
    const receipt = await withRetry(async () => {
      const hash = await walletClient.writeContract({
        address,
        abi: loopAbi,
        functionName: 'progressLoop',
        args: [vrfEnvelope],
      });
      return publicClient.waitForTransactionReceipt({ hash });
    }, label);
    log(`${label}: loop progressed with VRF (block ${Number(receipt.blockNumber)})`);
    actions.loopsProgressed++;
    return true;
  } catch (err) {
    log(`${label}: VRF loop error — ${err.shortMessage || err.message}`);
    return false;
  }
}

// ── Preflight Check ─────────────────────────────────────────────────
async function preflight() {
  log('Checking VRF status...');
  log(`  Mode: ${USE_AUTOLOOP_VRF ? 'AutoLoop VRF (Gameplay)' : 'Mock VRF (all contracts)'}`);

  // GameSetup always uses Mock VRF
  for (const [label, addr] of [['GAME_SETUP', addrs.GAME_SETUP], ['GAME_QUEUE', addrs.GAME_QUEUE]]) {
    try {
      const mock = await publicClient.readContract({ address: addr, abi: vrfAbi, functionName: 'useMockVRF' });
      log(`  ${label} (${fmtAddr(addr)}): useMockVRF = ${mock}`);
      if (!mock && !USE_AUTOLOOP_VRF) {
        log(`  WARNING: ${label} is NOT using mock VRF. Run enable-mock-vrf.mjs first.`);
      }
    } catch (err) {
      log(`  ${label}: check failed — ${err.shortMessage || err.message}`);
    }
  }

  if (USE_AUTOLOOP_VRF) {
    log(`  Gameplay (${fmtAddr(addrs.GAMEPLAY)}): AutoLoop VRF enabled`);
    log(`  Worker public key will be used for VRF proofs`);

    // Verify the prover module loads correctly
    try {
      const prover = await getProver();
      const pk = prover.derivePublicKey(privateKey);
      log(`  VRF public key: x=${pk.x.slice(0, 14)}... y=${pk.y.slice(0, 14)}...`);
    } catch (err) {
      log(`  WARNING: Failed to load ECVRF prover — ${err.message}`);
      log(`  Install @noble/curves: npm install @noble/curves`);
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
  log(`AutoLoop VRF: ${USE_AUTOLOOP_VRF}`);
  console.log();

  await preflight();
  console.log();
  log('Entering main loop — press Ctrl+C to stop\n');

  while (running) {
    lastPollAt = new Date().toISOString();
    let actionTaken = false;

    // 1. Fulfill mock VRF on GameSetup (always — GameSetup stays on Mock VRF)
    if (await fulfillVRF('GameSetup', addrs.GAME_SETUP)) actionTaken = true;

    // 2. Fulfill mock VRF on Queue (only when NOT using AutoLoop VRF)
    if (!USE_AUTOLOOP_VRF) {
      if (await fulfillVRF('Queue', addrs.GAME_QUEUE)) actionTaken = true;
    }

    // 3. Progress Controller loop (always standard — no VRF)
    if (await progressIfReady('Controller', addrs.HEXPLORATION_CONTROLLER)) actionTaken = true;

    // 4. Progress Gameplay loop (VRF or standard depending on config)
    if (USE_AUTOLOOP_VRF) {
      if (await progressWithVRF('Gameplay', addrs.GAMEPLAY)) actionTaken = true;
    } else {
      if (await progressIfReady('Gameplay', addrs.GAMEPLAY)) actionTaken = true;
    }

    // Fast loop if any action was taken (catch cascading state changes)
    const waitMs = actionTaken ? 1000 : POLL_MS;
    verbose(`Sleeping ${waitMs}ms (actionTaken=${actionTaken})`);
    await sleep(waitMs);
  }

  log('=== Worker Stopped ===');
}

// ── Health Check HTTP Server ─────────────────────────────────────────
const HEALTH_PORT = Number(process.env.HEALTH_PORT) || 9966;
const startTime = Date.now();

const healthServer = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    const body = JSON.stringify({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      lastPollAt,
      actions,
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(HEALTH_PORT, () => {
  log(`Health server listening on port ${HEALTH_PORT}`);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
