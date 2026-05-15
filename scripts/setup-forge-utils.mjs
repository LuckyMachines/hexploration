import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import {
  findScenario,
  loadScenarioStore,
  normalizeScenario,
  readJson,
  root,
  scenarioReportRoot,
  slugify,
  writeJson,
} from './scenario-utils.mjs';

export const SETUP_FORGE_VERSION = '1.0.0';
export const setupReportRoot = resolve(root, 'reports', 'simulator', 'setup-forge');
export const publicSetupReportRoot = resolve(root, 'app', 'public', 'simulator', 'setup-forge');

export const SETUP_STATUS = {
  SUPPORTED: 'supported',
  PARTIAL: 'partiallySupported',
  OBSERVED: 'observedOnly',
  CONTRACT_BLOCKED: 'contractBlocked',
  NOT_YET: 'notYetSupported',
};

export const SETUP_SUPPORT_MATRIX = {
  playerStats: { status: SETUP_STATUS.SUPPORTED, exact: true, hook: 'CharacterCard.setStats via local verified-controller role' },
  inventory: { status: SETUP_STATUS.SUPPORTED, exact: true, hook: 'GameToken.mintTo plus CharacterCard hand setters' },
  artifacts: { status: SETUP_STATUS.SUPPORTED, exact: true, hook: 'ITEM_TOKEN.mintTo plus CharacterCard.setArtifact' },
  revealedZones: { status: SETUP_STATUS.SUPPORTED, exact: true, hook: 'XenovoyaBoard.enableZone' },
  terrain: { status: SETUP_STATUS.SUPPORTED, exact: true, hook: 'XenovoyaBoard.enableZone with tile enum' },
  campsites: { status: SETUP_STATUS.SUPPORTED, exact: true, hook: 'ITEM_TOKEN.mint plus transferToZone' },
  playerLocations: { status: SETUP_STATUS.PARTIAL, exact: false, hook: 'XenovoyaBoard.moveThroughPath after start' },
  landingZone: { status: SETUP_STATUS.CONTRACT_BLOCKED, exact: false, hook: 'Initial play zone is selected during setup; post-start mutation is unsafe' },
  currentDay: { status: SETUP_STATUS.CONTRACT_BLOCKED, exact: false, hook: 'Day derives from queue history length' },
  phase: { status: SETUP_STATUS.PARTIAL, exact: false, hook: 'DAY_NIGHT_TOKEN balance can be flipped, but queue history is unchanged' },
  queuePhase: { status: SETUP_STATUS.CONTRACT_BLOCKED, exact: false, hook: 'Queue phase has no safe public setup setter' },
  pressure: { status: SETUP_STATUS.SUPPORTED, exact: false, hook: 'Simulator strategy and balance pressure' },
  scriptedPrelude: { status: SETUP_STATUS.SUPPORTED, exact: false, hook: 'Run setup turns before measured turns' },
  events: { status: SETUP_STATUS.OBSERVED, exact: false, hook: 'Events can be described; synthetic event mutation is not used' },
};

export const TILE_ENUM = {
  Default: 0,
  Jungle: 1,
  Plains: 2,
  Desert: 3,
  Mountain: 4,
  LandingSite: 5,
  RelicMystery: 6,
  Relic1: 7,
  Relic2: 8,
  Relic3: 9,
  Relic4: 10,
  Relic5: 11,
  RelicEmpty: 12,
};

