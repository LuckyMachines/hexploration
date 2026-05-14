#!/usr/bin/env node
/**
 * Same-engine gameplay simulator for Xenovoya.
 *
 * This does not reimplement gameplay rules in JS. It drives the local Anvil
 * deployment through the same contracts used by the app:
 * - XenovoyaController.submitAction
 * - GameSetup / Controller / Gameplay progressLoop
 * - GameSetup / Queue mock VRF fulfillment
 *
 * Typical flow:
 *   npm run local:solo
 *   node scripts/gameplay-simulator.mjs --turns=8 --players=1 --strategy=balanced
 *
 * The run emits:
 * - reports/simulator/latest-report.json
 * - app/public/simulator/latest-report.json
 */
import { createPublicClient, createWalletClient, http } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ANVIL_KEYS, DEPLOYER_KEY } from './anvil-keys.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const appDir = resolve(root, 'app');
const appEnvPath = resolve(appDir, '.env.local');
const broadcastLatest = resolve(root, 'broadcast', 'DeployXenovoya.s.sol', '31337', 'run-latest.json');
const reportDir = resolve(root, 'reports', 'simulator');
const publicReportDir = resolve(appDir, 'public', 'simulator');
const tuningConfigPath = resolve(root, 'simulator.tuning.json');
const defaultBaselinePath = resolve(reportDir, 'baseline-report.json');
const tuningLedgerPath = resolve(reportDir, 'tuning-ledger.json');

const args = process.argv.slice(2);

function arg(name, fallback) {
  const found = args.find((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!found) return fallback;
  const eq = found.indexOf('=');
  return eq >= 0 ? found.slice(eq + 1) : true;
}

function boolArg(name, fallback = false) {
  const value = arg(name, fallback);
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'no'].includes(String(value).toLowerCase());
}

const SCENARIOS = {
  'solo-balanced': { players: 1, turns: 12, strategy: 'balanced', batch: 1, label: 'Solo Balanced' },
  'solo-risky': { players: 1, turns: 12, strategy: 'risky', batch: 1, label: 'Solo Risky' },
  'solo-dig-rush': { players: 1, turns: 12, strategy: 'dig', batch: 1, label: 'Solo Dig Rush' },
  'solo-escape-rush': { players: 1, turns: 12, strategy: 'risky', batch: 1, label: 'Solo Escape Rush' },
  '4p-cautious': { players: 4, turns: 10, strategy: 'rest', batch: 1, label: '4P Cautious' },
  '4p-chaos': { players: 4, turns: 10, strategy: 'risky', batch: 1, label: '4P Chaos' },
  benchmark: {
    players: 1,
    turns: 10,
    strategy: 'balanced',
    strategies: 'balanced,risky,dig,move,rest,idle',
    batch: 1,
    label: 'Golden Benchmark',
  },
};

const scenarioName = String(arg('scenario', 'solo-balanced'));
const scenario = SCENARIOS[scenarioName] || {};

const config = {
  rpcUrl: String(arg('rpc', process.env.RPC_URL || 'http://127.0.0.1:9955')),
  scenario: scenarioName,
  scenarioLabel: String(scenario.label || scenarioName),
  turns: Math.max(1, Number(arg('turns', scenario.turns || 8))),
  players: Math.max(1, Math.min(4, Number(arg('players', scenario.players || 1)))),
  strategy: String(arg('strategy', scenario.strategy || 'balanced')),
  strategies: String(arg('strategies', scenario.strategies || '')).split(',').map((value) => value.trim()).filter(Boolean),
  batch: Math.max(1, Number(arg('batch', scenario.batch || 1))),
  seed: String(arg('seed', process.env.SIM_SEED || 'default')),
  note: String(arg('note', '')),
  hypothesis: String(arg('hypothesis', '')),
  changed: String(arg('changed', '')),
  baseline: arg('baseline', null),
  saveBaseline: boolArg('save-baseline', false),
  gameId: arg('game', null),
  createGame: boolArg('create', true),
  progressAttempts: Math.max(1, Number(arg('progress-attempts', 12))),
  quiet: boolArg('quiet', false),
};
if (config.strategies.length === 0) config.strategies = [config.strategy];

const DEFAULT_TUNING_CONFIG = {
  targets: {
    idleShare: { max: 0.15, label: 'Idle action share' },
    restShare: { max: 0.3, label: 'Rest action share' },
    moveShare: { min: 0.25, label: 'Move action share' },
    meaningfulChoiceDensity: { min: 0.5, label: 'Meaningful choice density' },
    boringTurns: { max: 1.5, label: 'Average boring turns' },
    invalidAttempts: { max: 2, label: 'Average invalid attempts' },
    revealedZones: { min: 1.5, label: 'Average zones revealed' },
    zeroStatPlayers: { max: 0.25, label: 'Average zero-stat players' },
  },
  scenarioGoals: {
    'solo-balanced': {
      revealedZones: { min: 1 },
      meaningfulChoiceDensity: { min: 0.45 },
      boringTurns: { max: 2 },
    },
    'solo-risky': {
      spikeTurns: { min: 1 },
      artifacts: { min: 0.25 },
      zeroStatPlayers: { max: 1 },
    },
    'solo-dig-rush': {
      artifacts: { min: 0.25 },
      revealedZones: { min: 1 },
    },
    'solo-escape-rush': {
      artifacts: { min: 0.25 },
      boringTurns: { max: 2 },
    },
    '4p-cautious': {
      zeroStatPlayers: { max: 0.75 },
      meaningfulChoiceDensity: { min: 0.35 },
    },
    '4p-chaos': {
      spikeTurns: { min: 1 },
      invalidAttempts: { max: 4 },
    },
    benchmark: {
      revealedZones: { min: 1.5 },
      meaningfulChoiceDensity: { min: 0.5 },
      boringTurns: { max: 1.5 },
      invalidAttempts: { max: 2 },
    },
  },
  taskHints: {
    idleShare: 'Broaden valid actions or make the fallback state more expressive.',
    restShare: 'Lower passive stat pressure or raise active-recovery rewards.',
    moveShare: 'Make movement cheaper, clearer, or more rewarding in early turns.',
    meaningfulChoiceDensity: 'Add more valid alternatives per state and expose why they matter.',
    boringTurns: 'Add earlier discovery, pressure, card feedback, or board-state deltas.',
    invalidAttempts: 'Tune strategy heuristics or improve action-validity affordances.',
    revealedZones: 'Improve exploration incentives and reachable tile generation.',
    zeroStatPlayers: 'Reduce stat collapse or introduce better rescue/recovery loops.',
    artifacts: 'Increase dig payoff clarity or route players toward artifact opportunities.',
    spikeTurns: 'Increase volatility for this scenario through events, cards, or risk rewards.',
  },
};

const ACTION = {
  IDLE: 0,
  MOVE: 1,
  SETUP_CAMP: 2,
  BREAK_DOWN_CAMP: 3,
  DIG: 4,
  REST: 5,
  HELP: 6,
  FLEE: 7,
};

const ACTION_LABEL = {
  [ACTION.IDLE]: 'Idle',
  [ACTION.MOVE]: 'Move',
  [ACTION.SETUP_CAMP]: 'Camp',
  [ACTION.BREAK_DOWN_CAMP]: 'Pack Camp',
  [ACTION.DIG]: 'Dig',
  [ACTION.REST]: 'Rest',
  [ACTION.HELP]: 'Help',
  [ACTION.FLEE]: 'Flee',
};

const PROCESSING_PHASE = {
  START: 0,
  SUBMISSION: 1,
  PROCESSING: 2,
  PLAY_THROUGH: 3,
  PROCESSED: 4,
  CLOSED: 5,
  FAILED: 6,
};

const PHASE_LABEL = {
  [PROCESSING_PHASE.START]: 'Start',
  [PROCESSING_PHASE.SUBMISSION]: 'Submission',
  [PROCESSING_PHASE.PROCESSING]: 'Processing',
  [PROCESSING_PHASE.PLAY_THROUGH]: 'Play Through',
  [PROCESSING_PHASE.PROCESSED]: 'Processed',
  [PROCESSING_PHASE.CLOSED]: 'Closed',
  [PROCESSING_PHASE.FAILED]: 'Failed',
};

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

