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

const config = {
  rpcUrl: String(arg('rpc', process.env.RPC_URL || 'http://127.0.0.1:9955')),
  turns: Math.max(1, Number(arg('turns', 8))),
  players: Math.max(1, Math.min(4, Number(arg('players', 1)))),
  strategy: String(arg('strategy', 'balanced')),
  gameId: arg('game', null),
  createGame: boolArg('create', true),
  progressAttempts: Math.max(1, Number(arg('progress-attempts', 12))),
  quiet: boolArg('quiet', false),
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

async function createGame(addresses) {
  log(`creating ${config.players}-player simulator game`);
  await writeContract(deployerWallet, addresses.CONTROLLER, abis.controller, 'requestNewGame', [
    addresses.GAME_REGISTRY,
    addresses.BOARD,
    BigInt(config.players),
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
  if (config.createGame) return createGame(addresses);
  const openGame = await pickOpenGame(addresses);
  if (!openGame) throw new Error('No open game found. Re-run with --create=true or start npm run local:solo.');
  return openGame;
}

async function registerPlayers(addresses, gameId) {
  const seats = [];
  for (let index = 0; index < config.players; index += 1) {
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
  const [phase, day, queueId, totalPlayers, locations, inventories] = await Promise.all([
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'currentPhase', [addresses.BOARD, gameId]).catch(() => 'Unknown'),
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'currentDay', [addresses.BOARD, gameId]).catch(() => 0n),
    currentQueueId(addresses, gameId).catch(() => 0n),
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'totalPlayers', [addresses.BOARD, gameId]).catch(() => 0n),
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'allPlayerLocations', [addresses.BOARD, gameId]).catch(() => [[], []]),
    readContract(addresses.GAME_SUMMARY, abis.gameSummary, 'allPlayerActiveInventories', [addresses.BOARD, gameId]).catch(() => [[], [], [], [], [], [], [], []]),
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
  if (strategy === 'idle') return { action: ACTION.IDLE, options: [], reason: 'idle baseline' };
  if (strategy === 'dig') return { action: ACTION.DIG, options: [], reason: 'dig focus' };
  if (strategy === 'rest') return { action: ACTION.REST, options: ['Movement'], reason: 'rest focus' };
  if (strategy === 'move') return { action: ACTION.MOVE, options: context.movePath, reason: 'move focus' };
  if (strategy === 'risky') {
    const cycle = [ACTION.DIG, ACTION.MOVE, ACTION.DIG, ACTION.FLEE, ACTION.REST];
    return { action: cycle[(turn + playerIndex) % cycle.length], options: [], reason: 'risky cycle' };
  }

  if (player.stats.movement <= 1 || player.stats.agility <= 1 || player.stats.dexterity <= 1) {
    return { action: ACTION.REST, options: ['Movement'], reason: 'recover low stats' };
  }
  const cycle = [ACTION.MOVE, ACTION.DIG, ACTION.REST, ACTION.MOVE, ACTION.SETUP_CAMP];
  return { action: cycle[(turn + playerIndex) % cycle.length], options: [], reason: 'balanced cycle' };
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

async function chooseAction(addresses, gameId, turn, playerIndex, player) {
  const movePath = await findMovePath(addresses, gameId, player);
  const candidates = [];
  const primary = plannedActionFor(config.strategy, turn, playerIndex, player, { movePath });
  if (primary.action === ACTION.MOVE) primary.options = movePath;
  candidates.push(primary);
  candidates.push({ action: ACTION.MOVE, options: movePath, reason: 'valid move fallback' });
  candidates.push({ action: ACTION.DIG, options: [], reason: 'dig fallback' });
  candidates.push({ action: ACTION.REST, options: ['Movement'], reason: 'rest fallback' });
  candidates.push({ action: ACTION.IDLE, options: [], reason: 'idle fallback' });

  for (const plan of candidates) {
    if (plan.action === ACTION.MOVE && plan.options.length === 0) continue;
    const validity = await isValidAction(addresses, gameId, player.playerId, plan);
    if (validity.ok) return { ...plan, validity };
  }
  return { action: ACTION.IDLE, options: [], reason: 'forced idle fallback', validity: { ok: true, reason: '' } };
}

async function submitTurnActions(addresses, gameId, queueId, turn, seats, beforeSnapshot) {
  const submissions = [];
  for (let index = 0; index < seats.length; index += 1) {
    const seat = seats[index];
    const submitted = await readContract(addresses.QUEUE, abis.queue, 'playerSubmitted', [queueId, seat.playerId]).catch(() => false);
    if (submitted) {
      submissions.push({ playerId: seat.playerId, skipped: true, reason: 'already submitted' });
      continue;
    }

    const player = beforeSnapshot.players.find((entry) => String(entry.playerId) === String(seat.playerId));
    const plan = await chooseAction(addresses, gameId, turn, index, player || { playerId: seat.playerId, location: '', stats: {} });
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

async function main() {
  const addresses = loadAddresses();
  await publicClient.getChainId();
  const gameId = await ensureGame(addresses);
  const seats = await registerPlayers(addresses, gameId);
  if (seats.length === 0) throw new Error('No simulator seats registered.');

  await progressEngine(addresses);
  const initial = await snapshot(addresses, gameId, seats, 'initial');
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    engine: 'local-anvil-solidity-contracts',
    exactEngine: true,
    config,
    addresses,
    gameId,
    players: seats.map((seat) => ({ playerId: seat.playerId, address: seat.account.address })),
    initial,
    turns: [],
  };

  for (let turn = 1; turn <= config.turns; turn += 1) {
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
    const submissions = await submitTurnActions(addresses, gameId, queueId, turn, seats, before);
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

  report.summary = summarize(report);
  const paths = await writeReport(report);
  log(`wrote ${paths.latestPath}`);
  log(`wrote ${paths.publicPath}`);
  console.log(JSON.stringify({ summary: report.summary, paths }, bigintReplacer, 2));
}

main().catch((error) => {
  console.error('[simulator] fatal:', error.shortMessage || error.message || String(error));
  process.exit(1);
});