export const SETUP_ABIS = {
  access: [
    { type: 'function', name: 'hasRole', stateMutability: 'view', inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }], outputs: [{ type: 'bool' }] },
    { type: 'function', name: 'addVerifiedController', stateMutability: 'nonpayable', inputs: [{ name: 'controllerAddress', type: 'address' }], outputs: [] },
  ],
  characterCard: [
    { type: 'function', name: 'addVerifiedController', stateMutability: 'nonpayable', inputs: [{ name: 'controllerAddress', type: 'address' }], outputs: [] },
    { type: 'function', name: 'setStats', stateMutability: 'nonpayable', inputs: [{ name: 'stats', type: 'uint8[3]' }, { name: 'gameID', type: 'uint256' }, { name: 'playerID', type: 'uint256' }], outputs: [] },
    { type: 'function', name: 'setLeftHandItem', stateMutability: 'nonpayable', inputs: [{ name: 'itemTokenType', type: 'string' }, { name: 'gameID', type: 'uint256' }, { name: 'playerID', type: 'uint256' }], outputs: [] },
    { type: 'function', name: 'setRightHandItem', stateMutability: 'nonpayable', inputs: [{ name: 'itemTokenType', type: 'string' }, { name: 'gameID', type: 'uint256' }, { name: 'playerID', type: 'uint256' }], outputs: [] },
    { type: 'function', name: 'setArtifact', stateMutability: 'nonpayable', inputs: [{ name: 'itemTokenType', type: 'string' }, { name: 'gameID', type: 'uint256' }, { name: 'playerID', type: 'uint256' }], outputs: [] },
  ],
  board: [
    { type: 'function', name: 'addVerifiedController', stateMutability: 'nonpayable', inputs: [{ name: 'vcAddress', type: 'address' }], outputs: [] },
    { type: 'function', name: 'enableZone', stateMutability: 'nonpayable', inputs: [{ name: '_zoneAlias', type: 'string' }, { name: 'tile', type: 'uint8' }, { name: 'gameID', type: 'uint256' }], outputs: [] },
    { type: 'function', name: 'moveThroughPath', stateMutability: 'nonpayable', inputs: [{ name: 'zonePath', type: 'string[]' }, { name: 'playerID', type: 'uint256' }, { name: 'gameID', type: 'uint256' }, { name: 'tiles', type: 'uint8[]' }], outputs: [] },
    { type: 'function', name: 'zoneIndex', stateMutability: 'view', inputs: [{ name: '_zoneAlias', type: 'string' }], outputs: [{ name: 'index', type: 'uint256' }] },
  ],
  gameToken: [
    { type: 'function', name: 'addController', stateMutability: 'nonpayable', inputs: [{ name: 'controllerAddress', type: 'address' }], outputs: [] },
    { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'tokenType', type: 'string' }, { name: 'gameID', type: 'uint256' }, { name: 'quantity', type: 'uint256' }], outputs: [] },
    { type: 'function', name: 'mintTo', stateMutability: 'nonpayable', inputs: [{ name: 'recipient', type: 'uint256' }, { name: 'tokenType', type: 'string' }, { name: 'gameID', type: 'uint256' }, { name: 'quantity', type: 'uint256' }], outputs: [] },
    { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'tokenType', type: 'string' }, { name: 'gameID', type: 'uint256' }, { name: 'fromID', type: 'uint256' }, { name: 'toID', type: 'uint256' }, { name: 'quantity', type: 'uint256' }], outputs: [] },
    { type: 'function', name: 'transferToZone', stateMutability: 'nonpayable', inputs: [{ name: 'tokenType', type: 'string' }, { name: 'gameID', type: 'uint256' }, { name: 'fromID', type: 'uint256' }, { name: 'toZoneIndex', type: 'uint256' }, { name: 'quantity', type: 'uint256' }], outputs: [] },
  ],
};

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

export function setupIdFor(scenarioId, setupForge) {
  const hash = createHash('sha256').update(JSON.stringify(setupForge || {})).digest('hex').slice(0, 12);
  return `${slugify(scenarioId || 'setup')}-${hash}`;
}

export function normalizeCoordinate(value) {
  const match = String(value || '').trim().match(/^(-?\d+)\s*,\s*(-?\d+)$/);
  return match ? `${Number(match[1])},${Number(match[2])}` : '';
}

function normalizeStats(stats = {}) {
  return {
    movement: clamp(stats.movement ?? stats.move ?? 3, 0, 4),
    agility: clamp(stats.agility ?? 3, 0, 4),
    dexterity: clamp(stats.dexterity ?? 3, 0, 4),
  };
}

function normalizePlayer(player = {}, index = 0) {
  const playerIndex = clamp(player.playerIndex ?? player.index ?? index, 0, 3);
  return {
    playerIndex,
    playerId: playerIndex + 1,
    stats: player.stats ? normalizeStats(player.stats) : null,
    inventory: Array.isArray(player.inventory) ? player.inventory.map(String).filter(Boolean) : [],
    artifacts: Array.isArray(player.artifacts) ? player.artifacts.map(String).filter(Boolean) : [],
    location: normalizeCoordinate(player.location || ''),
    critical: Boolean(player.critical),
    notes: player.notes || '',
  };
}

