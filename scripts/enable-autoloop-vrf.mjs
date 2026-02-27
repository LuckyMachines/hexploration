#!/usr/bin/env node
/**
 * Enable AutoLoop VRF mode on deployed Hexploration contracts.
 * Switches the Gameplay loop from Mock VRF to on-chain VRF verification.
 *
 * Prerequisites:
 *   - Worker's VRF public key must be registered (run register-vrf-key.mjs first)
 *   - Caller must have DEFAULT_ADMIN_ROLE on both Queue and Gameplay
 *
 * Usage:
 *   node scripts/enable-autoloop-vrf.mjs
 *   node scripts/enable-autoloop-vrf.mjs --disable   # switch back to Mock VRF
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

const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const disable = process.argv.includes('--disable');

if (!rpcUrl || !privateKey) {
  console.error('Missing RPC_URL or PRIVATE_KEY in .env');
  process.exit(1);
}

const deployments = JSON.parse(
  readFileSync(resolve(root, 'deployments.json'), 'utf8')
);
const addrs = deployments.sepolia;

const account = privateKeyToAccount(privateKey);
const transport = http(rpcUrl);
const publicClient = createPublicClient({ chain: sepolia, transport });
const walletClient = createWalletClient({ chain: sepolia, transport, account });

const setVRFAbi = [
  {
    inputs: [{ name: 'enabled', type: 'bool' }],
    name: 'setUseAutoLoopVRF',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'useAutoLoopVRF',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const registerAbi = [
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'controllerKeyRegistered',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main() {
  const enabled = !disable;
  console.log(`=== ${enabled ? 'Enable' : 'Disable'} AutoLoop VRF ===\n`);
  console.log(`Caller: ${account.address}`);

  if (enabled) {
    // Verify VRF key is registered
    const keyRegistered = await publicClient.readContract({
      address: addrs.GAMEPLAY,
      abi: registerAbi,
      functionName: 'controllerKeyRegistered',
      args: [account.address],
    });

    if (!keyRegistered) {
      console.error('\nERROR: Worker VRF key not registered. Run register-vrf-key.mjs first.');
      process.exit(1);
    }
    console.log('VRF key registered: yes');
  }

  // Set on Queue
  console.log(`\nSetting useAutoLoopVRF=${enabled} on Queue (${addrs.GAME_QUEUE})...`);
  const hash1 = await walletClient.writeContract({
    address: addrs.GAME_QUEUE,
    abi: setVRFAbi,
    functionName: 'setUseAutoLoopVRF',
    args: [enabled],
  });
  await publicClient.waitForTransactionReceipt({ hash: hash1 });
  console.log(`  Done (tx ${hash1.slice(0, 14)}...)`);

  // Set on Gameplay
  console.log(`Setting useAutoLoopVRF=${enabled} on Gameplay (${addrs.GAMEPLAY})...`);
  const hash2 = await walletClient.writeContract({
    address: addrs.GAMEPLAY,
    abi: setVRFAbi,
    functionName: 'setUseAutoLoopVRF',
    args: [enabled],
  });
  await publicClient.waitForTransactionReceipt({ hash: hash2 });
  console.log(`  Done (tx ${hash2.slice(0, 14)}...)`);

  // Verify
  const queueVRF = await publicClient.readContract({
    address: addrs.GAME_QUEUE,
    abi: setVRFAbi,
    functionName: 'useAutoLoopVRF',
  });
  const gameplayVRF = await publicClient.readContract({
    address: addrs.GAMEPLAY,
    abi: setVRFAbi,
    functionName: 'useAutoLoopVRF',
  });

  console.log(`\nStatus:`);
  console.log(`  Queue.useAutoLoopVRF = ${queueVRF}`);
  console.log(`  Gameplay.useAutoLoopVRF = ${gameplayVRF}`);

  if (enabled) {
    console.log(`\nAutoLoop VRF is now active. Start the worker with USE_AUTOLOOP_VRF=true`);
  } else {
    console.log(`\nAutoLoop VRF disabled. Worker will use Mock VRF for Queue randomness.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
