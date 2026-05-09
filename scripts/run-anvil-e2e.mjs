#!/usr/bin/env node
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
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
  'DeployXenovoya.s.sol',
  '31337',
  'run-latest.json',
);
const appEnvFile = path.resolve(appDir, '.env.e2e-anvil');
const foundryBinDir = process.env.FOUNDRY_BIN
  || path.join(process.env.USERPROFILE || process.env.HOME || '', '.foundry', 'bin');
const foundryExeSuffix = process.platform === 'win32' ? '.exe' : '';
const windowsCmdSuffix = process.platform === 'win32' ? '.cmd' : '';

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
  {
    type: 'function',
    stateMutability: 'view',
    name: 'VERIFIED_CONTROLLER_ROLE',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'hasRole',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'addVerifiedController',
    inputs: [{ name: 'vcAddress', type: 'address' }],
    outputs: [],
  },
];

function runCommand(command, args, options = {}) {
  const defaultShell = command.toLowerCase().endsWith('.cmd');
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...(options.env || {}) },
      shell: options.shell ?? defaultShell,
      stdio: options.stdio ?? 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function resolveFoundryBinary(name) {
  return path.join(foundryBinDir, `${name}${foundryExeSuffix}`);
}

function resolveShellBinary(name) {
  return process.platform === 'win32' ? `${name}${windowsCmdSuffix}` : name;
}

async function getTransactionReceipt(rpcUrl, hash) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      params: [hash],
      id: 1,
    }),
  });
  if (!response.ok) return null;
  const json = await response.json();
  return json.result ?? null;
}

async function rpcRequest(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`${method} failed with HTTP ${response.status}`);
  }
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.message || `${method} failed`);
  }
  return json.result;
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
    VITE_BOARD_ADDRESS: byName.XenovoyaBoard,
    VITE_CONTROLLER_ADDRESS: byName.XenovoyaController,
    VITE_GAME_SUMMARY_ADDRESS: byName.GameSummary,
    VITE_PLAYER_SUMMARY_ADDRESS: byName.PlayerSummary,
    VITE_GAME_EVENTS_ADDRESS: byName.GameEvents,
    VITE_GAME_REGISTRY_ADDRESS: byName.GameRegistry,
    VITE_PLAYER_REGISTRY_ADDRESS: byName.PlayerRegistry,
    VITE_GAME_QUEUE_ADDRESS: byName.XenovoyaQueue,
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