export function normalizeSetupForge(setupForge = {}, scenario = {}) {
  const setup = clone(setupForge);
  const players = Array.isArray(setup.players) ? setup.players.map(normalizePlayer) : [];
  const board = setup.board || {};
  const pressure = setup.pressure || {};
  const time = setup.time || {};
  const scriptedPrelude = setup.scriptedPrelude || {};
  const normalized = {
    schemaVersion: 1,
    setupId: setup.setupId || setupIdFor(scenario.id, setup),
    requiredSetupLevel: setup.requiredSetupLevel || scenario.requiredSetupLevel || (scenario.importance === 'core' ? 'partial' : 'metadata'),
    modeHint: setup.modeHint || 'best-effort',
    players,
    board: {
      revealedZones: Array.isArray(board.revealedZones) ? board.revealedZones.map(normalizeCoordinate).filter(Boolean) : [],
      terrain: Object.fromEntries(Object.entries(board.terrain || {}).map(([alias, tile]) => [normalizeCoordinate(alias), TILE_ENUM[tile] !== undefined ? tile : 'Jungle']).filter(([alias]) => alias)),
      landingZone: normalizeCoordinate(board.landingZone || ''),
      campsites: Array.isArray(board.campsites) ? board.campsites.map(normalizeCoordinate).filter(Boolean) : [],
    },
    time: {
      day: time.day === undefined ? null : Math.max(1, Number(time.day) || 1),
      phase: ['Day', 'Night'].includes(time.phase) ? time.phase : '',
      queuePhase: time.queuePhase || '',
    },
    pressure: {
      strategies: Array.isArray(pressure.strategies) ? pressure.strategies.map(String).filter(Boolean) : [],
      escapePressure: Boolean(pressure.escapePressure),
      lowStatPressure: Boolean(pressure.lowStatPressure),
      notes: pressure.notes || '',
    },
    scriptedPrelude: {
      turns: Math.max(0, Number(scriptedPrelude.turns || 0)),
      strategies: Array.isArray(scriptedPrelude.strategies) ? scriptedPrelude.strategies.map(String).filter(Boolean) : [],
      stopWhen: scriptedPrelude.stopWhen || '',
      discardPreludeFromMetrics: scriptedPrelude.discardPreludeFromMetrics !== false,
    },
    events: Array.isArray(setup.events) ? setup.events.map(String).filter(Boolean) : [],
    notes: setup.notes || '',
    createdAt: setup.createdAt || now(),
    updatedAt: now(),
  };
  normalized.coverage = setupCoverage(scenario, normalized);
  return normalized;
}

export function setupFields(setupForge = {}) {
  const fields = [];
  for (const player of setupForge.players || []) {
    if (player.stats) fields.push({ key: 'playerStats', critical: player.critical, label: `P${player.playerId} stats` });
    if (player.inventory?.length) fields.push({ key: 'inventory', critical: player.critical, label: `P${player.playerId} inventory` });
    if (player.artifacts?.length) fields.push({ key: 'artifacts', critical: true, label: `P${player.playerId} artifacts` });
    if (player.location) fields.push({ key: 'playerLocations', critical: player.critical, label: `P${player.playerId} location` });
  }
  if (setupForge.board?.revealedZones?.length) fields.push({ key: 'revealedZones', critical: false, label: 'revealed zones' });
  if (Object.keys(setupForge.board?.terrain || {}).length) fields.push({ key: 'terrain', critical: false, label: 'terrain' });
  if (setupForge.board?.landingZone) fields.push({ key: 'landingZone', critical: true, label: 'landing zone' });
  if (setupForge.board?.campsites?.length) fields.push({ key: 'campsites', critical: false, label: 'campsites' });
  if (setupForge.time?.day) fields.push({ key: 'currentDay', critical: false, label: 'current day' });
  if (setupForge.time?.phase) fields.push({ key: 'phase', critical: false, label: 'phase' });
  if (setupForge.time?.queuePhase) fields.push({ key: 'queuePhase', critical: false, label: 'queue phase' });
  if (setupForge.pressure?.strategies?.length || setupForge.pressure?.escapePressure || setupForge.pressure?.lowStatPressure) fields.push({ key: 'pressure', critical: false, label: 'pressure' });
  if (setupForge.scriptedPrelude?.turns > 0) fields.push({ key: 'scriptedPrelude', critical: false, label: 'scripted prelude' });
  if (setupForge.events?.length) fields.push({ key: 'events', critical: false, label: 'events' });
  return fields;
}

