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

const children = [];

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

function spawnChild(command, args, options = {}) {
  const defaultShell = command.toLowerCase().endsWith('.cmd');
  const child = spawn(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...(options.env || {}) },
    shell: options.shell ?? defaultShell,
    stdio: options.stdio ?? 'inherit',
  });
  children.push(child);
  return child;
}

// ── Address extraction ───────────────────────────────────────────────

async function readBroadcastAddresses() {
  const raw = await fs.readFile(broadcastLatest, 'utf8');
  const json = JSON.parse(raw);

  const byName = {};
  const cardDecks = [];

  for (const tx of json.transactions || []) {
    if (!tx.contractName || !tx.contractAddress) continue;

    if (tx.contractName === 'CardDeck') {
      cardDecks.push(tx.contractAddress);
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
  // 1. Check port
  if (!(await isPortAvailable(ANVIL_PORT))) {
    console.error(`ERROR: Port ${ANVIL_PORT} is already in use. Set ANVIL_PORT env var or free the port.`);
    process.exit(1);
  }

  // 2. Start Anvil
  log(`Starting Anvil on port ${ANVIL_PORT}...`);
  const anvil = spawnChild(resolveFoundryBinary('anvil'), [
    '--host', '127.0.0.1',
    '--port', String(ANVIL_PORT),
    '--chain-id', '31337',
  ], { shell: false, stdio: 'inherit' });

  anvil.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`Anvil exited unexpectedly with code ${code}`);
      shutdown();
      process.exit(1);
    }
  });

  // 3. Wait for RPC readiness
  log('Waiting for Anvil RPC...');
  await waitForRpc(RPC_URL);
  log('Anvil is ready.');

  // 4. Deploy contracts
  log('Deploying contracts (forge script)...');
  await runCommand(resolveFoundryBinary('forge'), [
    'script',
    'script/DeployXenovoya.s.sol',
    '--rpc-url', RPC_URL,
    '--broadcast',
    '--non-interactive',
  ], {
    env: { PRIVATE_KEY: ANVIL_PK },
  });
  log('Contracts deployed.');

  // 5. Extract addresses
  const { workerAddrs, appAddrs, deckAddrs } = await readBroadcastAddresses();
  log('Addresses extracted from broadcast.');

  // 6. Populate card decks sequentially to avoid nonce collisions on Anvil.
  log('Populating card decks...');
  const deckDeployments = JSON.stringify(deckAddrs);
  const deckNames = ['EVENT', 'AMBUSH', 'TREASURE', 'LAND', 'RELIC'];
  for (const name of deckNames) {
    await runCommand('node', ['scripts/populate-decks.mjs'], {
      env: {
        CHAIN: 'foundry',
        RPC_URL,
        PRIVATE_KEY: ANVIL_PK,
        DEPLOYMENTS_JSON: deckDeployments,
        DECK_FILTER: name,
      },
    });
  }
  log('Card decks populated.');

  // 7. Seed an open survey at the chosen player count
  log(`Seeding open survey (mode=${mode}, players=${players})...`);
  await seedOpenGame(appAddrs, players);
  log('Survey seeded.');

  // 8. Write app/.env.local — must happen before bot scripts run because
  // register-bots reads VITE_* addresses from this file.
  await writeAppEnvLocal(appAddrs);

  // 8b. Register bot players for multi mode.
  if (botCount > 0) {
    log(`Registering ${botCount} bot player(s)...`);
    await runCommand('node', ['scripts/register-bots.mjs', `--count=${botCount}`], {
      stdio: 'inherit',
    });
  }

  // 9. Spawn the VRF + loop worker (handles mock VRF fulfilment automatically).
  log('Starting automation worker...');
  const workerDeployments = JSON.stringify(workerAddrs);
  spawnChild('node', ['scripts/xenovoya-worker.mjs'], {
    env: {
      CHAIN: 'foundry',
      RPC_URL,
      PRIVATE_KEY: ANVIL_PK,
      DEPLOYMENTS_JSON: workerDeployments,
      POLL_INTERVAL_MS: '2000',
    },
  });

  // 9b. Auto-bot daemon — submits IDLE on bots' turns so the game advances
  // without human intervention. Only useful when bots are registered.
  if (botCount > 0) {
    log('Starting auto-bot daemon...');
    spawnChild('node', ['scripts/auto-bots.mjs'], {
      env: {
        RPC_URL,
        POLL_INTERVAL_MS: '2000',
      },
    });
  }

  // 10. Spawn Vite dev server
  log('Starting Vite dev server...');
  spawnChild(resolveShellBinary('npm'), ['run', 'dev'], {
    cwd: appDir,
    stdio: 'inherit',
  });

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
  console.log(`  Frontend:   http://localhost:5502`);
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
