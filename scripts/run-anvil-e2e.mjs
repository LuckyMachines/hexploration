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
const RELAY_PK =
  process.env.E2E_SPONSOR_RELAYER_PRIVATE_KEY
  || '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6';

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
      windowsHide: true,
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

async function waitForHttp(url, timeoutMs = 25_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for HTTP service at ${url}`);
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
    VITE_SESSION_FORWARDER_ADDRESS: byName.XenovoyaSessionForwarder,
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

async function writeAppEnv(addresses, rpcUrl, relayUrl) {
  const lines = [
    ...Object.entries(addresses).map(([k, v]) => `${k}=${v}`),
    'VITE_WALLETCONNECT_PROJECT_ID=',
    'VITE_RPC_URL=',
    `VITE_FOUNDRY_RPC_URL=${rpcUrl}`,
    'VITE_CONTROLLER_SUPPORTS_DELEGATION=true',
    `VITE_GAME_AUTHORITY_URL=${relayUrl}`,
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
  const relayPort = Number(process.env.E2E_RELAY_PORT)
    || await findFreePort(43411);
  const rpcUrl = `http://127.0.0.1:${anvilPort}`;
  const baseURL = `http://127.0.0.1:${appPort}`;
  const relayUrl = `http://127.0.0.1:${relayPort}`;
  const relayStateFile = path.resolve(repoRoot, 'cache', `sponsor-relay-e2e-${process.pid}.json`);

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
    windowsHide: true,
  });

  let relay = null;
  let miningTimer = null;
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (anvil && !anvil.killed) {
      anvil.kill('SIGTERM');
    }
    if (relay && !relay.killed) relay.kill('SIGTERM');
    if (miningTimer) clearInterval(miningTimer);
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
    '--slow',
    '--non-interactive',
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PRIVATE_KEY: ANVIL_PK,
    },
    shell: false,
    stdio: 'inherit',
    windowsHide: true,
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

    console.log(`[anvil-e2e] Starting sponsor relay on ${relayUrl}`);
    relay = spawn('node', ['scripts/sponsor-relay-server.mjs'], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(relayPort),
        SPONSOR_RELAY_HOST: '127.0.0.1',
        SPONSOR_RELAY_CHAIN_ID: '31337',
        SPONSOR_RELAY_RPC_URL: rpcUrl,
        SPONSOR_RELAY_ALLOW_LOCAL_HTTP: 'true',
        SPONSOR_RELAY_FORWARDER_ADDRESS: addresses.VITE_SESSION_FORWARDER_ADDRESS,
        SPONSOR_RELAY_CONTROLLER_ADDRESS: addresses.VITE_CONTROLLER_ADDRESS,
        SPONSOR_RELAY_BOARD_ADDRESS: addresses.VITE_BOARD_ADDRESS,
        GAME_AUTHORITY_REGISTRY_ADDRESS: addresses.VITE_GAME_REGISTRY_ADDRESS,
        GAME_AUTHORITY_READ_ADDRESSES: Object.values(addresses).join(','),
        SPONSOR_RELAYER_PRIVATE_KEY: RELAY_PK,
        SPONSOR_RELAY_ADMIN_TOKEN: 'anvil-e2e-admin-token-with-at-least-32-characters',
        GAME_AUTHORITY_SECRET: 'anvil-e2e-game-authority-secret-with-at-least-32-characters',
        SPONSOR_RELAY_ALLOWED_ORIGINS: baseURL,
        SPONSOR_RELAY_STATE_FILE: relayStateFile,
        SPONSOR_RELAY_MIN_BALANCE_WEI: '1',
        SPONSOR_RELAY_EXPLORER_URL: '',
      },
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    });
    await waitForHttp(`${relayUrl}/healthz`);

    await writeAppEnv(addresses, rpcUrl, relayUrl);
    console.log(`[anvil-e2e] Wrote app env: ${appEnvFile}`);

    console.log('[anvil-e2e] Seeding an open expedition...');
    await seedOpenGame(rpcUrl, addresses);

    console.log('[anvil-e2e] Running Playwright against local chain...');
    miningTimer = setInterval(() => {
      rpcRequest(rpcUrl, 'evm_mine').catch(() => {});
    }, 1_000);
    const playwrightArgs = [
      'playwright',
      'test',
      '--config',
      'playwright.config.js',
    ];
    if (process.env.E2E_PROJECT) playwrightArgs.push('--project', process.env.E2E_PROJECT);
    if (process.env.E2E_GREP) playwrightArgs.push('--grep', process.env.E2E_GREP);
    await runCommand(resolveShellBinary('npx'), playwrightArgs, {
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
    await fs.rm(relayStateFile, { force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error('[anvil-e2e] Failed:', error);
  process.exit(1);
});