export function validateSetupForge(setupForge = {}, scenario = {}, mode = 'best-effort') {
  const setup = normalizeSetupForge(setupForge, scenario);
  const errors = [];
  const warnings = [];
  const support = [];
  const seenPlayers = new Set();
  for (const player of setup.players) {
    if (seenPlayers.has(player.playerIndex)) errors.push(`duplicate playerIndex ${player.playerIndex}`);
    seenPlayers.add(player.playerIndex);
    if (player.playerIndex < 0 || player.playerIndex > 3) errors.push(`playerIndex ${player.playerIndex} is outside 0-3`);
    for (const [stat, value] of Object.entries(player.stats || {})) {
      if (value < 0 || value > 4) errors.push(`P${player.playerId} ${stat} must be 0-4`);
    }
    if (player.artifacts.length > 1) warnings.push(`P${player.playerId} has multiple requested artifacts; engine currently tracks one active artifact string`);
  }
  for (const alias of [...setup.board.revealedZones, setup.board.landingZone, ...setup.board.campsites, ...Object.keys(setup.board.terrain)]) {
    if (alias && !normalizeCoordinate(alias)) errors.push(`invalid coordinate alias: ${alias}`);
  }
  if (setup.requiredSetupLevel && !['metadata', 'partial', 'exact'].includes(setup.requiredSetupLevel)) errors.push(`invalid requiredSetupLevel: ${setup.requiredSetupLevel}`);
  for (const field of setupFields(setup)) {
    const matrix = SETUP_SUPPORT_MATRIX[field.key] || { status: SETUP_STATUS.NOT_YET, exact: false, hook: 'no support entry' };
    const blocked = [SETUP_STATUS.CONTRACT_BLOCKED, SETUP_STATUS.NOT_YET].includes(matrix.status);
    support.push({ ...field, ...matrix });
    if (mode === 'strict' && (blocked || (field.critical && !matrix.exact))) errors.push(`${field.label} is ${matrix.status} in strict mode`);
    else if (blocked) warnings.push(`${field.label} is ${matrix.status}: ${matrix.hook}`);
    else if (field.critical && !matrix.exact) warnings.push(`${field.label} is critical but only ${matrix.status}: ${matrix.hook}`);
  }
  if ((scenario.initialState?.assumptions || []).length > 0 && setupFields(setup).length === 0) {
    warnings.push('scenario has initial assumptions but no setupForge fields');
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    support,
    setupForge: setup,
    coverage: setup.coverage,
  };
}

export function parseSetupForgeIntent(text = {}, scenario = {}) {
  const source = typeof text === 'string' ? text : `${scenario.description || ''} ${scenario.designQuestion || ''}`;
  const lower = source.toLowerCase();
  const players = [];
  const exhaustedMatch = lower.match(/(\d+|one|two|three|four)\s+exhausted/);
  const exhaustedCount = exhaustedMatch ? wordNumber(exhaustedMatch[1]) : /(exhausted|weak|injured|low stat)/.test(lower) ? 1 : 0;
  for (let index = 0; index < Math.min(4, exhaustedCount); index += 1) {
    players.push({
      playerIndex: index,
      stats: { movement: 1, agility: 1, dexterity: 1 },
      critical: true,
      notes: 'Parsed exhausted/weak player setup.',
    });
  }
  if (/artifact/.test(lower) && /(has|holding|with|one artifact|artifact holder)/.test(lower)) {
    const target = players[1] || { playerIndex: players.length > 0 ? 1 : 0 };
    target.artifacts = target.artifacts?.length ? target.artifacts : ['Engraved Tablet'];
    target.critical = true;
    if (!players.includes(target)) players.push(target);
  }
  if (/(separated|spread out|split)/.test(lower)) {
    for (let index = 0; index < Math.max(players.length, Number(scenario.players || 2)); index += 1) {
      const existing = players.find((player) => player.playerIndex === index) || { playerIndex: index };
      existing.location = [`0,0`, `1,0`, `0,1`, `1,1`][index] || '0,0';
      if (!players.includes(existing)) players.push(existing);
    }
  }
  const dayMatch = lower.match(/day\s+(\d+)/);
  const landingRevealed = /landing.*revealed|revealed.*landing|landing.*relevance|landing.*near/.test(lower);
  const nearCampsite = /camp|campsite/.test(lower);
  return normalizeSetupForge({
    players,
    board: {
      revealedZones: landingRevealed ? ['0,0', '1,0', '1,1'] : [],
      landingZone: landingRevealed ? '2,1' : '',
      campsites: nearCampsite ? ['1,0'] : [],
    },
    time: {
      day: dayMatch ? Number(dayMatch[1]) : null,
      phase: /night/.test(lower) ? 'Night' : /day/.test(lower) ? 'Day' : '',
    },
    pressure: {
      strategies: /escape|flee/.test(lower) ? ['risky', 'move'] : /artifact|dig/.test(lower) ? ['dig'] : [],
      escapePressure: /escape|flee|landing/.test(lower),
      lowStatPressure: exhaustedCount > 0 || /pressure|survival/.test(lower),
      notes: source,
    },
    scriptedPrelude: {
      turns: /pressure|day\s+[2-9]/.test(lower) ? 1 : 0,
      strategies: /escape|flee/.test(lower) ? ['risky'] : ['balanced'],
      discardPreludeFromMetrics: true,
    },
    notes: source,
  }, scenario);
}

