#!/usr/bin/env node
/**
 * Local full-stack orchestrator.
 * Boots Anvil, deploys contracts, populates card decks, seeds a survey,
 * (optionally) registers bot players, starts the automation worker (and
 * auto-bot daemon for multi mode), and launches the Vite dev server.
 *
 * Modes:
 *   npm run local                # backwards-compat: 2-player survey, no bots
 *   npm run local:solo           # 1-player survey, you can play immediately
 *   npm run local:multi          # 2-player survey + 1 bot, you join slot 2
 *   npm run local:multi:4        # 4-player survey + 3 bots, you join slot 4
 *
 * Flags:
 *   --solo                       # 1-player survey
 *   --multi                      # multi-player survey with bots filling N-1
 *   --players=N                  # override player count (1..4)
 *   --no-bots                    # multi mode but don't register bots
 *                                  (you bring your own keys)
 *   --no-worker                  # skip the automation worker
 *   --no-vite                    # skip the frontend dev server
 *   ANVIL_PORT=8545 ...          # change anvil port (default 9955)
 */
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
import {
  buildLocalStackHealth,
  markdownForLocalStackHealth,
  writeLocalStackHealthReports,
} from './local-stack-doctor-utils.mjs';

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
const foundryBinDir = process.env.FOUNDRY_BIN
  || path.join(process.env.USERPROFILE || process.env.HOME || '', '.foundry', 'bin');
const foundryExeSuffix = process.platform === 'win32' ? '.exe' : '';
const windowsCmdSuffix = process.platform === 'win32' ? '.cmd' : '';

const ANVIL_PORT = Number(process.env.ANVIL_PORT) || 9955;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;
const ANVIL_PK =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// ── Args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name) {
  return args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
}
function flagVal(name, def) {
  const f = flag(name);
  if (!f) return def;
  const eq = f.indexOf('=');
  return eq >= 0 ? f.slice(eq + 1) : true;
}

const isSolo  = !!flag('solo');
const isMulti = !!flag('multi');
const mode    = isSolo ? 'solo' : isMulti ? 'multi' : 'classic';
const defaultPlayers = mode === 'solo' ? 1 : mode === 'multi' ? 2 : 2;
const players = Math.max(1, Math.min(4, Number(flagVal('players', defaultPlayers))));
const wantBots = mode === 'multi' && !flag('no-bots');
const botCount = wantBots ? Math.max(0, players - 1) : 0;
const skipWorker = !!flag('no-worker');
const skipVite = !!flag('no-vite');
const deployTimeoutMs = Number(process.env.LOCAL_STACK_DEPLOY_TIMEOUT_MS) || 180_000;
const commandTimeoutMs = Number(process.env.LOCAL_STACK_COMMAND_TIMEOUT_MS) || 120_000;
const readinessTimeoutMs = Number(process.env.LOCAL_STACK_READINESS_TIMEOUT_MS) || 30_000;

const children = [];
const bootSteps = [];

// ── Helpers ──────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[local-stack] ${msg}`);
}

function resolveFoundryBinary(name) {
  return path.join(foundryBinDir, `${name}${foundryExeSuffix}`);
}

