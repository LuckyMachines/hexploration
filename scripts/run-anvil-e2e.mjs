#!/usr/bin/env node
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import {
  createPublicClient,
  createWalletClient,
  http,
} from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const appDir = path.resolve(repoRoot, 'app');
const broadcastLatest = path.resolve(
  repoRoot,
  'broadcast',
  'DeployHexploration.s.sol',
  '31337',
  'run-latest.json',
);
const appEnvFile = path.resolve(appDir, '.env.e2e-anvil');

const ANVIL_PK =
  process.env.ANVIL_PRIVATE_KEY
  || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const controllerAbi = [
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'requestNewGame',
    inputs: [
      { name: 'gameRegistryAddress', type: 'address' },
      { name: 'boardAddress', type: 'address' },
      { name: 'totalPlayers', type: 'uint256' },
    ],
    outputs: [],
  },
];

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...(options.env || {}) },
      shell: options.shell ?? true,
      stdio: options.stdio ?? 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findFreePort(start, end = start + 400) {
  for (let port = start; port <= end; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No free port found in range ${start}-${end}`);
}

async function waitForRpc(rpcUrl, timeoutMs = 25_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
      });
      if (response.ok) return;
    } catch {
      // Retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for RPC at ${rpcUrl}`);
}

async function readDeploymentAddresses() {
  const raw = await fs.readFile(broadcastLatest, 'utf8');
  const json = JSON.parse(raw);
  const byName = {};
  for (const tx of json.transactions || []) {
    if (!tx.contractName || !tx.contractAddress) continue;
    byName[tx.contractName] = tx.contractAddress;
  }

  const required = {
    VITE_BOARD_ADDRESS: byName.HexplorationBoard,
    VITE_CONTROLLER_ADDRESS: byName.HexplorationController,
    VITE_GAME_SUMMARY_ADDRESS: byName.GameSummary,
    VITE_PLAYER_SUMMARY_ADDRESS: byName.PlayerSummary,
    VITE_GAME_EVENTS_ADDRESS: byName.GameEvents,
    VITE_GAME_REGISTRY_ADDRESS: byName.GameRegistry,
    VITE_GAME_QUEUE_ADDRESS: byName.HexplorationQueue,
    VITE_GAME_SETUP_ADDRESS: byName.GameSetup,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing deployed addresses in run-latest.json: ${missing.join(', ')}`);
  }
  return required;
}

async function writeAppEnv(addresses, rpcUrl) {
  const lines = [
    ...Object.entries(addresses).map(([k, v]) => `${k}=${v}`),
    'VITE_WALLETCONNECT_PROJECT_ID=',
    'VITE_RPC_URL=',
    `VITE_FOUNDRY_RPC_URL=${rpcUrl}`,
  ];
  await fs.writeFile(appEnvFile, `${lines.join('\n')}\n`, 'utf8');
}

async function seedOpenGame(rpcUrl, addresses) {
  const account = privateKeyToAccount(ANVIL_PK);
  const transport = http(rpcUrl);
  const walletClient = createWalletClient({
    account,
    chain: foundry,
    transport,
  });
  const publicClient = createPublicClient({
    chain: foundry,
    transport,
  });

  const hash = await walletClient.writeContract({
    address: addresses.VITE_CONTROLLER_ADDRESS,
    abi: controllerAbi,
    functionName: 'requestNewGame',
    args: [
      addresses.VITE_GAME_REGISTRY_ADDRESS,
      addresses.VITE_BOARD_ADDRESS,
      2n,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function main() {
  const anvilPort = Number(process.env.E2E_ANVIL_PORT)
    || await findFreePort(43211);
  const appPort = Number(process.env.E2E_APP_PORT)
    || await findFreePort(43311);
  const rpcUrl = `http://127.0.0.1:${anvilPort}`;
  const baseURL = `http://127.0.0.1:${appPort}`;

  console.log('[anvil-e2e] Checking contract sizes against EIP-170...');
  await runCommand('forge', ['build', '--sizes']);

  console.log(`[anvil-e2e] Starting Anvil on ${rpcUrl}`);
  const anvil = spawn('anvil', [
    '--host',
    '127.0.0.1',
    '--port',
    String(anvilPort),
    '--chain-id',
    '31337',
  ], {
    cwd: repoRoot,
    shell: false,
    stdio: 'inherit',
  });

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (anvil && !anvil.killed) {
      anvil.kill('SIGTERM');
    }
  };

  process.on('SIGINT', () => {
    shutdown();
    process.exit(1);
  });
  process.on('SIGTERM', () => {
    shutdown();
    process.exit(1);
  });

  try {
    await waitForRpc(rpcUrl);

    console.log('[anvil-e2e] Deploying contracts to local Anvil...');
    await runCommand('forge', [
      'script',
      'script/DeployHexploration.s.sol',
      '--rpc-url',
      rpcUrl,
      '--broadcast',
      '--non-interactive',
    ], {
      env: {
        PRIVATE_KEY: ANVIL_PK,
      },
    });

    const addresses = await readDeploymentAddresses();
    await writeAppEnv(addresses, rpcUrl);
    console.log(`[anvil-e2e] Wrote app env: ${appEnvFile}`);

    console.log('[anvil-e2e] Seeding an open expedition...');
    await seedOpenGame(rpcUrl, addresses);

    console.log('[anvil-e2e] Running Playwright against local chain...');
    await runCommand('npx', [
      'playwright',
      'test',
      '--config',
      'playwright.config.js',
    ], {
      cwd: appDir,
      env: {
        E2E_APP_PORT: String(appPort),
        E2E_BASE_URL: baseURL,
        E2E_EXPECT_OPEN_GAME: 'true',
        PLAYWRIGHT_WEB_SERVER_CMD:
          `cmd /c npm run dev -- --mode e2e-anvil --host 127.0.0.1 --port ${appPort} --strictPort`,
      },
    });

    console.log(`[anvil-e2e] Success. Anvil RPC: ${rpcUrl}, App URL: ${baseURL}`);
  } finally {
    shutdown();
  }
}

main().catch((error) => {
  console.error('[anvil-e2e] Failed:', error);
  process.exit(1);
});