function wordNumber(value) {
  return { one: 1, two: 2, three: 3, four: 4 }[String(value).toLowerCase()] || Number(value) || 0;
}

export function setupCoverage(scenario = {}, setupForge = {}) {
  const assumptions = scenario.initialState?.assumptions || [];
  const fields = setupFields(setupForge);
  const represented = assumptions.filter((assumption) => {
    const keyMap = {
      playerStats: 'playerStats',
      artifactsHeld: 'artifacts',
      landingRevealed: 'landingZone',
      campsites: 'campsites',
      revealedZones: 'revealedZones',
      inventory: 'inventory',
      queuePhase: 'queuePhase',
      dayNumber: 'currentDay',
    };
    return fields.some((field) => field.key === (keyMap[assumption.key] || assumption.key));
  }).length;
  const enforceable = fields.filter((field) => {
    const matrix = SETUP_SUPPORT_MATRIX[field.key];
    return matrix && ![SETUP_STATUS.CONTRACT_BLOCKED, SETUP_STATUS.NOT_YET, SETUP_STATUS.OBSERVED].includes(matrix.status);
  }).length;
  return {
    assumptionCoverage: assumptions.length > 0 ? represented / assumptions.length : fields.length > 0 ? 1 : 0,
    enforceableCoverage: fields.length > 0 ? enforceable / fields.length : 0,
    fieldCount: fields.length,
    criticalCount: fields.filter((field) => field.critical).length,
  };
}

function applied(field, detail = {}) {
  return { field, status: 'applied', ...detail };
}

function skipped(field, reason, detail = {}) {
  return { field, status: 'skipped', reason, ...detail };
}

function failed(field, error, detail = {}) {
  return { field, status: 'failed', error: error.message || String(error), ...detail };
}

async function safeWrite(adapter, wallet, address, abi, functionName, args = []) {
  const receipt = await adapter.writeContract(wallet, address, abi, functionName, args);
  return receipt?.transactionHash || receipt?.hash || null;
}

async function ensureLocalRoles(adapter, context, application) {
  const { addresses, deployerWallet, deployerAddress } = context;
  if (addresses.BOARD) {
    try {
      const hash = await safeWrite(adapter, deployerWallet, addresses.BOARD, SETUP_ABIS.board, 'addVerifiedController', [deployerAddress]);
      application.roleGrants.push({ contract: 'BOARD', role: 'VERIFIED_CONTROLLER_ROLE', hash });
    } catch (error) {
      application.warnings.push(`BOARD role grant skipped: ${error.shortMessage || error.message || String(error)}`);
    }
  }
  if (addresses.CHARACTER_CARD) {
    try {
      const hash = await safeWrite(adapter, deployerWallet, addresses.CHARACTER_CARD, SETUP_ABIS.characterCard, 'addVerifiedController', [deployerAddress]);
      application.roleGrants.push({ contract: 'CHARACTER_CARD', role: 'VERIFIED_CONTROLLER_ROLE', hash });
    } catch (error) {
      application.warnings.push(`CHARACTER_CARD role grant skipped: ${error.shortMessage || error.message || String(error)}`);
    }
  }
  for (const key of ['ITEM_TOKEN', 'DAY_NIGHT_TOKEN']) {
    if (!addresses[key]) continue;
    try {
      const hash = await safeWrite(adapter, deployerWallet, addresses[key], SETUP_ABIS.gameToken, 'addController', [deployerAddress]);
      application.roleGrants.push({ contract: key, role: 'CONTROLLER_ROLE', hash });
    } catch (error) {
      application.warnings.push(`${key} controller grant skipped: ${error.shortMessage || error.message || String(error)}`);
    }
  }
}

