#!/usr/bin/env node
/**
 * One-time admin script — switch GameSetup and Queue to mock VRF.
 * Calls setVRFSubscriptionID(0) on both contracts.
 * Requires the deployer's private key (DEFAULT_ADMIN_ROLE).
 *
 * Usage:
 *   cp scripts/hexploration-worker.env.example scripts/.env
 *   # Fill in RPC_URL and deployer PRIVATE_KEY
 *   node scripts/enable-mock-vrf.mjs
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

if (!rpcUrl || !privateKey) {
  console.error('Missing RPC_URL or PRIVATE_KEY in environment.');
  console.error('Copy scripts/hexploration-worker.env.example → scripts/.env and fill in values.');
  process.exit(1);
}

// ── Load deployments ────────────────────────────────────────────────
const deployments = JSON.parse(
  readFileSync(resolve(root, 'deployments.json'), 'utf8')
);
const addrs = deployments.sepolia;

// ── Minimal ABIs ────────────────────────────────────────────────────
const abi = [
  { inputs: [{ name: '_subscriptionID', type: 'uint64' }], name: 'setVRFSubscriptionID', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'useMockVRF', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
];

// ── Clients ─────────────────────────────────────────────────────────
const account = privateKeyToAccount(privateKey);
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain: sepolia, transport });
const walletClient = createWalletClient({ chain: sepolia, transport, account });

// ── Main ────────────────────────────────────────────────────────────
async function enableMockVRF(label, address) {
  console.log(`\n${label} (${address}):`);

  // Check current state
  const alreadyMock = await publicClient.readContract({ address, abi, functionName: 'useMockVRF' });
  if (alreadyMock) {
    console.log('  Already using mock VRF — skipping.');
    return;
  }

  console.log('  Sending setVRFSubscriptionID(0)...');
  const hash = await walletClient.writeContract({
    address,
    abi,
    functionName: 'setVRFSubscriptionID',
    args: [0n],
  });
  console.log(`  Tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  Confirmed in block ${Number(receipt.blockNumber)} (status: ${receipt.status})`);

  // Verify
  const nowMock = await publicClient.readContract({ address, abi, functionName: 'useMockVRF' });
  console.log(`  useMockVRF = ${nowMock}`);
}

async function main() {
  console.log('=== Enable Mock VRF on Hexploration Contracts (Sepolia) ===');
  console.log(`Admin: ${account.address}`);

  await enableMockVRF('GAME_SETUP', addrs.GAME_SETUP);
  await enableMockVRF('GAME_QUEUE', addrs.GAME_QUEUE);

  console.log('\n=== Done — run check-hex-status.mjs to verify ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