async function readDeckAddresses() {
  const raw = await fs.readFile(broadcastLatest, 'utf8');
  const json = JSON.parse(raw);

  const cardDecks = [];
  for (const tx of json.transactions || []) {
    if (tx.contractName === 'CardDeck' && tx.contractAddress) {
      cardDecks.push(tx.contractAddress);
    }
  }

  if (cardDecks.length < 5) {
    throw new Error(`Expected 5 CardDeck deploys, found ${cardDecks.length}. Deploy script order may have changed.`);
  }

  // CardDeck deploy order: event, ambush, treasure, land, relic
  const DECK_KEYS = ['EVENT_DECK', 'AMBUSH_DECK', 'TREASURE_DECK', 'LAND_DECK', 'RELIC_DECK'];
  const deckAddrs = {};
  for (let i = 0; i < DECK_KEYS.length; i++) {
    deckAddrs[DECK_KEYS[i]] = cardDecks[i];
  }

  return deckAddrs;
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
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({
    chain: foundry,
    transport,
  });

  await rpcRequest(rpcUrl, 'anvil_impersonateAccount', [addresses.VITE_BOARD_ADDRESS]);
  await rpcRequest(rpcUrl, 'anvil_setBalance', [addresses.VITE_BOARD_ADDRESS, '0x56BC75E2D63100000']);

  const gameRegistryAbi = [
    {
      type: 'function',
      stateMutability: 'view',
      name: 'GAME_BOARD_ROLE',
      inputs: [],
      outputs: [{ name: '', type: 'bytes32' }],
    },
    {
      type: 'function',
      stateMutability: 'view',
      name: 'hasRole',
      inputs: [
        { name: 'role', type: 'bytes32' },
        { name: 'account', type: 'address' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      type: 'function',
      stateMutability: 'nonpayable',
      name: 'addGameBoard',
      inputs: [{ name: 'gameBoardAddress', type: 'address' }],
      outputs: [],
    },
    {
      type: 'function',
      stateMutability: 'nonpayable',
      name: 'registerGame',
      inputs: [],
      outputs: [{ name: 'gameID', type: 'uint256' }],
    },
    {
      type: 'function',
      stateMutability: 'view',
      name: 'latestGame',
      inputs: [{ name: 'gameBoardAddress', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ];
  const playerRegistryAbi = [
    {
      type: 'function',
      stateMutability: 'view',
      name: 'GAME_BOARD_ROLE',
      inputs: [],
      outputs: [{ name: '', type: 'bytes32' }],
    },
    {
      type: 'function',
      stateMutability: 'view',
      name: 'hasRole',
      inputs: [
        { name: 'role', type: 'bytes32' },
        { name: 'account', type: 'address' },
      ],
      outputs: [{ name: '', type: 'bool' }],
    },
    {
      type: 'function',
      stateMutability: 'nonpayable',
      name: 'grantRole',
      inputs: [
        { name: 'role', type: 'bytes32' },
        { name: 'account', type: 'address' },
      ],
      outputs: [],
    },
    {
      type: 'function',
      stateMutability: 'nonpayable',
      name: 'setRegistrationLimit',
      inputs: [
        { name: 'limit', type: 'uint256' },
        { name: 'gameID', type: 'uint256' },
      ],
      outputs: [],
    },
  ];

  const registryRole = await publicClient.readContract({
    address: addresses.VITE_GAME_REGISTRY_ADDRESS,
    abi: gameRegistryAbi,
    functionName: 'GAME_BOARD_ROLE',
    args: [],
  });
  const boardOnRegistry = await publicClient.readContract({
    address: addresses.VITE_GAME_REGISTRY_ADDRESS,
    abi: gameRegistryAbi,
    functionName: 'hasRole',
    args: [registryRole, addresses.VITE_BOARD_ADDRESS],
  });
  if (!boardOnRegistry) {
    const grantHash = await rpcRequest(rpcUrl, 'eth_sendTransaction', [{
      from: addresses.VITE_BOARD_ADDRESS,
      to: addresses.VITE_GAME_REGISTRY_ADDRESS,
      data: encodeFunctionData({
        abi: gameRegistryAbi,
        functionName: 'addGameBoard',
        args: [addresses.VITE_BOARD_ADDRESS],
      }),
    }]);
    await publicClient.waitForTransactionReceipt({ hash: grantHash });
  }

  const playerBoardRole = await publicClient.readContract({
    address: addresses.VITE_PLAYER_REGISTRY_ADDRESS,
    abi: playerRegistryAbi,
    functionName: 'GAME_BOARD_ROLE',
    args: [],
  });
  const boardOnPlayerRegistry = await publicClient.readContract({
    address: addresses.VITE_PLAYER_REGISTRY_ADDRESS,
    abi: playerRegistryAbi,
    functionName: 'hasRole',
    args: [playerBoardRole, addresses.VITE_BOARD_ADDRESS],
  });
  if (!boardOnPlayerRegistry) {
    const grantHash = await rpcRequest(rpcUrl, 'eth_sendTransaction', [{
      from: addresses.VITE_BOARD_ADDRESS,
      to: addresses.VITE_PLAYER_REGISTRY_ADDRESS,
      data: encodeFunctionData({
        abi: playerRegistryAbi,
        functionName: 'grantRole',
        args: [playerBoardRole, addresses.VITE_BOARD_ADDRESS],
      }),
    }]);
    await publicClient.waitForTransactionReceipt({ hash: grantHash });
  }

  for (let i = 0; i < 2; i++) {
    const txHash = await rpcRequest(rpcUrl, 'eth_sendTransaction', [{
      from: addresses.VITE_BOARD_ADDRESS,
      to: addresses.VITE_GAME_REGISTRY_ADDRESS,
      data: encodeFunctionData({
        abi: gameRegistryAbi,
        functionName: 'registerGame',
        args: [],
      }),
    }]);
    await publicClient.waitForTransactionReceipt({ hash: txHash });

    const gameId = await publicClient.readContract({
      address: addresses.VITE_GAME_REGISTRY_ADDRESS,
      abi: gameRegistryAbi,
      functionName: 'latestGame',
      args: [addresses.VITE_BOARD_ADDRESS],
    });

    const limitHash = await rpcRequest(rpcUrl, 'eth_sendTransaction', [{
      from: addresses.VITE_BOARD_ADDRESS,
      to: addresses.VITE_PLAYER_REGISTRY_ADDRESS,
      data: encodeFunctionData({
        abi: playerRegistryAbi,
        functionName: 'setRegistrationLimit',
        args: [2n, gameId],
      }),
    }]);
    await publicClient.waitForTransactionReceipt({ hash: limitHash });
  }

  await rpcRequest(rpcUrl, 'anvil_stopImpersonatingAccount', [addresses.VITE_BOARD_ADDRESS]);
}

async function main() {
  const anvilPort = Number(process.env.E2E_ANVIL_PORT)
    || await findFreePort(43211);
  const appPort = Number(process.env.E2E_APP_PORT)
    || await findFreePort(43311);
  const rpcUrl = `http://127.0.0.1:${anvilPort}`;
  const baseURL = `http://127.0.0.1:${appPort}`;

  console.log('[anvil-e2e] Checking contract sizes against EIP-170...');
  await runCommand(resolveFoundryBinary('forge'), ['build', '--sizes']);

  console.log(`[anvil-e2e] Starting Anvil on ${rpcUrl}`);
  const anvil = spawn(resolveFoundryBinary('anvil'), [
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
  const forge = spawn(resolveFoundryBinary('forge'), [
    'script',
    'script/DeployXenovoya.s.sol',
    '--rpc-url',
    rpcUrl,
    '--broadcast',
    '--non-interactive',
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PRIVATE_KEY: ANVIL_PK,
    },
    shell: false,
    stdio: 'inherit',
  });
  const forgeExit = new Promise((resolve, reject) => {
    forge.on('error', reject);
    forge.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`forge script exited with code ${code}`));
    });
  });

  await forgeExit;

  const addresses = await readDeploymentAddresses();

    console.log('[anvil-e2e] Populating card decks...');
    const deckAddrs = await readDeckAddresses();
    await runCommand('node', ['scripts/populate-decks.mjs'], {
      env: {
        CHAIN: 'foundry',
        RPC_URL: rpcUrl,
        PRIVATE_KEY: ANVIL_PK,
        DEPLOYMENTS_JSON: JSON.stringify(deckAddrs),
      },
    });

    await writeAppEnv(addresses, rpcUrl);
    console.log(`[anvil-e2e] Wrote app env: ${appEnvFile}`);

    console.log('[anvil-e2e] Seeding an open expedition...');
    await seedOpenGame(rpcUrl, addresses);

    console.log('[anvil-e2e] Running Playwright against local chain...');
    await runCommand(resolveShellBinary('npx'), [
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