export async function applySetupForge(adapter, context, setupForgeInput = {}, options = {}) {
  const scenario = context.scenario || {};
  const mode = options.mode || setupForgeInput.modeHint || 'best-effort';
  const setupForge = normalizeSetupForge(setupForgeInput, scenario);
  const validation = validateSetupForge(setupForge, scenario, mode);
  const application = {
    schemaVersion: 1,
    setupForgeVersion: SETUP_FORGE_VERSION,
    generatedAt: now(),
    setupId: setupForge.setupId,
    mode,
    requiredSetupLevel: setupForge.requiredSetupLevel,
    support: validation.support,
    applied: [],
    skipped: [],
    failed: [],
    warnings: [...validation.warnings],
    errors: [...validation.errors],
    roleGrants: [],
    prelude: null,
    dryRun: Boolean(options.dryRun || mode === 'metadata-only'),
    coverage: setupForge.coverage,
  };
  if (!validation.ok && mode === 'strict') return application;
  if (application.dryRun) {
    for (const field of validation.support) application.skipped.push(skipped(field.key, mode === 'metadata-only' ? 'metadata-only mode' : 'dry-run', { label: field.label }));
    return application;
  }
  await ensureLocalRoles(adapter, context, application);
  const gameId = BigInt(context.gameId);
  for (const player of setupForge.players) {
    const playerId = BigInt(player.playerId);
    if (player.stats && context.addresses.CHARACTER_CARD) {
      try {
        const stats = [player.stats.movement, player.stats.agility, player.stats.dexterity];
        const hash = await safeWrite(adapter, context.deployerWallet, context.addresses.CHARACTER_CARD, SETUP_ABIS.characterCard, 'setStats', [stats, gameId, playerId]);
        application.applied.push(applied('playerStats', { playerId: player.playerId, label: `P${player.playerId} stats`, value: player.stats, hash }));
      } catch (error) {
        application.failed.push(failed('playerStats', error, { playerId: player.playerId, label: `P${player.playerId} stats` }));
      }
    }
    for (const item of player.inventory || []) {
      if (!context.addresses.ITEM_TOKEN || !context.addresses.CHARACTER_CARD) {
        application.skipped.push(skipped('inventory', 'missing ITEM_TOKEN or CHARACTER_CARD address', { playerId: player.playerId, label: `P${player.playerId} inventory`, item }));
        continue;
      }
      try {
        const mintHash = await safeWrite(adapter, context.deployerWallet, context.addresses.ITEM_TOKEN, SETUP_ABIS.gameToken, 'mintTo', [playerId, item, gameId, 1n]);
        const hand = player.inventory.indexOf(item) === 0 ? 'setLeftHandItem' : 'setRightHandItem';
        const handHash = await safeWrite(adapter, context.deployerWallet, context.addresses.CHARACTER_CARD, SETUP_ABIS.characterCard, hand, [item, gameId, playerId]);
        application.applied.push(applied('inventory', { playerId: player.playerId, label: `P${player.playerId} inventory`, item, hash: handHash, mintHash }));
      } catch (error) {
        application.failed.push(failed('inventory', error, { playerId: player.playerId, label: `P${player.playerId} inventory`, item }));
      }
    }
    for (const artifact of player.artifacts || []) {
      if (!context.addresses.ITEM_TOKEN || !context.addresses.CHARACTER_CARD) {
        application.skipped.push(skipped('artifacts', 'missing ITEM_TOKEN or CHARACTER_CARD address', { playerId: player.playerId, label: `P${player.playerId} artifacts`, artifact }));
        continue;
      }
      try {
        const mintHash = await safeWrite(adapter, context.deployerWallet, context.addresses.ITEM_TOKEN, SETUP_ABIS.gameToken, 'mintTo', [playerId, artifact, gameId, 1n]);
        const hash = await safeWrite(adapter, context.deployerWallet, context.addresses.CHARACTER_CARD, SETUP_ABIS.characterCard, 'setArtifact', [artifact, gameId, playerId]);
        application.applied.push(applied('artifacts', { playerId: player.playerId, label: `P${player.playerId} artifacts`, artifact, hash, mintHash }));
      } catch (error) {
        application.failed.push(failed('artifacts', error, { playerId: player.playerId, label: `P${player.playerId} artifacts`, artifact }));
      }
    }
    if (player.location && context.addresses.BOARD) {
      try {
        const tile = TILE_ENUM[setupForge.board.terrain[player.location] || 'Jungle'];
        const hash = await safeWrite(adapter, context.deployerWallet, context.addresses.BOARD, SETUP_ABIS.board, 'moveThroughPath', [[player.location], playerId, gameId, [tile]]);
        application.applied.push(applied('playerLocations', { playerId: player.playerId, label: `P${player.playerId} location`, location: player.location, hash }));
      } catch (error) {
        application.failed.push(failed('playerLocations', error, { playerId: player.playerId, label: `P${player.playerId} location`, location: player.location }));
      }
    }
  }
  const zones = new Set([...(setupForge.board.revealedZones || []), ...Object.keys(setupForge.board.terrain || {})]);
  for (const alias of zones) {
    try {
      const tile = TILE_ENUM[setupForge.board.terrain[alias] || 'Jungle'];
      const hash = await safeWrite(adapter, context.deployerWallet, context.addresses.BOARD, SETUP_ABIS.board, 'enableZone', [alias, tile, gameId]);
      application.applied.push(applied('revealedZones', { alias, tile: setupForge.board.terrain[alias] || 'Jungle', hash }));
    } catch (error) {
      application.failed.push(failed('revealedZones', error, { alias }));
    }
  }
  if (setupForge.board.landingZone) {
    application.skipped.push(skipped('landingZone', SETUP_SUPPORT_MATRIX.landingZone.hook, { alias: setupForge.board.landingZone }));
  }
  for (const alias of setupForge.board.campsites || []) {
    if (!context.addresses.ITEM_TOKEN || !context.addresses.BOARD) {
      application.skipped.push(skipped('campsites', 'missing ITEM_TOKEN or BOARD address', { alias }));
      continue;
    }
    try {
      const zoneIndex = await adapter.readContract(context.addresses.BOARD, SETUP_ABIS.board, 'zoneIndex', [alias]);
      const mintHash = await safeWrite(adapter, context.deployerWallet, context.addresses.ITEM_TOKEN, SETUP_ABIS.gameToken, 'mint', ['Campsite', gameId, 1n]);
      const hash = await safeWrite(adapter, context.deployerWallet, context.addresses.ITEM_TOKEN, SETUP_ABIS.gameToken, 'transferToZone', ['Campsite', gameId, 0n, BigInt(zoneIndex), 1n]);
      application.applied.push(applied('campsites', { alias, zoneIndex: Number(zoneIndex), hash, mintHash }));
    } catch (error) {
      application.failed.push(failed('campsites', error, { alias }));
    }
  }
  if (setupForge.time.day) application.skipped.push(skipped('currentDay', SETUP_SUPPORT_MATRIX.currentDay.hook, { day: setupForge.time.day }));
  if (setupForge.time.queuePhase) application.skipped.push(skipped('queuePhase', SETUP_SUPPORT_MATRIX.queuePhase.hook, { queuePhase: setupForge.time.queuePhase }));
  if (setupForge.time.phase) application.skipped.push(skipped('phase', SETUP_SUPPORT_MATRIX.phase.hook, { phase: setupForge.time.phase }));
  return application;
}

