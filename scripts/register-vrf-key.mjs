#!/usr/bin/env node
/**
 * Register the worker's VRF public key on the Gameplay contract.
 * Must be run once before AutoLoop VRF mode can be used.
 *
 * Usage:
 *   node scripts/register-vrf-key.mjs
 */
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { derivePublicKey } from './ecvrf-prover.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });
const root = resolve(__dirname, '..');

const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;

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

const registerAbi = [
  {
    inputs: [
      { name: 'controller', type: 'address' },
      { name: 'pkX', type: 'uint256' },
      { name: 'pkY', type: 'uint256' },
    ],
    name: 'registerControllerKey',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'controllerKeyRegistered',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main() {
  console.log('=== Register VRF Key ===\n');
  console.log(`Worker address: ${account.address}`);
  console.log(`Gameplay contract: ${addrs.GAMEPLAY}`);

  // Derive public key from private key
  const pk = derivePublicKey(privateKey);
  console.log(`\nPublic key:`);
  console.log(`  x: ${pk.x}`);
  console.log(`  y: ${pk.y}`);

  // Check if already registered
  const alreadyRegistered = await publicClient.readContract({
    address: addrs.GAMEPLAY,
    abi: registerAbi,
    functionName: 'controllerKeyRegistered',
    args: [account.address],
  });

  if (alreadyRegistered) {
    console.log('\nKey already registered for this controller. Done.');
    return;
  }

  // Register
  console.log('\nRegistering key...');
  const hash = await walletClient.writeContract({
    address: addrs.GAMEPLAY,
    abi: registerAbi,
    functionName: 'registerControllerKey',
    args: [account.address, BigInt(pk.x), BigInt(pk.y)],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Key registered (block ${Number(receipt.blockNumber)}, tx ${hash})`);
  console.log('\nDone. AutoLoop VRF is ready for this worker.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