function log(message) {
  if (!config.quiet) console.log(`[simulator] ${message}`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function mergeTuningConfig(base, override = {}) {
  return {
    targets: { ...(base.targets || {}), ...(override.targets || {}) },
    scenarioGoals: { ...(base.scenarioGoals || {}), ...(override.scenarioGoals || {}) },
    taskHints: { ...(base.taskHints || {}), ...(override.taskHints || {}) },
  };
}

function loadTuningConfig() {
  if (!existsSync(tuningConfigPath)) return DEFAULT_TUNING_CONFIG;
  return mergeTuningConfig(DEFAULT_TUNING_CONFIG, readJson(tuningConfigPath));
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const parsed = dotenv.parse(readFileSync(path, 'utf8'));
  return parsed || {};
}

function readBroadcastAddresses() {
  if (!existsSync(broadcastLatest)) return {};
  const json = readJson(broadcastLatest);
  const byName = {};
  for (const tx of json.transactions || []) {
    if (tx.contractName && tx.contractAddress) byName[tx.contractName] = tx.contractAddress;
  }
  return byName;
}

function requireAddress(addresses, key) {
  const value = addresses[key];
  if (!value) throw new Error(`Missing ${key}. Run npm run local:solo or npm run local:multi first.`);
  return value;
}

function loadAddresses() {
  const env = { ...readEnvFile(appEnvPath), ...process.env };
  const broadcast = readBroadcastAddresses();
  const addresses = {
    BOARD: env.VITE_BOARD_ADDRESS || broadcast.XenovoyaBoard,
    CONTROLLER: env.VITE_CONTROLLER_ADDRESS || broadcast.XenovoyaController,
    GAME_SUMMARY: env.VITE_GAME_SUMMARY_ADDRESS || broadcast.GameSummary,
    PLAYER_SUMMARY: env.VITE_PLAYER_SUMMARY_ADDRESS || broadcast.PlayerSummary,
    GAME_REGISTRY: env.VITE_GAME_REGISTRY_ADDRESS || broadcast.GameRegistry,
    GAME_SETUP: env.VITE_GAME_SETUP_ADDRESS || broadcast.GameSetup,
    QUEUE: env.VITE_GAME_QUEUE_ADDRESS || broadcast.XenovoyaQueue,
    GAMEPLAY: broadcast.XenovoyaGameplay || env.GAMEPLAY,
  };

  for (const key of ['BOARD', 'CONTROLLER', 'GAME_SUMMARY', 'PLAYER_SUMMARY', 'GAME_REGISTRY', 'GAME_SETUP', 'QUEUE', 'GAMEPLAY']) {
    requireAddress(addresses, key);
  }
  return addresses;
}

const abis = {
  controller: readJson(resolve(root, 'abi', 'XenovoyaController.json')),
  gameSummary: readJson(resolve(root, 'abi', 'GameSummary.json')),
  playerSummary: readJson(resolve(root, 'abi', 'PlayerSummary.json')),
  queue: readJson(resolve(root, 'abi', 'XenovoyaQueue.json')),
  board: readJson(resolve(root, 'abi', 'XenovoyaBoard.json')),
  vrf: [
    { inputs: [], name: 'getMockRequests', outputs: [{ type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
    { inputs: [], name: 'fulfillMockRandomness', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  ],
  loop: [
    {
      inputs: [],
      name: 'shouldProgressLoop',
      outputs: [
        { name: 'loopIsReady', type: 'bool' },
        { name: 'progressWithData', type: 'bytes' },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    { inputs: [{ name: 'progressWithData', type: 'bytes' }], name: 'progressLoop', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  ],
};

const transport = http(config.rpcUrl);
const publicClient = createPublicClient({ chain: foundry, transport });
const deployer = privateKeyToAccount(DEPLOYER_KEY);
const deployerWallet = createWalletClient({ chain: foundry, transport, account: deployer });

function walletForIndex(index) {
  const key = ANVIL_KEYS[index + 1];
  if (!key) throw new Error(`No Anvil key for simulator player index ${index}`);
  const account = privateKeyToAccount(key);
  return {
    account,
    wallet: createWalletClient({ chain: foundry, transport, account }),
  };
}

async function waitReceipt(hash) {
  return publicClient.waitForTransactionReceipt({ hash });
}

async function readContract(address, abi, functionName, argsRead = []) {
  return publicClient.readContract({ address, abi, functionName, args: argsRead });
}

async function writeContract(wallet, address, abi, functionName, argsWrite = []) {
  const hash = await wallet.writeContract({ address, abi, functionName, args: argsWrite });
  return waitReceipt(hash);
}

function getAdjacent(alias) {
  const [colRaw, rowRaw] = String(alias || '').split(',');
  const col = Number(colRaw);
  const row = Number(rowRaw);
  if (!Number.isFinite(col) || !Number.isFinite(row)) return [];
  const odd = col % 2 === 1;
  const pairs = odd
    ? [[col + 1, row], [col + 1, row + 1], [col, row + 1], [col - 1, row + 1], [col - 1, row], [col, row - 1]]
    : [[col + 1, row - 1], [col + 1, row], [col, row + 1], [col - 1, row], [col - 1, row - 1], [col, row - 1]];
  return pairs.map(([c, r]) => `${c},${r}`);
}

function bigintReplacer(_, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stableHash(parts) {
  const text = parts.filter((part) => part !== undefined && part !== null).join('|');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33 + text.charCodeAt(index)) % 1000003;
  }
  return Math.abs(hash);
}

function statTotal(player) {
  return (player?.stats?.movement || 0) + (player?.stats?.agility || 0) + (player?.stats?.dexterity || 0);
}

function allArtifacts(snapshotData) {
  return (snapshotData?.players || []).reduce((sum, player) => sum + (player.artifacts?.length || 0), 0);
}

function totalStats(snapshotData) {
  return (snapshotData?.players || []).reduce((sum, player) => sum + statTotal(player), 0);
}

function zeroStatPlayers(snapshotData) {
  return (snapshotData?.players || []).filter((player) => (
    (player.stats?.movement || 0) <= 0
    || (player.stats?.agility || 0) <= 0
    || (player.stats?.dexterity || 0) <= 0
  )).length;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const FUN_CAUSE_LIBRARY = {
  noBoardDelta: {
    label: 'No board delta',
    system: 'board',
    suggestion: 'Add an early reveal ping, route preview, or tile-state marker when a turn otherwise changes nothing.',
    blastRadius: 'low',
  },
  noStatDelta: {
    label: 'No stat delta',
    system: 'stats',
    suggestion: 'Make quiet turns nudge a stat, condition label, or visible pressure meter so the body still feels present.',
    blastRadius: 'low',
  },
  noCardResult: {
    label: 'No card result',
    system: 'cards',
    suggestion: 'Trigger a low-impact card, ambient omen, or card preview after repeated quiet turns.',
    blastRadius: 'medium',
  },
  noArtifactPayoff: {
    label: 'No artifact payoff',
    system: 'artifacts',
    suggestion: 'Raise dig feedback first: show clue, partial progress, or artifact odds before changing reward math.',
    blastRadius: 'low',
  },
  repeatedAction: {
    label: 'Repeated action',
    system: 'pacing',
    suggestion: 'Add a soft bonus or different feedback when the same action repeats twice in a row.',
    blastRadius: 'medium',
  },
  oneChoice: {
    label: 'Only one practical choice',
    system: 'action-validity',
    suggestion: 'Expose one additional valid alternative in this state or explain why other actions are locked.',
    blastRadius: 'medium',
  },
  invalidFriction: {
    label: 'Invalid action friction',
    system: 'ui-feedback',
    suggestion: 'Surface the first invalid reason before submit and bias the bot away from that failed option.',
    blastRadius: 'low',
  },
  statCollapse: {
    label: 'Stat collapse',
    system: 'stats',
    suggestion: 'Add a rescue/recovery affordance at one-stat danger before reducing global pressure.',
    blastRadius: 'medium',
  },
  restDominance: {
    label: 'Rest dominance',
    system: 'stats',
    suggestion: 'Make active play recover small amounts too, so rest is not the only readable safety valve.',
    blastRadius: 'medium',
  },
  movementFriction: {
    label: 'Movement friction',
    system: 'movement',
    suggestion: 'Make the first move step easier to plan or reward movement with a visible board change sooner.',
    blastRadius: 'medium',
  },
  rewardMoment: {
    label: 'Reward moment',
    system: 'artifacts',
    suggestion: 'Protect this beat: add stronger artifact presentation before changing its odds.',
    blastRadius: 'low',
  },
  discoveryMoment: {
    label: 'Discovery moment',
    system: 'board',
    suggestion: 'Use this reveal pattern as the baseline for earlier flat turns.',
    blastRadius: 'low',
  },
  cardMoment: {
    label: 'Card moment',
    system: 'cards',
    suggestion: 'Preserve this card feedback and make similar outcomes as legible in quiet turns.',
    blastRadius: 'low',
  },
};

function funCause(key, evidence) {
  const cause = FUN_CAUSE_LIBRARY[key] || FUN_CAUSE_LIBRARY.noBoardDelta;
  return { key, ...cause, evidence };
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function sortedCounts(counts) {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function createGame(addresses, players = config.players) {
  log(`creating ${players}-player simulator game`);
  await writeContract(deployerWallet, addresses.CONTROLLER, abis.controller, 'requestNewGame', [
    addresses.GAME_REGISTRY,
    addresses.BOARD,
    BigInt(players),
  ]);
  await progressEngine(addresses);

  const latest = await readContract(addresses.CONTROLLER, abis.controller, 'latestGame', [
    addresses.GAME_REGISTRY,
    addresses.BOARD,
  ]);
  if (latest === 0n) throw new Error('Game creation did not produce a latest game id.');
  return latest;
}

async function pickOpenGame(addresses) {
  const [gameIds, maxPlayers, registrations] = await readContract(
    addresses.GAME_SUMMARY,
    abis.gameSummary,
    'getAvailableGames',
    [addresses.BOARD, addresses.GAME_REGISTRY],
  );
  const index = gameIds.findIndex((_, i) => Number(registrations[i]) < Number(maxPlayers[i]));
  if (index === -1) return null;
  return gameIds[index];
}

async function ensureGame(addresses) {
  if (config.gameId) return BigInt(config.gameId);
  if (config.createGame) return createGame(addresses, config.players);
  const openGame = await pickOpenGame(addresses);
  if (!openGame) throw new Error('No open game found. Re-run with --create=true or start npm run local:solo.');
  return openGame;
}

async function ensureGameForRun(addresses, runConfig) {
  if (runConfig.gameId) return BigInt(runConfig.gameId);
  if (runConfig.createGame) return createGame(addresses, runConfig.players);
  const openGame = await pickOpenGame(addresses);
  if (!openGame) throw new Error('No open game found. Re-run with --create=true or start npm run local:solo.');
  return openGame;
}

async function registerPlayers(addresses, gameId, players = config.players) {
  const seats = [];
  for (let index = 0; index < players; index += 1) {
    const seat = walletForIndex(index);
    try {
      await writeContract(seat.wallet, addresses.CONTROLLER, abis.controller, 'registerForGame', [gameId, addresses.BOARD]);
      log(`registered P${index + 1} ${seat.account.address}`);
    } catch (error) {
      const message = error.shortMessage || error.message || String(error);
      if (!/already registered|game full|not open|active/i.test(message)) {
        log(`registration warning for ${seat.account.address}: ${message.split('\n')[0]}`);
      }
    }

    let playerId = 0n;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      playerId = await readContract(addresses.PLAYER_SUMMARY, abis.playerSummary, 'getPlayerID', [
        addresses.BOARD,
        gameId,
        seat.account.address,
      ]).catch(() => 0n);
      if (playerId > 0n) break;
      await sleep(250);
    }
    seats.push({ ...seat, playerId });
  }
  return seats.filter((seat) => seat.playerId > 0n);
}

async function currentQueueId(addresses, gameId) {
  return readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'currentGameplayQueue', [addresses.BOARD, gameId]);
}

async function getPhase(addresses, queueId) {
  try {
    const phase = await readContract(addresses.QUEUE, abis.queue, 'currentPhase', [queueId]);
    return Number(phase);
  } catch {
    return -1;
  }
}

async function snapshot(addresses, gameId, seats, label) {
  const [phase, day, queueId, totalPlayers, locations, inventories, activeZones, lastDayEvents, gameOver] = await Promise.all([
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'currentPhase', [addresses.BOARD, gameId]).catch(() => 'Unknown'),
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'currentDay', [addresses.BOARD, gameId]).catch(() => 0n),
    currentQueueId(addresses, gameId).catch(() => 0n),
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'totalPlayers', [addresses.BOARD, gameId]).catch(() => 0n),
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'allPlayerLocations', [addresses.BOARD, gameId]).catch(() => [[], []]),
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'allPlayerActiveInventories', [addresses.BOARD, gameId]).catch(() => [[], [], [], [], [], [], [], []]),
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'activeZones', [addresses.BOARD, gameId]).catch(() => [[], [], []]),
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'lastDayPhaseEvents', [addresses.BOARD, gameId]).catch(() => [[], [], [], [], [], []]),
    readContract(addresses.BOARD, abis.board, 'gameOver', [gameId]).catch(() => false),
  ]);

  const players = [];
  for (const seat of seats) {
    const [stats, location, action, movement, active, artifacts] = await Promise.all([
      readContract(addresses.PLAYER_SUMMARY, abis.playerSummary, 'currentPlayerStats', [addresses.BOARD, gameId, seat.playerId]).catch(() => [0, 0, 0]),
      readContract(addresses.PLAYER_SUMMARY, abis.playerSummary, 'currentLocation', [addresses.BOARD, gameId, seat.playerId]).catch(() => ''),
      readContract(addresses.PLAYER_SUMMARY, abis.playerSummary, 'activeAction', [addresses.BOARD, gameId, seat.playerId]).catch(() => ''),
      readContract(addresses.PLAYER_SUMMARY, abis.playerSummary, 'availableMovement', [addresses.BOARD, gameId, seat.playerId]).catch(() => 0),
      readContract(addresses.PLAYER_SUMMARY, abis.playerSummary, 'activeInventory', [addresses.BOARD, gameId, seat.playerId]).catch(() => ['', '', '', false, false, '', '']),
      readContract(addresses.PLAYER_SUMMARY, abis.playerSummary, 'playerRecoveredArtifacts', [addresses.BOARD, gameId, seat.playerId]).catch(() => []),
    ]);
    players.push({
      playerId: seat.playerId,
      address: seat.account.address,
      location,
      action,
      movement: toNumber(movement),
      stats: {
        movement: toNumber(stats[0]),
        agility: toNumber(stats[1]),
        dexterity: toNumber(stats[2]),
      },
      inventory: {
        artifact: active[0] || '',
        status: active[1] || '',
        relic: active[2] || '',
        shield: Boolean(active[3]),
        campsite: Boolean(active[4]),
        leftHandItem: active[5] || '',
        rightHandItem: active[6] || '',
      },
      artifacts: Array.from(artifacts || []),
    });
  }

  return {
    label,
    day: toNumber(day),
    phase,
    queueId,
    queuePhase: PHASE_LABEL[await getPhase(addresses, queueId)] || 'Unknown',
    totalPlayers: toNumber(totalPlayers),
    locations: {
      playerIds: Array.from(locations[0] || []).map(String),
      zones: Array.from(locations[1] || []),
    },
    inventoryPlayerIds: Array.from(inventories[0] || []).map(String),
    activeZones: {
      count: Array.from(activeZones[0] || []).length,
      zones: Array.from(activeZones[0] || []),
      tiles: Array.from(activeZones[1] || []).map(Number),
      campsites: Array.from(activeZones[2] || []).map(Boolean),
    },
    lastDayEvents: {
      playerIds: Array.from(lastDayEvents[0] || []).map(String),
      cardTypes: Array.from(lastDayEvents[1] || []),
      cardsDrawn: Array.from(lastDayEvents[2] || []),
      cardResults: Array.from(lastDayEvents[3] || []),
      inventoryChanges: Array.from(lastDayEvents[4] || []),
      statUpdates: Array.from(lastDayEvents[5] || []),
    },
    gameOver: Boolean(gameOver),
    players,
  };
}

async function findMovePath(addresses, gameId, player) {
  const [zones] = await readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'activeZones', [
    addresses.BOARD,
    gameId,
  ]).catch(() => [[]]);
  const revealed = new Set(Array.from(zones || []));
  const adjacent = getAdjacent(player.location);
  const target = adjacent.find((alias) => revealed.has(alias));
  return target ? [target] : [];
}

function plannedActionFor(strategy, turn, playerIndex, player, context) {
  const offset = stableHash([context.seed, context.runIndex, playerIndex]) % 5;
  if (strategy === 'idle') return { action: ACTION.IDLE, options: [], reason: 'idle baseline' };
  if (strategy === 'dig') return { action: ACTION.DIG, options: [], reason: 'dig focus' };
  if (strategy === 'rest') return { action: ACTION.REST, options: ['Movement'], reason: 'rest focus' };
  if (strategy === 'move') return { action: ACTION.MOVE, options: context.movePath, reason: 'move focus' };
  if (strategy === 'risky') {
    const cycle = [ACTION.DIG, ACTION.MOVE, ACTION.DIG, ACTION.FLEE, ACTION.REST];
    return { action: cycle[(turn + playerIndex + offset) % cycle.length], options: [], reason: 'risky cycle' };
  }

  if (player.stats.movement <= 1 || player.stats.agility <= 1 || player.stats.dexterity <= 1) {
    return { action: ACTION.REST, options: ['Movement'], reason: 'recover low stats' };
  }
  const cycle = [ACTION.MOVE, ACTION.DIG, ACTION.REST, ACTION.MOVE, ACTION.SETUP_CAMP];
  return { action: cycle[(turn + playerIndex + offset) % cycle.length], options: [], reason: 'balanced cycle' };
}

async function isValidAction(addresses, gameId, playerId, plan) {
  try {
    const [ok, reason] = await readContract(addresses.CONTROLLER, abis.controller, 'actionIsValid', [
      Number(plan.action),
      plan.options || [],
      '',
      '',
      gameId,
      addresses.BOARD,
      playerId,
    ]);
    return { ok: Boolean(ok), reason };
  } catch (error) {
    return { ok: false, reason: error.shortMessage || error.message || String(error) };
  }
}

async function chooseAction(addresses, gameId, turn, playerIndex, player, runConfig) {
  const movePath = await findMovePath(addresses, gameId, player);
  const candidates = [];
  const primary = plannedActionFor(runConfig.strategy, turn, playerIndex, player, {
    movePath,
    seed: runConfig.seed,
    runIndex: runConfig.runIndex,
  });
  if (primary.action === ACTION.MOVE) primary.options = movePath;
  candidates.push(primary);
  candidates.push({ action: ACTION.MOVE, options: movePath, reason: 'valid move fallback' });
  candidates.push({ action: ACTION.DIG, options: [], reason: 'dig fallback' });
  candidates.push({ action: ACTION.REST, options: ['Movement'], reason: 'rest fallback' });
  candidates.push({ action: ACTION.IDLE, options: [], reason: 'idle fallback' });

  const validityLog = [];
  for (const plan of candidates) {
    if (plan.action === ACTION.MOVE && plan.options.length === 0) continue;
    const validity = await isValidAction(addresses, gameId, player.playerId, plan);
    validityLog.push({
      action: ACTION_LABEL[plan.action],
      actionIndex: plan.action,
      ok: validity.ok,
      reason: validity.reason,
    });
    if (validity.ok) {
      return {
        ...plan,
        validity,
        validChoiceCount: validityLog.filter((entry) => entry.ok).length,
        invalidAttempts: validityLog.filter((entry) => !entry.ok).length,
        validityLog,
      };
    }
  }
  return {
    action: ACTION.IDLE,
    options: [],
    reason: 'forced idle fallback',
    validity: { ok: true, reason: '' },
    validChoiceCount: 1,
    invalidAttempts: validityLog.length,
    validityLog,
  };
}

async function submitTurnActions(addresses, gameId, queueId, turn, seats, beforeSnapshot, runConfig) {
  const submissions = [];
  for (let index = 0; index < seats.length; index += 1) {
    const seat = seats[index];
    const submitted = await readContract(addresses.QUEUE, abis.queue, 'playerSubmitted', [queueId, seat.playerId]).catch(() => false);
    if (submitted) {
      submissions.push({ playerId: seat.playerId, skipped: true, reason: 'already submitted' });
      continue;
    }

    const player = beforeSnapshot.players.find((entry) => String(entry.playerId) === String(seat.playerId));
    const plan = await chooseAction(addresses, gameId, turn, index, player || { playerId: seat.playerId, location: '', stats: {} }, runConfig);
    try {
      const receipt = await writeContract(seat.wallet, addresses.CONTROLLER, abis.controller, 'submitAction', [
        seat.playerId,
        Number(plan.action),
        plan.options || [],
        '',
        '',
        gameId,
        addresses.BOARD,
      ]);
      submissions.push({
        playerId: seat.playerId,
        address: seat.account.address,
        action: ACTION_LABEL[plan.action],
        actionIndex: plan.action,
        options: plan.options || [],
        reason: plan.reason,
        validChoiceCount: plan.validChoiceCount,
        invalidAttempts: plan.invalidAttempts,
        validityLog: plan.validityLog,
        blockNumber: receipt.blockNumber,
        transactionHash: receipt.transactionHash,
      });
      log(`turn ${turn} P${seat.playerId} -> ${ACTION_LABEL[plan.action]} ${plan.options?.join(' -> ') || ''}`);
    } catch (error) {
      submissions.push({
        playerId: seat.playerId,
        action: ACTION_LABEL[plan.action],
        error: error.shortMessage || error.message || String(error),
      });
      log(`turn ${turn} P${seat.playerId} submit failed: ${submissions[submissions.length - 1].error.split('\n')[0]}`);
    }
  }
  return submissions;
}

async function fulfillMockVRF(label, address) {
  const requests = await readContract(address, abis.vrf, 'getMockRequests').catch(() => []);
  const pending = Array.from(requests || []).filter((request) => BigInt(request) > 0n);
  if (pending.length === 0) return false;
  await writeContract(deployerWallet, address, abis.vrf, 'fulfillMockRandomness');
  log(`${label} VRF fulfilled (${pending.length} request${pending.length === 1 ? '' : 's'})`);
  return true;
}

async function progressLoop(label, address) {
  const result = await readContract(address, abis.loop, 'shouldProgressLoop').catch(() => [false, '0x']);
  const ready = Boolean(result[0]);
  const data = result[1];
  if (!ready) return false;
  await writeContract(deployerWallet, address, abis.loop, 'progressLoop', [data]);
  log(`${label} loop progressed`);
  return true;
}

async function progressEngine(addresses) {
  let progressCount = 0;
  for (let attempt = 0; attempt < config.progressAttempts; attempt += 1) {
    let progressed = false;
    progressed = await fulfillMockVRF('GameSetup', addresses.GAME_SETUP) || progressed;
    progressed = await fulfillMockVRF('Queue', addresses.QUEUE) || progressed;
    progressed = await progressLoop('GameSetup', addresses.GAME_SETUP) || progressed;
    progressed = await progressLoop('Controller', addresses.CONTROLLER) || progressed;
    progressed = await progressLoop('Gameplay', addresses.GAMEPLAY) || progressed;
    if (progressed) progressCount += 1;
    if (!progressed) break;
    await sleep(350);
  }
  return progressCount;
}

function analyzeTurn(turn, previousAnalysis = null) {
  const before = turn.before;
  const after = turn.after;
  const submissions = turn.submissions || [];
  const beforeStats = totalStats(before);
  const afterStats = totalStats(after);
  const beforeArtifacts = allArtifacts(before);
  const afterArtifacts = allArtifacts(after);
  const statDelta = afterStats - beforeStats;
  const artifactDelta = afterArtifacts - beforeArtifacts;
  const locationChanges = (after?.players || []).filter((player) => {
    const previous = before?.players?.find((entry) => String(entry.playerId) === String(player.playerId));
    return previous && previous.location !== player.location;
  }).length;
  const revealedDelta = (after?.activeZones?.count || 0) - (before?.activeZones?.count || 0);
  const cardDraws = after?.lastDayEvents?.cardsDrawn?.filter(Boolean)?.length || 0;
  const invalidAttempts = submissions.reduce((sum, submission) => sum + (submission.invalidAttempts || 0), 0);
  const validChoiceCounts = submissions.map((submission) => submission.validChoiceCount || 0).filter((count) => count > 0);
  const meaningfulChoiceDensity = validChoiceCounts.length > 0
    ? validChoiceCounts.filter((count) => count > 1).length / validChoiceCounts.length
    : 0;
  const zeroStats = zeroStatPlayers(after);
  const actions = submissions.map((submission) => submission.action).filter(Boolean);
  const uniqueActions = new Set(actions);
  const errors = submissions.filter((submission) => submission.error);
  const changed = Math.abs(statDelta) > 0 || artifactDelta > 0 || locationChanges > 0 || revealedDelta > 0 || cardDraws > 0;
  const boring = !turn.skipped && !changed && errors.length === 0;
  const spikeReasons = [];
  if (statDelta <= -3) spikeReasons.push(`stat drop ${statDelta}`);
  if (artifactDelta > 0) spikeReasons.push(`artifact gain ${artifactDelta}`);
  if (revealedDelta >= 2) spikeReasons.push(`revealed ${revealedDelta} zones`);
  if (zeroStats > 0) spikeReasons.push(`${zeroStats} zero-stat player${zeroStats === 1 ? '' : 's'}`);
  if (errors.length > 0) spikeReasons.push(`${errors.length} submission error${errors.length === 1 ? '' : 's'}`);
  if (cardDraws > 0) spikeReasons.push(`${cardDraws} card draw${cardDraws === 1 ? '' : 's'}`);
  const recap = [
    {
      label: 'Stats',
      value: statDelta === 0 ? 'No stat movement' : `${statDelta > 0 ? '+' : ''}${statDelta} total`,
      tone: statDelta < 0 ? 'red' : statDelta > 0 ? 'green' : 'neutral',
    },
    {
      label: 'Reveals',
      value: revealedDelta === 0 ? 'No new zones' : `${revealedDelta > 0 ? '+' : ''}${revealedDelta} zones`,
      tone: revealedDelta > 0 ? 'blue' : 'neutral',
    },
    {
      label: 'Artifacts',
      value: artifactDelta === 0 ? 'None recovered' : `${artifactDelta > 0 ? '+' : ''}${artifactDelta}`,
      tone: artifactDelta > 0 ? 'gold' : 'neutral',
    },
    {
      label: 'Cards',
      value: cardDraws === 0 ? 'No cards' : `${cardDraws} drawn`,
      tone: cardDraws > 0 ? 'gold' : 'neutral',
    },
    {
      label: 'Validity',
      value: invalidAttempts === 0 ? 'No invalid attempts' : `${invalidAttempts} invalid`,
      tone: invalidAttempts > 0 ? 'red' : 'green',
    },
    {
      label: 'Motion',
      value: locationChanges === 0 ? 'No player moved' : `${locationChanges} location change${locationChanges === 1 ? '' : 's'}`,
      tone: locationChanges > 0 ? 'blue' : 'neutral',
    },
  ];
  const repeatedAction = actions.length > 0
    && previousAnalysis?.actions?.length > 0
    && actions.every((action) => previousAnalysis.actions.includes(action));
  const causes = [];
  if (turn.skipped) causes.push(funCause('oneChoice', 'Queue was not in submission; the player could not act.'));
  if (revealedDelta <= 0 && locationChanges <= 0) causes.push(funCause('noBoardDelta', 'No reveal or location change occurred.'));
  if (statDelta === 0) causes.push(funCause('noStatDelta', 'No visible stat movement occurred.'));
  if (cardDraws === 0) causes.push(funCause('noCardResult', 'No day card or event result surfaced.'));
  if (artifactDelta === 0 && actions.includes('Dig')) causes.push(funCause('noArtifactPayoff', 'Dig did not produce an artifact payoff.'));
  if (repeatedAction) causes.push(funCause('repeatedAction', `Repeated ${actions.join(', ')} after the previous turn.`));
  if (meaningfulChoiceDensity <= 0.25 && submissions.length > 0) causes.push(funCause('oneChoice', 'Most submitted players had only one practical valid choice.'));
  if (invalidAttempts > 0) causes.push(funCause('invalidFriction', `${invalidAttempts} invalid option${invalidAttempts === 1 ? '' : 's'} were tried before submit.`));
  if (zeroStats > 0) causes.push(funCause('statCollapse', `${zeroStats} player${zeroStats === 1 ? '' : 's'} reached a zero stat.`));
  if (actions.length > 0 && actions.every((action) => action === 'Rest')) causes.push(funCause('restDominance', 'Every submitted action was Rest.'));
  if (actions.includes('Move') && revealedDelta <= 0 && locationChanges <= 0) causes.push(funCause('movementFriction', 'Move did not produce a visible board or location delta.'));

  const livelyCauses = [];
  if (artifactDelta > 0) livelyCauses.push(funCause('rewardMoment', `${artifactDelta} artifact${artifactDelta === 1 ? '' : 's'} recovered.`));
  if (revealedDelta > 0 || locationChanges > 0) livelyCauses.push(funCause('discoveryMoment', `${revealedDelta} reveal delta, ${locationChanges} location change${locationChanges === 1 ? '' : 's'}.`));
  if (cardDraws > 0) livelyCauses.push(funCause('cardMoment', `${cardDraws} card result${cardDraws === 1 ? '' : 's'} surfaced.`));

  const positiveScore = (
    (changed ? 10 : 0)
    + clamp(revealedDelta, 0, 3) * 12
    + clamp(locationChanges, 0, 4) * 8
    + clamp(artifactDelta, 0, 3) * 22
    + clamp(cardDraws, 0, 4) * 7
    + (statDelta > 0 ? clamp(statDelta, 0, 6) * 3 : 0)
    + (statDelta < 0 ? clamp(Math.abs(statDelta), 0, 4) * 2 : 0)
    + Math.round(meaningfulChoiceDensity * 18)
    + (uniqueActions.size > 1 ? 8 : 0)
    + ((turn.progressCount || 0) > 0 ? 4 : 0)
  );
  const negativeScore = (
    (boring ? 22 : 0)
    + (turn.skipped ? 28 : 0)
    + invalidAttempts * 5
    + zeroStats * 14
    + errors.length * 18
    + (repeatedAction ? 6 : 0)
  );
  const lifeScore = clamp(Math.round(18 + positiveScore - negativeScore), 0, 100);
  let classification = 'alive';
  if (turn.skipped || causes.some((cause) => cause.key === 'oneChoice') && lifeScore < 35) classification = 'stalled';
  else if (errors.length > 0 || invalidAttempts >= 3) classification = 'confusing';
  else if (zeroStats > 0 || statDelta <= -5) classification = 'punishing';
  else if (artifactDelta > 0 || cardDraws > 0) classification = 'rewarding';
  else if (spikeReasons.length > 0 && lifeScore >= 40) classification = 'spiky';
  else if (boring || lifeScore < 32) classification = 'flat';

  const topCause = causes[0] || livelyCauses[0] || funCause('noBoardDelta', 'No dominant cause found.');
  const confidence = clamp(
    0.35
      + (Math.abs(lifeScore - 50) / 100)
      + (causes.length > 0 ? 0.15 : 0)
      + (submissions.length > 0 ? 0.1 : 0),
    0.35,
    0.95,
  );
  const suggestion = classification === 'alive' || classification === 'rewarding' || classification === 'spiky'
    ? (livelyCauses[0]?.suggestion || 'Preserve this pattern and compare nearby lower-score turns against it.')
    : topCause.suggestion;
  const systems = [...new Set([...causes, ...livelyCauses].map((cause) => cause.system))];

  return {
    changed,
    boring,
    spike: spikeReasons.length > 0,
    spikeReasons,
    statDelta,
    artifactDelta,
    locationChanges,
    revealedDelta,
    cardDraws,
    invalidAttempts,
    meaningfulChoiceDensity,
    zeroStats,
    actions,
    recap,
    funDebugger: {
      lifeScore,
      classification,
      causes,
      livelyCauses,
      systems,
      suggestion,
      confidence,
      evidence: {
        changed,
        statDelta,
        artifactDelta,
        locationChanges,
        revealedDelta,
        cardDraws,
        invalidAttempts,
        meaningfulChoiceDensity,
        zeroStats,
        repeatedAction,
      },
    },
  };
}

function failureReasons(run) {
  const reasons = [];
  const final = run.turns[run.turns.length - 1]?.after || run.initial;
  const skipped = run.turns.filter((turn) => turn.skipped).length;
  const errors = run.turns.flatMap((turn) => turn.submissions || []).filter((submission) => submission.error);
  if (final?.gameOver && allArtifacts(final) === 0) reasons.push('game ended without recovered artifacts');
  if (zeroStatPlayers(final) > 0) reasons.push('one or more players reached a zero stat');
  if (skipped > 0) reasons.push(`${skipped} turn${skipped === 1 ? '' : 's'} skipped because queue was not in submission`);
  if (errors.length > 0) reasons.push(`${errors.length} action submission error${errors.length === 1 ? '' : 's'}`);
  if ((final?.activeZones?.count || 0) <= (run.initial?.activeZones?.count || 0) && run.turns.length >= 4) reasons.push('exploration stalled');
  return reasons;
}

function flatStreaks(turns) {
  const streaks = [];
  let current = [];
  for (const turn of turns) {
    const classification = turn.analysis?.funDebugger?.classification;
    if (classification === 'flat' || classification === 'stalled') {
      current.push(turn.turn);
      continue;
    }
    if (current.length > 0) streaks.push(current);
    current = [];
  }
  if (current.length > 0) streaks.push(current);
  return streaks.map((turnNumbers) => ({
    turns: turnNumbers,
    length: turnNumbers.length,
    label: `Turns ${turnNumbers.join(', ')}`,
  }));
}

function buildRunFunDebugger(run) {
  const turns = run.turns || [];
  const debugTurns = turns.map((turn) => ({
    turn: turn.turn,
    lifeScore: turn.analysis?.funDebugger?.lifeScore || 0,
    classification: turn.analysis?.funDebugger?.classification || 'unknown',
    causes: turn.analysis?.funDebugger?.causes || [],
    livelyCauses: turn.analysis?.funDebugger?.livelyCauses || [],
    systems: turn.analysis?.funDebugger?.systems || [],
    suggestion: turn.analysis?.funDebugger?.suggestion || '',
    confidence: turn.analysis?.funDebugger?.confidence || 0,
    evidence: turn.analysis?.funDebugger?.evidence || {},
  }));
  const flatTurns = debugTurns.filter((turn) => turn.classification === 'flat' || turn.classification === 'stalled');
  const aliveTurns = debugTurns.filter((turn) => ['alive', 'rewarding', 'spiky'].includes(turn.classification));
  const worstTurn = [...debugTurns].sort((a, b) => a.lifeScore - b.lifeScore)[0] || null;
  const bestTurn = [...debugTurns].sort((a, b) => b.lifeScore - a.lifeScore)[0] || null;
  const causeCounts = sortedCounts(countBy(debugTurns.flatMap((turn) => turn.causes), (cause) => cause.key));
  const livelyCounts = sortedCounts(countBy(debugTurns.flatMap((turn) => turn.livelyCauses), (cause) => cause.key));
  const systemCounts = sortedCounts(countBy(debugTurns.flatMap((turn) => turn.systems), (system) => system));
  const suggestions = sortedCounts(countBy(debugTurns.filter((turn) => turn.suggestion), (turn) => turn.suggestion))
    .map((item) => {
      const sourceTurn = debugTurns.find((turn) => turn.suggestion === item.key);
      const sourceCause = sourceTurn?.causes?.[0] || sourceTurn?.livelyCauses?.[0];
      return {
        experiment: item.key,
        count: item.count,
        confidence: average(debugTurns.filter((turn) => turn.suggestion === item.key).map((turn) => turn.confidence)),
        affectedTurns: debugTurns.filter((turn) => turn.suggestion === item.key).map((turn) => turn.turn),
        system: sourceCause?.system || 'pacing',
        blastRadius: sourceCause?.blastRadius || 'medium',
      };
    });
  const topIssue = causeCounts[0]
    ? {
      key: causeCounts[0].key,
      label: FUN_CAUSE_LIBRARY[causeCounts[0].key]?.label || causeCounts[0].key,
      count: causeCounts[0].count,
      system: FUN_CAUSE_LIBRARY[causeCounts[0].key]?.system || 'pacing',
      suggestion: FUN_CAUSE_LIBRARY[causeCounts[0].key]?.suggestion || suggestions[0]?.experiment || '',
    }
    : null;

  return {
    schemaVersion: 1,
    strategy: run.config?.strategy || 'unknown',
    scenario: run.config?.scenario || 'unknown',
    averageLifeScore: average(debugTurns.map((turn) => turn.lifeScore)),
    flatTurnRate: debugTurns.length > 0 ? flatTurns.length / debugTurns.length : 0,
    aliveTurnRate: debugTurns.length > 0 ? aliveTurns.length / debugTurns.length : 0,
    classifications: countBy(debugTurns, (turn) => turn.classification),
    flatTurns: flatTurns.map((turn) => turn.turn),
    aliveTurns: aliveTurns.map((turn) => turn.turn),
    bestTurn,
    worstTurn,
    flatStreaks: flatStreaks(turns),
    topIssue,
    dominantFailureMode: topIssue?.label || 'No repeated flat pattern detected.',
    dominantFunSource: livelyCounts[0]?.key ? FUN_CAUSE_LIBRARY[livelyCounts[0].key]?.label || livelyCounts[0].key : 'No strong fun source detected.',
    repeatedSystems: systemCounts,
    experiments: suggestions,
    topExperiment: suggestions[0] || null,
    turns: debugTurns,
  };
}

function analyzeRun(run) {
  const final = run.turns[run.turns.length - 1]?.after || run.initial;
  const turnAnalyses = [];
  for (const turn of run.turns) {
    turnAnalyses.push(analyzeTurn(turn, turnAnalyses[turnAnalyses.length - 1] || null));
  }
  run.turns = run.turns.map((turn, index) => ({ ...turn, analysis: turnAnalyses[index] }));

  const actions = {};
  for (const turn of run.turns) {
    for (const action of turn.analysis.actions) {
      actions[action] = (actions[action] || 0) + 1;
    }
  }

  const boringTurns = run.turns.filter((turn) => turn.analysis.boring);
  const spikeTurns = run.turns.filter((turn) => turn.analysis.spike);
  const invalidAttempts = turnAnalyses.reduce((sum, item) => sum + item.invalidAttempts, 0);
  const meaningfulChoiceDensity = average(turnAnalyses.map((item) => item.meaningfulChoiceDensity));
  const tensionCurve = turnAnalyses.map((item, index) => ({
    turn: index + 1,
    statDelta: item.statDelta,
    revealedDelta: item.revealedDelta,
    artifactDelta: item.artifactDelta,
    invalidAttempts: item.invalidAttempts,
    zeroStats: item.zeroStats,
    reasons: [
      item.statDelta < 0 ? `stat pressure ${item.statDelta}` : null,
      item.revealedDelta > 0 ? `revealed ${item.revealedDelta}` : null,
      item.artifactDelta > 0 ? `artifact ${item.artifactDelta}` : null,
      item.invalidAttempts > 0 ? `${item.invalidAttempts} invalid` : null,
      item.zeroStats > 0 ? `${item.zeroStats} zero stat` : null,
      item.cardDraws > 0 ? `${item.cardDraws} card` : null,
    ].filter(Boolean),
    tension: Math.max(
      0,
      Math.min(100, (item.zeroStats * 30) + Math.abs(Math.min(0, item.statDelta)) * 8 + item.invalidAttempts * 6 + item.cardDraws * 5 + item.revealedDelta * 4),
    ),
  }));

  const cardOutcomes = {};
  for (const turn of run.turns) {
    for (const card of turn.after?.lastDayEvents?.cardsDrawn || []) {
      if (!card) continue;
      cardOutcomes[card] = (cardOutcomes[card] || 0) + 1;
    }
  }

  const summary = {
    turnsRun: run.turns.length,
    finalDay: final.day,
    finalPhase: final.phase,
    finalQueuePhase: final.queuePhase,
    totalArtifacts: allArtifacts(final),
    actions,
    activePlayers: final.players.length,
    gameOver: Boolean(final.gameOver),
    finalRevealedZones: final.activeZones?.count || 0,
    revealedZonesGained: (final.activeZones?.count || 0) - (run.initial?.activeZones?.count || 0),
    finalStatTotal: totalStats(final),
    statTotalDelta: totalStats(final) - totalStats(run.initial),
    zeroStatPlayers: zeroStatPlayers(final),
    boringTurns: boringTurns.map((turn) => turn.turn),
    spikeTurns: spikeTurns.map((turn) => ({ turn: turn.turn, reasons: turn.analysis.spikeReasons })),
    invalidAttempts,
    meaningfulChoiceDensity,
    cardOutcomes,
    tensionCurve,
    failureReasons: failureReasons(run),
  };

  run.funDebugger = buildRunFunDebugger(run);
  return {
    ...summary,
    funDebugger: {
      averageLifeScore: run.funDebugger.averageLifeScore,
      flatTurnRate: run.funDebugger.flatTurnRate,
      aliveTurnRate: run.funDebugger.aliveTurnRate,
      topIssue: run.funDebugger.topIssue,
      topExperiment: run.funDebugger.topExperiment,
    },
    outcome: summary.gameOver && summary.totalArtifacts > 0 ? 'escaped-or-ended-with-artifacts' : summary.failureReasons.length > 0 ? 'needs-attention' : 'in-progress',
  };
}

function aggregateRuns(runs) {
  const summaries = runs.map((run) => run.summary);
  const actionTotals = {};
  const strategySummaries = {};
  const warnings = [];

  for (const run of runs) {
    for (const [action, count] of Object.entries(run.summary.actions || {})) {
      actionTotals[action] = (actionTotals[action] || 0) + Number(count);
    }
    const strategy = run.config.strategy;
    strategySummaries[strategy] ||= {
      runs: 0,
      artifacts: [],
      revealedZones: [],
      statDelta: [],
      boringTurns: [],
      spikeTurns: [],
      meaningfulChoiceDensity: [],
      invalidAttempts: [],
      zeroStatPlayers: [],
      actions: {},
    };
    const bucket = strategySummaries[strategy];
    bucket.runs += 1;
    bucket.artifacts.push(run.summary.totalArtifacts);
    bucket.revealedZones.push(run.summary.revealedZonesGained);
    bucket.statDelta.push(run.summary.statTotalDelta);
    bucket.boringTurns.push(run.summary.boringTurns.length);
    bucket.spikeTurns.push(run.summary.spikeTurns.length);
    bucket.meaningfulChoiceDensity.push(run.summary.meaningfulChoiceDensity);
    bucket.invalidAttempts.push(run.summary.invalidAttempts);
    bucket.zeroStatPlayers.push(run.summary.zeroStatPlayers);
    for (const [action, count] of Object.entries(run.summary.actions || {})) {
      bucket.actions[action] = (bucket.actions[action] || 0) + Number(count);
    }
  }

  for (const [strategy, bucket] of Object.entries(strategySummaries)) {
    strategySummaries[strategy] = {
      ...bucket,
      avgArtifacts: average(bucket.artifacts),
      medianArtifacts: median(bucket.artifacts),
      avgRevealedZones: average(bucket.revealedZones),
      avgStatDelta: average(bucket.statDelta),
      avgBoringTurns: average(bucket.boringTurns),
      avgSpikeTurns: average(bucket.spikeTurns),
      avgMeaningfulChoiceDensity: average(bucket.meaningfulChoiceDensity),
      avgInvalidAttempts: average(bucket.invalidAttempts),
      avgZeroStatPlayers: average(bucket.zeroStatPlayers),
    };
  }

  const totalActions = Object.values(actionTotals).reduce((sum, count) => sum + Number(count), 0);
  const idleShare = totalActions > 0 ? (actionTotals.Idle || 0) / totalActions : 0;
  const restShare = totalActions > 0 ? (actionTotals.Rest || 0) / totalActions : 0;
  const moveShare = totalActions > 0 ? (actionTotals.Move || 0) / totalActions : 0;
  if (idleShare > 0.2) warnings.push('Idle share is high; strategies or valid-action affordances may be too constrained.');
  if (restShare > 0.35) warnings.push('Rest is dominating; stat pressure may be too punishing.');
  if (moveShare < 0.25 && totalActions > 0) warnings.push('Move is underused; exploration may be blocked or less attractive than alternatives.');
  if (average(summaries.map((summary) => summary.meaningfulChoiceDensity)) < 0.35) warnings.push('Meaningful choice density is low; many turns have only one practical action.');
  if (average(summaries.map((summary) => summary.boringTurns.length)) > 2) warnings.push('Boring-turn count is high; add discovery, pressure, or clearer rewards earlier.');
  if (average(summaries.map((summary) => summary.invalidAttempts)) > 3) warnings.push('Invalid action attempts are high; improve bot strategy or action readability.');

  return {
    runs: runs.length,
    strategies: strategySummaries,
    actionTotals,
    actionShares: {
      Idle: idleShare,
      Rest: restShare,
      Move: moveShare,
    },
    averages: {
      artifacts: average(summaries.map((summary) => summary.totalArtifacts)),
      revealedZones: average(summaries.map((summary) => summary.revealedZonesGained)),
      statDelta: average(summaries.map((summary) => summary.statTotalDelta)),
      boringTurns: average(summaries.map((summary) => summary.boringTurns.length)),
      spikeTurns: average(summaries.map((summary) => summary.spikeTurns.length)),
      meaningfulChoiceDensity: average(summaries.map((summary) => summary.meaningfulChoiceDensity)),
      invalidAttempts: average(summaries.map((summary) => summary.invalidAttempts)),
      zeroStatPlayers: average(summaries.map((summary) => summary.zeroStatPlayers)),
    },
    warnings,
  };
}

function buildAggregateFunDebugger(runs) {
  const runDebuggers = runs.map((run) => run.funDebugger).filter(Boolean);
  const allTurns = runDebuggers.flatMap((debuggerRun) => (
    (debuggerRun.turns || []).map((turn) => ({
      ...turn,
      strategy: debuggerRun.strategy,
      scenario: debuggerRun.scenario,
    }))
  ));
  const flatTurns = allTurns.filter((turn) => turn.classification === 'flat' || turn.classification === 'stalled');
  const aliveTurns = allTurns.filter((turn) => ['alive', 'rewarding', 'spiky'].includes(turn.classification));
  const causeCounts = sortedCounts(countBy(allTurns.flatMap((turn) => turn.causes || []), (cause) => cause.key));
  const livelyCounts = sortedCounts(countBy(allTurns.flatMap((turn) => turn.livelyCauses || []), (cause) => cause.key));
  const systemCounts = sortedCounts(countBy(allTurns.flatMap((turn) => turn.systems || []), (system) => system));
  const strategyScores = {};
  for (const run of runDebuggers) {
    strategyScores[run.strategy] ||= { lifeScores: [], flatRates: [], aliveRates: [], issues: [] };
    strategyScores[run.strategy].lifeScores.push(run.averageLifeScore);
    strategyScores[run.strategy].flatRates.push(run.flatTurnRate);
    strategyScores[run.strategy].aliveRates.push(run.aliveTurnRate);
    if (run.topIssue?.key) strategyScores[run.strategy].issues.push(run.topIssue.key);
  }
  for (const [strategy, stats] of Object.entries(strategyScores)) {
    strategyScores[strategy] = {
      averageLifeScore: average(stats.lifeScores),
      flatTurnRate: average(stats.flatRates),
      aliveTurnRate: average(stats.aliveRates),
      topIssue: sortedCounts(countBy(stats.issues, (issue) => issue))[0]?.key || null,
    };
  }

  const experimentsByText = {};
  for (const run of runDebuggers) {
    for (const experiment of run.experiments || []) {
      experimentsByText[experiment.experiment] ||= {
        experiment: experiment.experiment,
        count: 0,
        confidenceValues: [],
        affectedTurns: [],
        strategies: new Set(),
        systems: new Set(),
        blastRadius: experiment.blastRadius || 'medium',
      };
      const bucket = experimentsByText[experiment.experiment];
      bucket.count += experiment.count;
      bucket.confidenceValues.push(experiment.confidence);
      bucket.affectedTurns.push(...(experiment.affectedTurns || []).map((turn) => `${run.strategy}:T${turn}`));
      bucket.strategies.add(run.strategy);
      bucket.systems.add(experiment.system || 'pacing');
      if (experiment.blastRadius === 'low') bucket.blastRadius = 'low';
    }
  }

  const experiments = Object.values(experimentsByText)
    .map((experiment) => ({
      experiment: experiment.experiment,
      count: experiment.count,
      confidence: average(experiment.confidenceValues),
      affectedTurns: experiment.affectedTurns.slice(0, 12),
      affectedStrategies: [...experiment.strategies],
      systems: [...experiment.systems],
      blastRadius: experiment.blastRadius,
      leverage: experiment.count * average(experiment.confidenceValues) * (experiment.blastRadius === 'low' ? 1.25 : experiment.blastRadius === 'medium' ? 1 : 0.75),
    }))
    .sort((a, b) => b.leverage - a.leverage || a.experiment.localeCompare(b.experiment));

  const topIssue = causeCounts[0]
    ? {
      key: causeCounts[0].key,
      label: FUN_CAUSE_LIBRARY[causeCounts[0].key]?.label || causeCounts[0].key,
      count: causeCounts[0].count,
      system: FUN_CAUSE_LIBRARY[causeCounts[0].key]?.system || 'pacing',
      suggestion: FUN_CAUSE_LIBRARY[causeCounts[0].key]?.suggestion || experiments[0]?.experiment || '',
    }
    : null;

  return {
    schemaVersion: 1,
    averageLifeScore: average(runDebuggers.map((run) => run.averageLifeScore)),
    flatTurnRate: allTurns.length > 0 ? flatTurns.length / allTurns.length : 0,
    aliveTurnRate: allTurns.length > 0 ? aliveTurns.length / allTurns.length : 0,
    classifications: countBy(allTurns, (turn) => turn.classification),
    topIssue,
    topExperiments: experiments.slice(0, 5),
    smallestExperimentQueue: experiments
      .filter((experiment) => experiment.blastRadius === 'low' || experiment.blastRadius === 'medium')
      .slice(0, 8),
    repeatedFlatPatterns: causeCounts.slice(0, 8).map((item) => ({
      ...item,
      label: FUN_CAUSE_LIBRARY[item.key]?.label || item.key,
      system: FUN_CAUSE_LIBRARY[item.key]?.system || 'pacing',
    })),
    repeatedHighLifePatterns: livelyCounts.slice(0, 8).map((item) => ({
      ...item,
      label: FUN_CAUSE_LIBRARY[item.key]?.label || item.key,
      system: FUN_CAUSE_LIBRARY[item.key]?.system || 'pacing',
    })),
    systemicRisks: systemCounts.slice(0, 8),
    strategyScores,
    worstTurns: [...allTurns].sort((a, b) => a.lifeScore - b.lifeScore).slice(0, 8),
    bestTurns: [...allTurns].sort((a, b) => b.lifeScore - a.lifeScore).slice(0, 8),
  };
}

function metricValue(aggregate, metric) {
  const averages = aggregate.averages || {};
  const shares = aggregate.actionShares || {};
  const values = {
    idleShare: shares.Idle || 0,
    restShare: shares.Rest || 0,
    moveShare: shares.Move || 0,
    artifacts: averages.artifacts || 0,
    revealedZones: averages.revealedZones || 0,
    statDelta: averages.statDelta || 0,
    boringTurns: averages.boringTurns || 0,
    spikeTurns: averages.spikeTurns || 0,
    meaningfulChoiceDensity: averages.meaningfulChoiceDensity || 0,
    invalidAttempts: averages.invalidAttempts || 0,
    zeroStatPlayers: averages.zeroStatPlayers || 0,
  };
  return values[metric] ?? 0;
}

function evaluateLimit(value, limit) {
  if (limit.min !== undefined && value < Number(limit.min)) return false;
  if (limit.max !== undefined && value > Number(limit.max)) return false;
  return true;
}

function targetDescription(limit) {
  const parts = [];
  if (limit.min !== undefined) parts.push(`>= ${limit.min}`);
  if (limit.max !== undefined) parts.push(`<= ${limit.max}`);
  return parts.join(' and ');
}

function evaluateTargets(aggregate, targets) {
  const checks = Object.entries(targets || {}).map(([metric, limit]) => {
    const value = metricValue(aggregate, metric);
    return {
      metric,
      label: limit.label || metric,
      value,
      target: targetDescription(limit),
      pass: evaluateLimit(value, limit),
    };
  });
  const passed = checks.filter((check) => check.pass).length;
  return {
    passed,
    total: checks.length,
    score: checks.length > 0 ? passed / checks.length : 1,
    checks,
  };
}

function evaluateScenarioGoals(report, scenarioGoals) {
  const goals = scenarioGoals?.[report.config?.scenario] || {};
  const checks = Object.entries(goals).map(([metric, limit]) => {
    const value = metricValue(report.aggregate || {}, metric);
    return {
      metric,
      label: limit.label || metric,
      value,
      target: targetDescription(limit),
      pass: evaluateLimit(value, limit),
    };
  });
  const passed = checks.filter((check) => check.pass).length;
  return {
    scenario: report.config?.scenario || 'custom',
    passed,
    total: checks.length,
    score: checks.length > 0 ? passed / checks.length : 1,
    checks,
  };
}

function compareReports(current, baseline) {
  if (!baseline?.aggregate) return null;
  const metrics = ['artifacts', 'revealedZones', 'statDelta', 'boringTurns', 'spikeTurns', 'meaningfulChoiceDensity', 'invalidAttempts', 'zeroStatPlayers'];
  const averages = {};
  for (const metric of metrics) {
    const before = baseline.aggregate.averages?.[metric] || 0;
    const after = current.aggregate?.averages?.[metric] || 0;
    averages[metric] = { before, after, delta: after - before };
  }

  const actionShares = {};
  for (const action of ['Idle', 'Move', 'Rest']) {
    const before = baseline.aggregate.actionShares?.[action] || 0;
    const after = current.aggregate?.actionShares?.[action] || 0;
    actionShares[action] = { before, after, delta: after - before };
  }

  return {
    baselineGeneratedAt: baseline.generatedAt || null,
    currentGeneratedAt: current.generatedAt || null,
    averages,
    actionShares,
    funDebugger: baseline.funDebugger && current.funDebugger ? {
      averageLifeScore: {
        before: baseline.funDebugger.averageLifeScore || 0,
        after: current.funDebugger.averageLifeScore || 0,
        delta: (current.funDebugger.averageLifeScore || 0) - (baseline.funDebugger.averageLifeScore || 0),
      },
      flatTurnRate: {
        before: baseline.funDebugger.flatTurnRate || 0,
        after: current.funDebugger.flatTurnRate || 0,
        delta: (current.funDebugger.flatTurnRate || 0) - (baseline.funDebugger.flatTurnRate || 0),
      },
      aliveTurnRate: {
        before: baseline.funDebugger.aliveTurnRate || 0,
        after: current.funDebugger.aliveTurnRate || 0,
        delta: (current.funDebugger.aliveTurnRate || 0) - (baseline.funDebugger.aliveTurnRate || 0),
      },
      topIssueBefore: baseline.funDebugger.topIssue?.label || null,
      topIssueAfter: current.funDebugger.topIssue?.label || null,
      topExperimentAfter: current.funDebugger.topExperiments?.[0]?.experiment || current.funDebugger.topExperiment?.experiment || null,
    } : null,
    warningDelta: (current.aggregate?.warnings?.length || 0) - (baseline.aggregate?.warnings?.length || 0),
  };
}

function prioritizedTask(metric, message, hint, source) {
  const highPriority = ['meaningfulChoiceDensity', 'boringTurns', 'invalidAttempts', 'zeroStatPlayers'].includes(metric);
  return {
    priority: highPriority ? 'high' : 'medium',
    source,
    metric,
    message,
    hint,
  };
}

function evidenceForMetric(report, metric) {
  const strategies = Object.entries(report.aggregate?.strategies || {});
  if (strategies.length === 0) return null;
  const highBad = ['idleShare', 'restShare', 'boringTurns', 'invalidAttempts', 'zeroStatPlayers'];
  const metricKey = {
    artifacts: 'avgArtifacts',
    revealedZones: 'avgRevealedZones',
    statDelta: 'avgStatDelta',
    boringTurns: 'avgBoringTurns',
    spikeTurns: 'avgSpikeTurns',
    meaningfulChoiceDensity: 'avgMeaningfulChoiceDensity',
    invalidAttempts: 'avgInvalidAttempts',
    zeroStatPlayers: 'avgZeroStatPlayers',
  }[metric];
  if (!metricKey) return null;
  const sorted = strategies
    .map(([strategy, stats]) => ({ strategy, value: Number(stats[metricKey] || 0) }))
    .sort((a, b) => highBad.includes(metric) ? b.value - a.value : a.value - b.value);
  const worst = sorted[0];
  if (!worst) return null;
  return `Worst strategy: ${worst.strategy} (${worst.value.toFixed(3)}).`;
}

function makeTuningTasks(report, tuningConfig) {
  const tasks = [];
  if (report.funDebugger?.topExperiments?.[0]) {
    const experiment = report.funDebugger.topExperiments[0];
    tasks.push({
      priority: experiment.blastRadius === 'low' ? 'high' : 'medium',
      source: 'fun-debugger',
      metric: 'lifeScore',
      message: `Top fun-debugger experiment affects ${experiment.count} turn pattern${experiment.count === 1 ? '' : 's'} across ${experiment.affectedStrategies.join(', ') || 'unknown strategies'}.`,
      hint: experiment.experiment,
    });
  }
  for (const check of report.targetEvaluation?.checks || []) {
    if (check.pass) continue;
    const evidence = evidenceForMetric(report, check.metric);
    tasks.push(prioritizedTask(
      check.metric,
      `${check.label} is ${check.value.toFixed(3)}; target is ${check.target}.${evidence ? ` ${evidence}` : ''}`,
      tuningConfig.taskHints?.[check.metric] || 'Adjust game data or strategy and rerun the benchmark.',
      'target',
    ));
  }
  for (const check of report.scenarioGoalEvaluation?.checks || []) {
    if (check.pass) continue;
    const evidence = evidenceForMetric(report, check.metric);
    tasks.push(prioritizedTask(
      check.metric,
      `${report.scenarioGoalEvaluation.scenario} ${check.metric} is ${check.value.toFixed(3)}; goal is ${check.target}.${evidence ? ` ${evidence}` : ''}`,
      tuningConfig.taskHints?.[check.metric] || 'Tune this scenario and compare against baseline.',
      'scenario-goal',
    ));
  }
  for (const warning of report.aggregate?.warnings || []) {
    tasks.push({
      priority: warning.includes('low') || warning.includes('high') ? 'medium' : 'low',
      source: 'warning',
      metric: 'aggregate',
      message: warning,
      hint: 'Use strategy comparison and turn logs to find the state that produces this warning.',
    });
  }
  return tasks.slice(0, 12);
}

function appendTuningLedger(report, paths) {
  mkdirSync(reportDir, { recursive: true });
  const previous = existsSync(tuningLedgerPath) ? readJson(tuningLedgerPath) : [];
  const ledger = Array.isArray(previous) ? previous : [];
  ledger.push({
    generatedAt: report.generatedAt,
    scenario: report.config.scenario,
    scenarioLabel: report.config.scenarioLabel,
    strategies: report.config.strategies,
    batch: report.config.batch,
    seed: report.config.seed,
    note: report.tuning.note,
    hypothesis: report.tuning.hypothesis,
    changed: report.tuning.changed,
    score: report.targetEvaluation.score,
    scenarioScore: report.scenarioGoalEvaluation.score,
    averages: report.aggregate.averages,
    actionShares: report.aggregate.actionShares,
    funDebugger: {
      averageLifeScore: report.funDebugger?.averageLifeScore,
      flatTurnRate: report.funDebugger?.flatTurnRate,
      aliveTurnRate: report.funDebugger?.aliveTurnRate,
      topIssue: report.funDebugger?.topIssue,
      topExperiment: report.funDebugger?.topExperiments?.[0],
    },
    warnings: report.aggregate.warnings,
    tasks: report.tasks,
    reportPath: paths.runPath,
  });
  writeFileSync(tuningLedgerPath, JSON.stringify(ledger.slice(-100), bigintReplacer, 2));
  return tuningLedgerPath;
}

function summarize(report) {
  const final = report.turns[report.turns.length - 1]?.after || report.initial;
  const totalArtifacts = final.players.reduce((sum, player) => sum + player.artifacts.length, 0);
  const actions = {};
  for (const turn of report.turns) {
    for (const submission of turn.submissions || []) {
      if (!submission.action) continue;
      actions[submission.action] = (actions[submission.action] || 0) + 1;
    }
  }
  return {
    turnsRun: report.turns.length,
    finalDay: final.day,
    finalPhase: final.phase,
    finalQueuePhase: final.queuePhase,
    totalArtifacts,
    actions,
    activePlayers: final.players.length,
  };
}

async function writeReport(report) {
  mkdirSync(reportDir, { recursive: true });
  mkdirSync(publicReportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const json = JSON.stringify(report, bigintReplacer, 2);
  const runPath = resolve(reportDir, `run-${stamp}.json`);
  const latestPath = resolve(reportDir, 'latest-report.json');
  const publicPath = resolve(publicReportDir, 'latest-report.json');
  writeFileSync(runPath, json);
  writeFileSync(latestPath, json);
  writeFileSync(publicPath, json);
  return { runPath, latestPath, publicPath };
}

async function runSimulation(addresses, runConfig) {
  const gameId = await ensureGameForRun(addresses, runConfig);
  const seats = await registerPlayers(addresses, gameId, runConfig.players);
  if (seats.length === 0) throw new Error('No simulator seats registered.');

  await progressEngine(addresses);
  const initial = await snapshot(addresses, gameId, seats, 'initial');
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    engine: 'local-anvil-solidity-contracts',
    exactEngine: true,
    config: runConfig,
    addresses,
    gameId,
    players: seats.map((seat) => ({ playerId: seat.playerId, address: seat.account.address })),
    initial,
    turns: [],
  };

  for (let turn = 1; turn <= runConfig.turns; turn += 1) {
    await progressEngine(addresses);
    const queueId = await currentQueueId(addresses, gameId);
    const queuePhase = await getPhase(addresses, queueId);
    if (queuePhase !== PROCESSING_PHASE.SUBMISSION) {
      log(`turn ${turn} skipped: queue ${queueId} is ${PHASE_LABEL[queuePhase] || 'not ready'}`);
      report.turns.push({
        turn,
        queueId,
        skipped: true,
        reason: `Queue phase is ${PHASE_LABEL[queuePhase] || 'not ready for submission'}`,
        before: await snapshot(addresses, gameId, seats, `turn-${turn}-before`),
        after: await snapshot(addresses, gameId, seats, `turn-${turn}-after`),
      });
      continue;
    }
    const before = await snapshot(addresses, gameId, seats, `turn-${turn}-before`);
    const submissions = await submitTurnActions(addresses, gameId, queueId, turn, seats, before, runConfig);
    const progressCount = await progressEngine(addresses);
    const after = await snapshot(addresses, gameId, seats, `turn-${turn}-after`);
    report.turns.push({
      turn,
      queueId,
      submissions,
      progressCount,
      before,
      after,
    });
  }

  report.summary = analyzeRun(report);
  return report;
}

async function main() {
  const addresses = loadAddresses();
  const tuningConfig = loadTuningConfig();
  await publicClient.getChainId();
  const runs = [];

  for (const strategy of config.strategies) {
    for (let batchIndex = 0; batchIndex < config.batch; batchIndex += 1) {
      const runConfig = {
        ...config,
        strategy,
        runIndex: batchIndex + 1,
        runLabel: `${config.scenarioLabel} / ${strategy} / ${batchIndex + 1}`,
        seed: `${config.seed}:${strategy}:${batchIndex + 1}`,
        createGame: config.gameId ? false : config.createGame,
      };
      log(`run ${runs.length + 1}/${config.strategies.length * config.batch}: ${runConfig.runLabel}`);
      runs.push(await runSimulation(addresses, runConfig));
    }
  }

  const latest = runs[runs.length - 1];
  const aggregate = aggregateRuns(runs);
  const baselinePath = config.baseline === true
    ? defaultBaselinePath
    : config.baseline
      ? resolve(root, String(config.baseline))
      : defaultBaselinePath;
  const baselineReport = existsSync(baselinePath) ? readJson(baselinePath) : null;
  const report = {
    ...latest,
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    config,
    runs,
    aggregate,
    funDebugger: buildAggregateFunDebugger(runs),
    summary: latest.summary,
    tuning: {
      note: config.note,
      hypothesis: config.hypothesis,
      changed: config.changed,
      configPath: existsSync(tuningConfigPath) ? tuningConfigPath : null,
      baselinePath: baselineReport ? baselinePath : null,
      saveBaseline: config.saveBaseline,
      targets: tuningConfig.targets,
      scenarioGoals: tuningConfig.scenarioGoals?.[config.scenario] || {},
    },
  };
  report.targetEvaluation = evaluateTargets(report.aggregate, tuningConfig.targets);
  report.scenarioGoalEvaluation = evaluateScenarioGoals(report, tuningConfig.scenarioGoals);
  report.comparison = compareReports(report, baselineReport);
  report.tasks = makeTuningTasks(report, tuningConfig);

  const paths = await writeReport(report);
  const ledgerPath = appendTuningLedger(report, paths);
  if (config.saveBaseline) {
    writeFileSync(defaultBaselinePath, JSON.stringify(report, bigintReplacer, 2));
    log(`saved baseline ${defaultBaselinePath}`);
  }
  log(`wrote ${paths.latestPath}`);
  log(`wrote ${paths.publicPath}`);
  log(`updated ${ledgerPath}`);
  console.log(JSON.stringify({
    summary: report.summary,
    aggregate: report.aggregate,
    funDebugger: {
      averageLifeScore: report.funDebugger.averageLifeScore,
      flatTurnRate: report.funDebugger.flatTurnRate,
      aliveTurnRate: report.funDebugger.aliveTurnRate,
      topIssue: report.funDebugger.topIssue,
      topExperiment: report.funDebugger.topExperiments?.[0] || null,
    },
    targetEvaluation: report.targetEvaluation,
    scenarioGoalEvaluation: report.scenarioGoalEvaluation,
    comparison: report.comparison,
    tasks: report.tasks,
    paths: { ...paths, ledgerPath, baselinePath: config.saveBaseline ? defaultBaselinePath : report.tuning.baselinePath },
  }, bigintReplacer, 2));
}

main().catch((error) => {
  console.error('[simulator] fatal:', error.shortMessage || error.message || String(error));
  process.exit(1);
});