export function compareRequestedToActualSetup(setupForge = {}, snapshot = {}) {
  const diff = [];
  const players = snapshot.players || [];
  for (const player of setupForge.players || []) {
    const actual = players.find((item) => Number(item.playerId) === Number(player.playerId));
    if (!actual) {
      diff.push({ field: 'player', playerId: player.playerId, status: 'missing' });
      continue;
    }
    if (player.stats) {
      const actualStats = actual.stats || {};
      const pass = actualStats.movement === player.stats.movement && actualStats.agility === player.stats.agility && actualStats.dexterity === player.stats.dexterity;
      diff.push({ field: 'playerStats', playerId: player.playerId, requested: player.stats, actual: actualStats, pass });
    }
    if (player.location) diff.push({ field: 'playerLocations', playerId: player.playerId, requested: player.location, actual: actual.location, pass: actual.location === player.location });
    for (const artifact of player.artifacts || []) diff.push({ field: 'artifacts', playerId: player.playerId, requested: artifact, actual: actual.artifacts || [], pass: (actual.artifacts || []).includes(artifact) });
  }
  const activeZones = snapshot.activeZones?.zones || snapshot.activeZones?.aliases || [];
  for (const alias of setupForge.board?.revealedZones || []) {
    diff.push({ field: 'revealedZones', requested: alias, actual: activeZones, pass: activeZones.includes(alias) });
  }
  return diff;
}

export function setupApplicationLevel(application = {}) {
  const critical = (application.support || []).filter((field) => field.critical);
  const appliedCritical = critical.filter((field) => (application.applied || []).some((item) => setupEntryMatchesField(item, field)));
  if ((application.errors || []).length > 0 || (application.failed || []).length > 0) return 'blocked';
  if ((application.applied || []).length === 0) return 'metadata';
  if (critical.length > 0 && appliedCritical.length < critical.length) return 'partial';
  return (application.skipped || []).length > 0 ? 'partial' : 'exact';
}

function setupEntryMatchesField(entry = {}, field = {}) {
  if (entry.field !== field.key) return false;
  if (!field.label || !entry.label) return true;
  return entry.label === field.label;
}