function resolveShellBinary(name) {
  return process.platform === 'win32' ? `${name}${windowsCmdSuffix}` : name;
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
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for RPC at ${rpcUrl}`);
}

function runCommand(command, args, options = {}) {
  const defaultShell = command.toLowerCase().endsWith('.cmd');
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout;
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...(options.env || {}) },
      shell: options.shell ?? defaultShell,
      stdio: options.stdio ?? 'inherit',
    });

    function settle(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    }

    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch {}
        settle(new Error(`${command} ${args.join(' ')} timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs);
    }

    child.on('error', settle);
    child.on('exit', (code) => {
      if (code === 0) settle();
      else settle(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function spawnChild(command, args, options = {}) {
  const defaultShell = command.toLowerCase().endsWith('.cmd');
  const child = spawn(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...(options.env || {}) },
    shell: options.shell ?? defaultShell,
    stdio: options.stdio ?? 'inherit',
  });
  child.localStackLabel = options.label || path.basename(command);
  child.localStackCommand = `${command} ${args.join(' ')}`;
  children.push(child);
  return child;
}

function childProcessesSummary() {
  return children.map((child) => ({
    label: child.localStackLabel || 'process',
    command: child.localStackCommand || 'unknown',
    pid: child.pid,
    killed: child.killed,
    exitCode: child.exitCode,
  }));
}

async function withStepTimeout(label, timeoutMs, fn) {
  let timer;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function runBootStep(id, label, timeoutMs, fn) {
  const step = {
    id,
    label,
    status: 'running',
    startedAt: new Date().toISOString(),
    durationMs: 0,
  };
  bootSteps.push(step);
  const start = Date.now();
  log(`${label}...`);
  try {
    const result = await withStepTimeout(label, timeoutMs, fn);
    step.status = 'pass';
    step.finishedAt = new Date().toISOString();
    step.durationMs = Date.now() - start;
    log(`${label} complete (${step.durationMs}ms).`);
    return result;
  } catch (error) {
    step.status = 'fail';
    step.finishedAt = new Date().toISOString();
    step.durationMs = Date.now() - start;
    step.error = error.message;
    throw error;
  }
}

// ── Address extraction ───────────────────────────────────────────────

async function readBroadcastAddresses() {
  const raw = await fs.readFile(broadcastLatest, 'utf8');
  const json = JSON.parse(raw);

  const byName = {};
  const cardDecks = [];
  const gameTokens = [];

  for (const tx of json.transactions || []) {
    if (!tx.contractName || !tx.contractAddress) continue;

    if (tx.contractName === 'CardDeck') {
      cardDecks.push(tx.contractAddress);
    } else if (tx.contractName === 'GameToken') {
      gameTokens.push(tx.contractAddress);
    } else {
      byName[tx.contractName] = tx.contractAddress;
    }
  }

  // CardDeck deploy order (must match DeployXenovoya.s.sol):
  // event, ambush, treasure, land, relic
  if (cardDecks.length < 5) {
    throw new Error(`Expected 5 CardDeck deploys, found ${cardDecks.length}. Deploy script order may have changed.`);
  }
  const DECK_KEYS = ['EVENT_DECK', 'AMBUSH_DECK', 'TREASURE_DECK', 'LAND_DECK', 'RELIC_DECK'];
  const deckAddrs = {};
  for (let i = 0; i < DECK_KEYS.length; i++) {
    if (!cardDecks[i]) throw new Error(`Missing CardDeck #${i} (${DECK_KEYS[i]}) in broadcast`);
    deckAddrs[DECK_KEYS[i]] = cardDecks[i];
  }
  const TOKEN_KEYS = ['DAY_NIGHT_TOKEN', 'DISASTER_TOKEN', 'ENEMY_TOKEN', 'ITEM_TOKEN', 'PLAYER_STATUS_TOKEN', 'RELIC_TOKEN'];
  for (let i = 0; i < TOKEN_KEYS.length; i++) {
    if (!gameTokens[i]) throw new Error(`Missing GameToken #${i} (${TOKEN_KEYS[i]}) in broadcast`);
    byName[TOKEN_KEYS[i]] = gameTokens[i];
  }

  // Worker addresses
  const workerAddrs = {
    GAME_SETUP: byName.GameSetup,
    GAME_QUEUE: byName.XenovoyaQueue,
    XENOVOYA_CONTROLLER: byName.XenovoyaController,
    GAMEPLAY: byName.XenovoyaGameplay,
  };

  // App / frontend addresses
  const appAddrs = {
    VITE_BOARD_ADDRESS: byName.XenovoyaBoard,
    VITE_CONTROLLER_ADDRESS: byName.XenovoyaController,
    VITE_GAME_SUMMARY_ADDRESS: byName.GameSummary,
    VITE_PLAYER_SUMMARY_ADDRESS: byName.PlayerSummary,
    VITE_GAME_EVENTS_ADDRESS: byName.GameEvents,
    VITE_GAME_REGISTRY_ADDRESS: byName.GameRegistry,
    VITE_GAME_QUEUE_ADDRESS: byName.XenovoyaQueue,
    VITE_GAME_SETUP_ADDRESS: byName.GameSetup,
    VITE_PLAYER_REGISTRY_ADDRESS: byName.PlayerRegistry,
    VITE_CHARACTER_CARD_ADDRESS: byName.CharacterCard,
    VITE_TOKEN_INVENTORY_ADDRESS: byName.TokenInventory,
  };

  // Validate nothing is missing
  for (const [key, val] of Object.entries({ ...workerAddrs, ...appAddrs, ...deckAddrs })) {
    if (!val) throw new Error(`Missing deployed address for ${key} in broadcast`);
  }

  return { workerAddrs, appAddrs, deckAddrs, byName };
}

// ── Seed game ────────────────────────────────────────────────────────

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

const accessControlAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'VERIFIED_CONTROLLER_ROLE',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'hasRole',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'addVerifiedController',
    inputs: [{ name: 'vcAddress', type: 'address' }],
    outputs: [],
  },
];

const gameRegistryAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'GAME_BOARD_ROLE',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'hasRole',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'addGameBoard',
    inputs: [{ name: 'gameBoardAddress', type: 'address' }],
    outputs: [],
  },
];

const localWiringAbi = [
  { type: 'function', stateMutability: 'nonpayable', name: 'addGameBoard', inputs: [{ name: 'gameBoardAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'addVerifiedController', inputs: [{ name: 'vcAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'addFactory', inputs: [{ name: 'factoryAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setCharacterCard', inputs: [{ name: 'characterCardAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setTokenInventory', inputs: [{ name: 'tokenInventoryAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setGameplayQueue', inputs: [{ name: 'gameplayQueueAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setPlayerRegistry', inputs: [{ name: 'playerRegistryAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'addGameBoard', inputs: [{ name: 'gameBoardAddress', type: 'address' }], outputs: [] },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'setTokenAddresses',
    inputs: [
      { name: 'dayNightTokenAddress', type: 'address' },
      { name: 'disasterTokenAddress', type: 'address' },
      { name: 'enemyTokenAddress', type: 'address' },
      { name: 'itemTokenAddress', type: 'address' },
      { name: 'playerStatusTokenAddress', type: 'address' },
      { name: 'relicTokenAddress', type: 'address' },
    ],
    outputs: [],
  },
  { type: 'function', stateMutability: 'nonpayable', name: 'addController', inputs: [{ name: 'controllerAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setGameEvents', inputs: [{ name: 'gameEventsAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setGameStateUpdate', inputs: [{ name: 'gameStateUpdateAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setGameSetup', inputs: [{ name: 'gameSetupAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setQueue', inputs: [{ name: 'queueContract', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setGameEvents', inputs: [{ name: 'gameEventsAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setQueue', inputs: [{ name: 'queueContract', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setGameStateUpdate', inputs: [{ name: 'gameStateUpdateAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setGameEvents', inputs: [{ name: 'gameEventsAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setQueue', inputs: [{ name: 'queueContract', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'addEventSender', inputs: [{ name: 'eventSenderAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setPlayerSummary', inputs: [{ name: 'playerSummaryAddress', type: 'address' }], outputs: [] },
  { type: 'function', stateMutability: 'nonpayable', name: 'setPlayZoneSummary', inputs: [{ name: 'playZoneSummaryAddress', type: 'address' }], outputs: [] },
];

async function seedOpenGame(appAddrs, totalPlayers) {
  const account = privateKeyToAccount(ANVIL_PK);
  const transport = http(RPC_URL);
  const walletClient = createWalletClient({ account, chain: foundry, transport });
  const publicClient = createPublicClient({ chain: foundry, transport });

  const hash = await walletClient.writeContract({
    address: appAddrs.VITE_CONTROLLER_ADDRESS,
    abi: controllerAbi,
    functionName: 'requestNewGame',
    args: [
      appAddrs.VITE_GAME_REGISTRY_ADDRESS,
      appAddrs.VITE_BOARD_ADDRESS,
      BigInt(totalPlayers),
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function ensureVerifiedController({ contract, controller, label }) {
  const account = privateKeyToAccount(ANVIL_PK);
  const transport = http(RPC_URL);
  const walletClient = createWalletClient({ account, chain: foundry, transport });
  const publicClient = createPublicClient({ chain: foundry, transport });
  const role = await publicClient.readContract({
    address: contract,
    abi: accessControlAbi,
    functionName: 'VERIFIED_CONTROLLER_ROLE',
    args: [],
  });
  const hasRole = await publicClient.readContract({
    address: contract,
    abi: accessControlAbi,
    functionName: 'hasRole',
    args: [role, controller],
  });
  if (hasRole) return false;
  const hash = await walletClient.writeContract({
    address: contract,
    abi: accessControlAbi,
    functionName: 'addVerifiedController',
    args: [controller],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  log(`Granted ${label} verified-controller role to ${controller}.`);
  return true;
}

async function ensureLocalWiring({ appAddrs, deckAddrs, byName }) {
  const account = privateKeyToAccount(ANVIL_PK);
  const transport = http(RPC_URL);
  const walletClient = createWalletClient({ account, chain: foundry, transport });
  const publicClient = createPublicClient({ chain: foundry, transport });

  async function write(address, functionName, args = []) {
    const hash = await walletClient.writeContract({
      address,
      abi: localWiringAbi,
      functionName,
      args,
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  const boardRole = await publicClient.readContract({
    address: appAddrs.VITE_GAME_REGISTRY_ADDRESS,
    abi: gameRegistryAbi,
    functionName: 'GAME_BOARD_ROLE',
    args: [],
  });
  const registryHasBoard = await publicClient.readContract({
    address: appAddrs.VITE_GAME_REGISTRY_ADDRESS,
    abi: gameRegistryAbi,
    functionName: 'hasRole',
    args: [boardRole, appAddrs.VITE_BOARD_ADDRESS],
  });
  if (!registryHasBoard) {
    const hash = await walletClient.writeContract({
      address: appAddrs.VITE_GAME_REGISTRY_ADDRESS,
      abi: gameRegistryAbi,
      functionName: 'addGameBoard',
      args: [appAddrs.VITE_BOARD_ADDRESS],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log(`Granted game-registry board role to ${appAddrs.VITE_BOARD_ADDRESS}.`);
  }

  await write(appAddrs.VITE_BOARD_ADDRESS, 'setCharacterCard', [appAddrs.VITE_CHARACTER_CARD_ADDRESS]);
  await write(appAddrs.VITE_BOARD_ADDRESS, 'setTokenInventory', [appAddrs.VITE_TOKEN_INVENTORY_ADDRESS]);
  await write(appAddrs.VITE_BOARD_ADDRESS, 'setGameplayQueue', [appAddrs.VITE_GAME_QUEUE_ADDRESS]);
  await write(appAddrs.VITE_BOARD_ADDRESS, 'setPlayerRegistry', [appAddrs.VITE_PLAYER_REGISTRY_ADDRESS]);
  await write(appAddrs.VITE_BOARD_ADDRESS, 'addFactory', [account.address]);
  for (const controller of [
    appAddrs.VITE_CONTROLLER_ADDRESS,
    byName.XenovoyaGameplay,
    byName.XenovoyaStateUpdate,
    appAddrs.VITE_GAME_SETUP_ADDRESS,
  ]) {
    await write(appAddrs.VITE_BOARD_ADDRESS, 'addVerifiedController', [controller]);
  }

  await write(byName.XenovoyaZone, 'addGameBoard', [appAddrs.VITE_BOARD_ADDRESS]);
  await write(appAddrs.VITE_TOKEN_INVENTORY_ADDRESS, 'setTokenAddresses', [
    byName.DAY_NIGHT_TOKEN,
    byName.DISASTER_TOKEN,
    byName.ENEMY_TOKEN,
    byName.ITEM_TOKEN,
    byName.PLAYER_STATUS_TOKEN,
    byName.RELIC_TOKEN,
  ]);
  for (const token of [
    byName.DAY_NIGHT_TOKEN,
    byName.DISASTER_TOKEN,
    byName.ENEMY_TOKEN,
    byName.ITEM_TOKEN,
    byName.PLAYER_STATUS_TOKEN,
    byName.RELIC_TOKEN,
  ]) {
    await write(token, 'addController', [appAddrs.VITE_TOKEN_INVENTORY_ADDRESS]);
    await write(token, 'addController', [appAddrs.VITE_GAME_SETUP_ADDRESS]);
  }

  await write(appAddrs.VITE_CONTROLLER_ADDRESS, 'setGameEvents', [byName.GameEvents]);
  await write(appAddrs.VITE_CONTROLLER_ADDRESS, 'setGameStateUpdate', [byName.XenovoyaStateUpdate]);
  await write(appAddrs.VITE_CONTROLLER_ADDRESS, 'setGameSetup', [appAddrs.VITE_GAME_SETUP_ADDRESS]);
  await write(appAddrs.VITE_CONTROLLER_ADDRESS, 'addVerifiedController', [account.address]);

  await write(appAddrs.VITE_GAME_QUEUE_ADDRESS, 'addVerifiedController', [appAddrs.VITE_CONTROLLER_ADDRESS]);
  await write(appAddrs.VITE_GAME_QUEUE_ADDRESS, 'addVerifiedController', [appAddrs.VITE_GAME_SETUP_ADDRESS]);
  await write(appAddrs.VITE_GAME_QUEUE_ADDRESS, 'setGameEvents', [byName.GameEvents]);

  await write(byName.XenovoyaGameplay, 'addVerifiedController', [appAddrs.VITE_CONTROLLER_ADDRESS]);
  await write(byName.XenovoyaGameplay, 'setQueue', [appAddrs.VITE_GAME_QUEUE_ADDRESS]);
  await write(byName.XenovoyaGameplay, 'setGameStateUpdate', [byName.XenovoyaStateUpdate]);

  await write(byName.XenovoyaStateUpdate, 'addVerifiedController', [byName.XenovoyaGameplay]);
  await write(byName.XenovoyaStateUpdate, 'setGameEvents', [byName.GameEvents]);

  await write(appAddrs.VITE_GAME_SETUP_ADDRESS, 'addVerifiedController', [appAddrs.VITE_CONTROLLER_ADDRESS]);
  await write(appAddrs.VITE_GAME_SETUP_ADDRESS, 'setGameEvents', [byName.GameEvents]);

  await write(byName.RollDraw, 'setQueue', [appAddrs.VITE_GAME_QUEUE_ADDRESS]);
  await write(byName.RelicManagement, 'addVerifiedController', [byName.XenovoyaStateUpdate]);

  for (const controller of [
    appAddrs.VITE_CONTROLLER_ADDRESS,
    byName.XenovoyaGameplay,
    byName.XenovoyaStateUpdate,
    appAddrs.VITE_GAME_SETUP_ADDRESS,
  ]) {
    await write(appAddrs.VITE_CHARACTER_CARD_ADDRESS, 'addVerifiedController', [controller]);
  }

  for (const sender of [
    appAddrs.VITE_CONTROLLER_ADDRESS,
    appAddrs.VITE_GAME_QUEUE_ADDRESS,
    byName.XenovoyaStateUpdate,
    appAddrs.VITE_GAME_SETUP_ADDRESS,
    byName.XenovoyaGameplay,
  ]) {
    await write(byName.GameEvents, 'addEventSender', [sender]);
  }

  await write(byName.GameSummary, 'setPlayerSummary', [byName.PlayerSummary]);
  await write(byName.GameSummary, 'setPlayZoneSummary', [byName.PlayZoneSummary]);

  await ensureVerifiedController({
    contract: appAddrs.VITE_BOARD_ADDRESS,
    controller: appAddrs.VITE_CONTROLLER_ADDRESS,
    label: 'board',
  });

  log('Local contract wiring verified.');
}

// ── Write app .env.local ─────────────────────────────────────────────

async function writeAppEnvLocal(appAddrs) {
  const envFile = path.resolve(appDir, '.env.local');
  const lines = [
    ...Object.entries(appAddrs).map(([k, v]) => `${k}=${v}`),
    'VITE_WALLETCONNECT_PROJECT_ID=',
    'VITE_RPC_URL=',
    `VITE_FOUNDRY_RPC_URL=${RPC_URL}`,
  ];
  await fs.writeFile(envFile, `${lines.join('\n')}\n`, 'utf8');
  log(`Wrote ${envFile}`);
}

// ── Shutdown ─────────────────────────────────────────────────────────

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Shutting down all processes...');
  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill('SIGTERM');
      } catch {}
    }
  }
}

process.on('SIGINT', () => {
  shutdown();
  // Give children a moment to exit, then force
  setTimeout(() => process.exit(0), 1500);
});
process.on('SIGTERM', () => {
  shutdown();
  setTimeout(() => process.exit(0), 1500);
});

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  await runBootStep('port', 'Check Anvil port', 5_000, async () => {
    if (!(await isPortAvailable(ANVIL_PORT))) {
      throw new Error(`Port ${ANVIL_PORT} is already in use. Set ANVIL_PORT env var or free the port.`);
    }
  });

  const anvil = await runBootStep('anvil.start', `Start Anvil on port ${ANVIL_PORT}`, 10_000, async () => spawnChild(resolveFoundryBinary('anvil'), [
    '--host', '127.0.0.1',
    '--port', String(ANVIL_PORT),
    '--chain-id', '31337',
  ], { shell: false, stdio: 'inherit', label: 'anvil' }));

  anvil.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`Anvil exited unexpectedly with code ${code}`);
      shutdown();
      process.exit(1);
    }
  });

  await runBootStep('anvil.rpc', 'Wait for Anvil RPC', 25_000, async () => waitForRpc(RPC_URL));

  await runBootStep('contracts.deploy', 'Deploy contracts with forge', deployTimeoutMs, async () => runCommand(resolveFoundryBinary('forge'), [
    'script',
    'script/DeployXenovoya.s.sol',
    '--rpc-url', RPC_URL,
    '--broadcast',
    '--non-interactive',
  ], {
    env: { PRIVATE_KEY: ANVIL_PK },
    timeoutMs: deployTimeoutMs,
  }));

  const { workerAddrs, appAddrs, deckAddrs, byName } = await runBootStep(
    'contracts.addresses',
    'Extract broadcast addresses',
    10_000,
    readBroadcastAddresses,
  );

  await runBootStep(
    'contracts.wiring',
    'Verify local contract wiring',
    commandTimeoutMs,
    async () => ensureLocalWiring({ appAddrs, deckAddrs, byName }),
  );

  const deckDeployments = JSON.stringify(deckAddrs);
  const deckNames = ['EVENT', 'AMBUSH', 'TREASURE', 'LAND', 'RELIC'];
  for (const name of deckNames) {
    await runBootStep(`decks.${name.toLowerCase()}`, `Populate ${name} deck`, commandTimeoutMs, async () => runCommand('node', ['scripts/populate-decks.mjs'], {
      env: {
        CHAIN: 'foundry',
        RPC_URL,
        PRIVATE_KEY: ANVIL_PK,
        DEPLOYMENTS_JSON: deckDeployments,
        DECK_FILTER: name,
      },
      timeoutMs: commandTimeoutMs,
    }));
  }

  await runBootStep(
    'game.seed',
    `Seed open survey (mode=${mode}, players=${players})`,
    commandTimeoutMs,
    async () => seedOpenGame(appAddrs, players),
  );

  // 8. Write app/.env.local — must happen before bot scripts run because
  // register-bots reads VITE_* addresses from this file.
  await runBootStep(
    'app.env',
    'Write app local environment',
    10_000,
    async () => writeAppEnvLocal(appAddrs),
  );

  // 8b. Register bot players for multi mode.
  if (botCount > 0) {
    await runBootStep('bots.register', `Register ${botCount} bot player(s)`, commandTimeoutMs, async () => runCommand('node', ['scripts/register-bots.mjs', `--count=${botCount}`], {
      stdio: 'inherit',
      timeoutMs: commandTimeoutMs,
    }));
  } else if (flag('no-bots')) {
    log('Bot registration skipped (--no-bots).');
  }

  let latestHealthPaths;
  const healthOptions = () => ({
    rpcUrl: RPC_URL,
    appAddrs,
    byName,
    mode,
    players,
    flags: {
      skipWorker,
      skipVite,
      wantBots,
      botCount,
    },
    bootSteps,
    childProcesses: childProcessesSummary(),
    timeoutMs: readinessTimeoutMs,
  });

  await runBootStep('readiness.gate', 'Run local stack readiness gate', readinessTimeoutMs + 5_000, async () => {
    const report = await buildLocalStackHealth(healthOptions());
    latestHealthPaths = await writeLocalStackHealthReports(report);
    if (!report.ok) {
      console.error(markdownForLocalStackHealth(report));
      throw new Error(`Readiness gate failed; see ${latestHealthPaths.reportJsonPath}`);
    }
  });

  const workerDeployments = JSON.stringify(workerAddrs);
  if (!skipWorker) {
    await runBootStep('worker.start', 'Start automation worker', 10_000, async () => spawnChild('node', ['scripts/xenovoya-worker.mjs'], {
      env: {
        CHAIN: 'foundry',
        RPC_URL,
        PRIVATE_KEY: ANVIL_PK,
        DEPLOYMENTS_JSON: workerDeployments,
        POLL_INTERVAL_MS: '2000',
      },
      label: 'xenovoya-worker',
    }));
  } else {
    log('Automation worker skipped (--no-worker).');
  }

  // 9b. Auto-bot daemon — submits IDLE on bots' turns so the game advances
  // without human intervention. Only useful when bots are registered.
  if (botCount > 0) {
    await runBootStep('bots.auto.start', 'Start auto-bot daemon', 10_000, async () => spawnChild('node', ['scripts/auto-bots.mjs'], {
      env: {
        RPC_URL,
        POLL_INTERVAL_MS: '2000',
      },
      label: 'auto-bots',
    }));
  }

  // 10. Spawn Vite dev server
  if (!skipVite) {
    await runBootStep('vite.start', 'Start Vite dev server', 10_000, async () => spawnChild(resolveShellBinary('npm'), ['run', 'dev'], {
      cwd: appDir,
      stdio: 'inherit',
      label: 'vite',
    }));
  } else {
    log('Vite dev server skipped (--no-vite).');
  }

  const finalHealthReport = await buildLocalStackHealth(healthOptions());
  latestHealthPaths = await writeLocalStackHealthReports(finalHealthReport);
  if (!finalHealthReport.ok) {
    console.error(markdownForLocalStackHealth(finalHealthReport));
    throw new Error(`Final health check failed; see ${latestHealthPaths.reportJsonPath}`);
  }

  // 11. Print status banner
  const modeLine =
    mode === 'solo'
      ? 'Solo (1 player, you play through alone)'
      : mode === 'multi'
        ? `Multi (${players} players · ${botCount} bot${botCount === 1 ? '' : 's'} auto-piloted)`
        : `Classic (${players} players, no bots)`;

  console.log('\n' + '='.repeat(60));
  console.log('  Local Stack Running');
  console.log('='.repeat(60));
  console.log(`  Mode:       ${modeLine}`);
  console.log(`  Anvil RPC:  ${RPC_URL}`);
  console.log(`  Chain ID:   31337`);
  console.log(`  Frontend:   ${skipVite ? 'Skipped (--no-vite)' : 'http://localhost:5502'}`);
  console.log(`  Worker:     ${skipWorker ? 'Skipped (--no-worker)' : 'Running'}`);
  console.log(`  Health:     ${latestHealthPaths.reportJsonPath}`);
  console.log(`  Sentinel:   local-stack-ready`);
  console.log(`  Private Key (Anvil #0):`);
  console.log(`    ${ANVIL_PK}`);
  console.log();
  console.log('  MetaMask setup:');
  console.log(`    Network RPC: ${RPC_URL}`);
  console.log('    Chain ID:    31337');
  console.log(`    Import key:  ${ANVIL_PK}`);
  if (botCount > 0) {
    console.log();
    console.log(`  Bots auto-submit IDLE on their turn so multi-player`);
    console.log(`  rounds resolve while you play a single seat.`);
  }
  console.log('='.repeat(60));
  console.log('  local-stack-ready');
  console.log('  Press Ctrl+C to stop all processes.');
  console.log('='.repeat(60) + '\n');

  // 12. Keep alive — wait for signal
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('[local-stack] Fatal error:', err);
  shutdown();
  process.exit(1);
});