export function setupReportPaths(scenarioId = null) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = scenarioId ? resolve(scenarioReportRoot, scenarioId) : setupReportRoot;
  return {
    latest: resolve(base, 'latest-setup-report.json'),
    stamped: resolve(base, `setup-${stamp}.json`),
    history: resolve(base, 'setup-history.json'),
    publicLatest: resolve(publicSetupReportRoot, 'latest-report.json'),
  };
}

export function writeSetupReport(report, scenarioId = null) {
  const paths = setupReportPaths(scenarioId);
  writeJson(paths.latest, report);
  writeJson(paths.stamped, report);
  writeJson(paths.publicLatest, report);
  const history = readJson(paths.history, []);
  writeJson(paths.history, [{
    generatedAt: report.generatedAt,
    scenarioId: report.scenarioId || scenarioId || null,
    setupId: report.setupForge?.setupId || report.setupId,
    mode: report.mode || report.setupApplication?.mode,
    level: report.setupLevel,
    applied: report.setupApplication?.applied?.length || 0,
    skipped: report.setupApplication?.skipped?.length || 0,
    failed: report.setupApplication?.failed?.length || 0,
    reportPath: paths.stamped,
  }, ...(Array.isArray(history) ? history : [])].slice(0, 100));
  return paths;
}

export function markdownForSetupReport(report = {}) {
  const application = report.setupApplication || report;
  const rows = [...(application.applied || []), ...(application.skipped || []), ...(application.failed || [])]
    .map((item) => `| ${item.field} | ${item.status} | ${item.reason || item.error || item.hash || ''} |`)
    .join('\n') || '| none | none | |';
  return `# Scenario Setup Forge Report

Generated: ${report.generatedAt || application.generatedAt || now()}

Scenario: ${report.scenarioId || 'custom'}

Mode: ${application.mode || report.mode || 'best-effort'}

Setup level: ${report.setupLevel || setupApplicationLevel(application)}

## Fields

| Field | Status | Detail |
| --- | --- | --- |
${rows}

## Warnings

${(application.warnings || []).map((warning) => `- ${warning}`).join('\n') || '- None'}
`;
}

export function setupDoctor() {
  const store = loadScenarioStore();
  const scenarios = (store.scenarios || []).map((scenario) => {
    const normalized = normalizeScenario(scenario);
    const setup = normalizeSetupForge(normalized.setupForge || {}, normalized);
    const validation = validateSetupForge(setup, normalized);
    const blockedFields = validation.support.filter((field) => [SETUP_STATUS.CONTRACT_BLOCKED, SETUP_STATUS.NOT_YET].includes(field.status));
    return {
      id: normalized.id,
      importance: normalized.importance || 'supporting',
      requiredSetupLevel: setup.requiredSetupLevel,
      hasSetupForge: validation.support.length > 0,
      assumptionCoverage: setup.coverage.assumptionCoverage,
      enforceableCoverage: setup.coverage.enforceableCoverage,
      blockedFields: blockedFields.map((field) => field.key),
      warnings: validation.warnings,
      errors: validation.errors,
    };
  });
  return {
    generatedAt: now(),
    scenarios,
    missingSetupForge: scenarios.filter((scenario) => !scenario.hasSetupForge).map((scenario) => scenario.id),
    strictBlockers: scenarios.filter((scenario) => scenario.errors.length > 0 || scenario.blockedFields.length > 0).map((scenario) => scenario.id),
    supportBacklog: setupBacklog(scenarios),
  };
}

export function setupBacklog(scenarios = null) {
  const rows = scenarios || setupDoctor().scenarios;
  const counts = {};
  for (const scenario of rows) {
    const weight = scenario.importance === 'core' ? 3 : 1;
    for (const field of scenario.blockedFields || []) counts[field] = (counts[field] || 0) + weight;
  }
  const labels = {
    landingZone: 'Add safe pre-start landing-zone override',
    currentDay: 'Add dev-only queue/day seeding hook',
    queuePhase: 'Add dev-only queue phase harness',
    events: 'Add synthetic scenario event emitter',
  };
  return Object.entries(counts)
    .map(([field, score]) => ({ field, score, recommendation: labels[field] || `Add setup support for ${field}` }))
    .sort((a, b) => b.score - a.score || a.field.localeCompare(b.field));
}

export function loadScenarioForSetup(id) {
  const store = loadScenarioStore();
  const scenario = findScenario(store, id);
  if (!scenario) throw new Error(`Unknown scenario id: ${id}`);
  return normalizeScenario(scenario);
}

export function writeMarkdown(path, report) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, markdownForSetupReport(report));
}
