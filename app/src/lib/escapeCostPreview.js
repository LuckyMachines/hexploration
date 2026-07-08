import { routeDistance } from './departPressure.js';
import { Action } from './constants.js';

export const ESCAPE_COST_LEVELS = {
  CLEAN: 'clean',
  CLOSE: 'close',
  ARTIFACT_RISK: 'artifact-risk',
  CREW_RISK: 'crew-risk',
  ROUTE_COLLAPSE: 'route-collapse',
  NOT_READY: 'not-ready',
};

export const MITIGATION_IDS = {
  DEPART_NOW: 'depart-now',
  RETURN_TO_LANDING: 'return-to-landing',
  RECOVER_VALUE: 'recover-value',
  SECURE_ARTIFACT: 'secure-artifact',
  HELP_WEAKEST: 'help-weakest',
  REST_CREW: 'rest-crew',
  REGROUP: 'regroup',
  STABILIZE_ROUTE: 'stabilize-route',
  STOP_DIGGING: 'stop-digging',
  KEEP_CHARTING: 'keep-charting-carefully',
  USE_SIGNAL: 'use-signal',
  FOLLOW_OLD_TRAIL: 'follow-old-trail',
  USE_CACHE: 'use-cache',
  REST_IN_SHELTER: 'rest-in-shelter',
  HELP_THROUGH_ECHO: 'help-through-echo',
  AVOID_UNSTABLE_GROUND: 'avoid-unstable-ground',
  LEAVE_RELIC_VEIN: 'leave-relic-vein',
  FALLBACK: 'reduce-pressure',
};

const REAL_ACTIONS = new Set([Action.FLEE, Action.MOVE, Action.DIG, Action.REST, Action.HELP]);

function itemName(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.name || value.id || '';
  return String(value);
}

export function selectAtRiskItem(activeInventory = {}) {
  const candidates = [
    activeInventory.artifact,
    activeInventory.relic,
    activeInventory.leftHandItem,
    activeInventory.rightHandItem,
  ].map(itemName).filter(Boolean);
  return candidates[0] || '';
}

function playerStat(player = {}, keys = []) {
  for (const key of keys) {
    const value = Number(player[key]);
    if (Number.isFinite(value)) return value;
  }
  const stats = player.stats || player.summary || {};
  for (const key of keys) {
    const value = Number(stats[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function playerWeaknessScore(player = {}) {
  if (player.isActive === false) return -100;
  const movement = playerStat(player, ['movement', 'Movement', 'move']);
  const agility = playerStat(player, ['agility', 'Agility']);
  const dexterity = playerStat(player, ['dexterity', 'Dexterity']);
  const stats = [movement, agility, dexterity].filter((value) => value > 0);
  if (stats.length === 0) return 999;
  return stats.reduce((sum, value) => sum + value, 0);
}

function statValue(stats = {}, keys = []) {
  for (const key of keys) {
    const value = Number(stats[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function lowestCurrentStat(stats = {}) {
  const values = [
    statValue(stats, ['movement', 'Movement', 'move']),
    statValue(stats, ['agility', 'Agility']),
    statValue(stats, ['dexterity', 'Dexterity']),
  ].filter((value) => value > 0);
  return values.length ? Math.min(...values) : 0;
}

export function selectAtRiskPlayer(players = []) {
  const indexed = players
    .map((player, index) => ({ player, index, score: playerWeaknessScore(player) }))
    .filter(({ player }) => player);
  if (indexed.length === 0) return null;
  indexed.sort((a, b) => a.score - b.score || a.index - b.index);
  const target = indexed[0];
  const player = target.player;
  const id = player.playerID ?? player.id ?? target.index + 1;
  return {
    id,
    label: `P${id}`,
    index: target.index,
    address: player.playerAddress || player.address || '',
  };
}

function hasWeakCrew(players = []) {
  return players.some((player) => player?.isActive === false || playerWeaknessScore(player) <= 5);
}

function mitigationTemplate(id, context = {}) {
  const {
    preview = {},
    movement = 0,
    atRiskItem = '',
    atRiskPlayer = null,
    currentDistanceToLanding = null,
    hasRecoveredValue = false,
    routeInvalid = false,
    stats = {},
    players = [],
    activeTab = null,
    departPressure = {},
    tileTraitEffects = null,
    tileTrait = null,
  } = context;
  const lowCurrentStat = lowestCurrentStat(stats) > 0 && lowestCurrentStat(stats) <= 1;
  const weakCrew = hasWeakCrew(players);
  const severe = preview.tone === 'red' || Number(preview.pressure || 0) >= 75;
  const awayFromLanding = currentDistanceToLanding === null || currentDistanceToLanding > 0;
  const routeStability = Number(departPressure.routeStability ?? (100 - Number(preview.pressure || 0)));
  const movementReady = Number(movement || 0) > 0;
  const common = {
    id,
    priority: 50,
    available: true,
    action: null,
    actionLabel: '',
    tone: 'gold',
    reason: '',
    effect: '',
    requirement: '',
  };

  const templates = {
    [MITIGATION_IDS.DEPART_NOW]: {
      ...common,
      label: 'Depart now',
      action: Action.FLEE,
      actionLabel: 'Flee',
      priority: 10,
      available: Boolean(preview.canEscape),
      requirement: preview.canEscape ? '' : 'Reach landing with recovered value first.',
      effect: 'Locks in the current forecast before another delay raises the cost.',
      reason: 'The run has an escape window.',
      tone: 'red',
    },
    [MITIGATION_IDS.RETURN_TO_LANDING]: {
      ...common,
      label: 'Return to landing',
      action: Action.MOVE,
      actionLabel: 'Move',
      priority: 18,
      available: awayFromLanding && movementReady,
      requirement: awayFromLanding ? 'Movement must be available.' : 'Already at landing.',
      effect: 'Moves the crew closer to a valid departure.',
      reason: currentDistanceToLanding === null ? 'Landing distance is unreadable.' : `Landing is ${currentDistanceToLanding} away.`,
      tone: 'gold',
    },
    [MITIGATION_IDS.RECOVER_VALUE]: {
      ...common,
      label: 'Recover value',
      action: Action.DIG,
      actionLabel: 'Dig',
      priority: 20,
      available: !awayFromLanding && !hasRecoveredValue,
      requirement: awayFromLanding ? 'Return to landing before making departure count.' : 'Search for recovered value.',
      effect: 'Creates recovered value so Flee can count.',
      reason: 'Escape is not meaningful without something recovered.',
      tone: 'gold',
    },
    [MITIGATION_IDS.SECURE_ARTIFACT]: {
      ...common,
      label: atRiskItem ? `Secure ${atRiskItem}` : 'Secure recovered value',
      action: preview.canEscape ? Action.FLEE : Action.MOVE,
      actionLabel: preview.canEscape ? 'Flee' : 'Move',
      priority: 12,
      available: hasRecoveredValue && (preview.canEscape || movementReady),
      requirement: hasRecoveredValue ? 'Escape or move home before another delay.' : 'Recover value first.',
      effect: atRiskItem
        ? `Helps keep ${atRiskItem} from becoming the cost of delay.`
        : 'Helps keep recovered value from becoming the cost of delay.',
      reason: 'Recovered value is the visible wager.',
      tone: 'orange',
    },
    [MITIGATION_IDS.HELP_WEAKEST]: {
      ...common,
      label: atRiskPlayer?.label ? `Help ${atRiskPlayer.label}` : 'Help weakest',
      action: Action.HELP,
      actionLabel: 'Help',
      priority: 14,
      available: players.length > 1 && Boolean(atRiskPlayer || weakCrew),
      requirement: players.length > 1 ? 'Choose a weak teammate to help.' : 'Needs another explorer.',
      effect: atRiskPlayer?.label
        ? `Helps reduce the chance ${atRiskPlayer.label} becomes the cost.`
        : 'Helps reduce the chance the weakest explorer becomes the cost.',
      reason: 'Crew risk is the current forecast.',
      tone: 'red',
    },
    [MITIGATION_IDS.REST_CREW]: {
      ...common,
      label: 'Rest crew',
      action: Action.REST,
      actionLabel: 'Rest',
      priority: 22,
      available: lowCurrentStat || severe,
      requirement: lowCurrentStat ? 'Pick the depleted stat.' : 'Use when stats are under pressure.',
      effect: 'Restores stats before pressure converts into loss.',
      reason: 'Low stats make crew risk stick.',
      tone: 'gold',
    },
    [MITIGATION_IDS.REGROUP]: {
      ...common,
      label: 'Regroup',
      action: weakCrew ? Action.HELP : Action.REST,
      actionLabel: weakCrew ? 'Help' : 'Rest',
      priority: 24,
      available: weakCrew || severe,
      requirement: weakCrew ? 'Help or rest the weakest explorer.' : 'Use Rest or Help to stabilize.',
      effect: 'Reduces the chance pressure turns into a crew loss.',
      reason: 'The crew needs stability before another push.',
      tone: 'gold',
    },
    [MITIGATION_IDS.STABILIZE_ROUTE]: {
      ...common,
      label: 'Stabilize route',
      action: movementReady ? Action.MOVE : lowCurrentStat ? Action.REST : Action.HELP,
      actionLabel: movementReady ? 'Move' : lowCurrentStat ? 'Rest' : 'Help',
      priority: 16,
      available: routeInvalid || movementReady || routeStability <= 35 || severe,
      requirement: movementReady ? 'Plan movement toward landing.' : 'Recover movement or help crew first.',
      effect: 'Rebuilds route readability before collapse.',
      reason: routeInvalid ? 'The planned route is invalid.' : 'Route stability is low.',
      tone: 'red',
    },
    [MITIGATION_IDS.STOP_DIGGING]: {
      ...common,
      label: 'Stop digging',
      action: preview.canEscape ? Action.FLEE : awayFromLanding ? Action.MOVE : Action.REST,
      actionLabel: preview.canEscape ? 'Flee' : awayFromLanding ? 'Move' : 'Rest',
      priority: activeTab === Action.DIG ? 8 : 28,
      available: ['artifact-risk', 'crew-risk', 'route-collapse'].includes(preview.costType),
      requirement: 'Choose a non-Dig action while the forecast is severe.',
      effect: 'Prevents a new pressure spike.',
      reason: 'Digging can raise the cost tier.',
      tone: 'orange',
    },
    [MITIGATION_IDS.KEEP_CHARTING]: {
      ...common,
      label: 'Chart carefully',
      action: Action.MOVE,
      actionLabel: 'Move',
      priority: 32,
      available: movementReady,
      requirement: 'Use short movement and keep landing readable.',
      effect: 'Keeps agency high without turning safety into pressure.',
      reason: 'The route is still stable.',
      tone: 'green',
    },
    [MITIGATION_IDS.FALLBACK]: {
      ...common,
      label: 'Reduce pressure',
      action: movementReady ? Action.MOVE : Action.REST,
      actionLabel: movementReady ? 'Move' : 'Rest',
      priority: 90,
      available: true,
      requirement: 'Move home, rest, help, or flee when ready.',
      effect: 'Can reduce pressure by moving home, resting, helping, or fleeing when ready.',
      reason: 'No direct mitigation is currently available.',
      tone: 'gold',
    },
    [MITIGATION_IDS.USE_SIGNAL]: {
      ...common,
      label: 'Use signal',
      action: preview.canEscape ? Action.FLEE : Action.MOVE,
      actionLabel: preview.canEscape ? 'Flee' : 'Move',
      priority: 11,
      available: true,
      requirement: 'Move or depart through the signal while it helps.',
      effect: 'Uses the tile signal to help reduce route pressure.',
      reason: 'The intent tile is improving route readability.',
      tone: 'blue',
    },
    [MITIGATION_IDS.FOLLOW_OLD_TRAIL]: {
      ...common,
      label: 'Follow old trail',
      action: Action.MOVE,
      actionLabel: 'Move',
      priority: 13,
      available: movementReady,
      requirement: 'Movement must be available.',
      effect: 'Follows the old trail to help reduce pressure toward landing.',
      reason: 'The tile supports safer movement.',
      tone: 'gold',
    },
    [MITIGATION_IDS.USE_CACHE]: {
      ...common,
      label: 'Use cache',
      action: preview.canEscape ? Action.FLEE : Action.DIG,
      actionLabel: preview.canEscape ? 'Flee' : 'Dig',
      priority: 15,
      available: true,
      requirement: 'Use the cache before taking a greedier risk.',
      effect: 'Uses the cache to help reduce value risk.',
      reason: 'The tile can secure value.',
      tone: 'green',
    },
    [MITIGATION_IDS.REST_IN_SHELTER]: {
      ...common,
      label: 'Rest in shelter',
      action: Action.REST,
      actionLabel: 'Rest',
      priority: 15,
      available: true,
      requirement: 'Rest while shelter improves recovery.',
      effect: 'Uses shelter to help reduce crew-risk pressure.',
      reason: 'The tile turns Rest into counterplay.',
      tone: 'green',
    },
    [MITIGATION_IDS.HELP_THROUGH_ECHO]: {
      ...common,
      label: 'Help through echo',
      action: Action.HELP,
      actionLabel: 'Help',
      priority: 15,
      available: true,
      requirement: 'Use Help while the echo carries.',
      effect: 'Uses the echo field to help reduce crew risk.',
      reason: 'The tile strengthens team support.',
      tone: 'blue',
    },
    [MITIGATION_IDS.AVOID_UNSTABLE_GROUND]: {
      ...common,
      label: 'Avoid unstable ground',
      action: awayFromLanding ? Action.MOVE : Action.REST,
      actionLabel: awayFromLanding ? 'Move' : 'Rest',
      priority: 9,
      available: true,
      requirement: 'Choose a safer route or stabilize before digging.',
      effect: 'Avoids turning the tile warning into higher escape cost.',
      reason: 'The intent tile is unstable.',
      tone: 'red',
    },
    [MITIGATION_IDS.LEAVE_RELIC_VEIN]: {
      ...common,
      label: 'Leave relic vein',
      action: preview.canEscape ? Action.FLEE : awayFromLanding ? Action.MOVE : Action.REST,
      actionLabel: preview.canEscape ? 'Flee' : awayFromLanding ? 'Move' : 'Rest',
      priority: 9,
      available: true,
      requirement: 'Take a non-Dig action if pressure is already severe.',
      effect: 'Avoids letting a rich tile spike pressure further.',
      reason: 'The tile is tempting and dangerous.',
      tone: 'orange',
    },
  };

  const mitigation = templates[id] || templates[MITIGATION_IDS.FALLBACK];
  if (tileTraitEffects?.matched && tileTrait?.id === 'signal' && id === MITIGATION_IDS.USE_SIGNAL) mitigation.priority = 6;
  return {
    ...mitigation,
    actionable: REAL_ACTIONS.has(mitigation.action),
  };
}

export function rankMitigations(mitigations = []) {
  return [...mitigations].sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return (a.priority ?? 999) - (b.priority ?? 999) || String(a.id).localeCompare(String(b.id));
  });
}

export function mitigationsForPreview(preview = {}, context = {}) {
  const idsByLevel = {
    [ESCAPE_COST_LEVELS.CLEAN]: [MITIGATION_IDS.DEPART_NOW, MITIGATION_IDS.KEEP_CHARTING],
    [ESCAPE_COST_LEVELS.CLOSE]: [MITIGATION_IDS.DEPART_NOW, MITIGATION_IDS.RETURN_TO_LANDING, MITIGATION_IDS.STOP_DIGGING],
    [ESCAPE_COST_LEVELS.ARTIFACT_RISK]: [MITIGATION_IDS.DEPART_NOW, MITIGATION_IDS.SECURE_ARTIFACT, MITIGATION_IDS.RETURN_TO_LANDING, MITIGATION_IDS.STOP_DIGGING],
    [ESCAPE_COST_LEVELS.CREW_RISK]: [MITIGATION_IDS.DEPART_NOW, MITIGATION_IDS.HELP_WEAKEST, MITIGATION_IDS.REST_CREW, MITIGATION_IDS.REGROUP, MITIGATION_IDS.STOP_DIGGING],
    [ESCAPE_COST_LEVELS.ROUTE_COLLAPSE]: [
      MITIGATION_IDS.RETURN_TO_LANDING,
      MITIGATION_IDS.STABILIZE_ROUTE,
      MITIGATION_IDS.STOP_DIGGING,
      ...(preview.canEscape ? [MITIGATION_IDS.DEPART_NOW] : []),
    ],
    [ESCAPE_COST_LEVELS.NOT_READY]: [
      preview.currentDistanceToLanding > 0 ? MITIGATION_IDS.RETURN_TO_LANDING : MITIGATION_IDS.RECOVER_VALUE,
      MITIGATION_IDS.REGROUP,
    ],
  };
  const ids = idsByLevel[preview.level] || [MITIGATION_IDS.FALLBACK];
  const traitId = context.tileTrait?.id || context.tileTraitEffects?.traitId || '';
  const traitIds = [];
  if (traitId === 'signal') traitIds.push(MITIGATION_IDS.USE_SIGNAL);
  if (traitId === 'old-trail') traitIds.push(MITIGATION_IDS.FOLLOW_OLD_TRAIL);
  if (traitId === 'cache') traitIds.push(MITIGATION_IDS.USE_CACHE);
  if (traitId === 'shelter') traitIds.push(MITIGATION_IDS.REST_IN_SHELTER);
  if (traitId === 'echo-field') traitIds.push(MITIGATION_IDS.HELP_THROUGH_ECHO);
  if (traitId === 'unstable-ground') traitIds.push(MITIGATION_IDS.AVOID_UNSTABLE_GROUND);
  if (traitId === 'relic-vein') traitIds.push(MITIGATION_IDS.LEAVE_RELIC_VEIN);
  const mitigations = [...new Set([...traitIds, ...ids])].map((id) => mitigationTemplate(id, { ...context, preview }));
  const ranked = rankMitigations(mitigations);
  return ranked.some((mitigation) => mitigation.available)
    ? ranked
    : rankMitigations([...ranked, mitigationTemplate(MITIGATION_IDS.FALLBACK, { ...context, preview })]);
}

export function bestMitigationForPreview(preview = {}, context = {}) {
  return mitigationsForPreview(preview, context)[0] || null;
}

function previewForLevel(level, context = {}) {
  const {
    pressure = 0,
    bandLabel = '',
    atRiskItem = '',
    atRiskPlayer = null,
    distanceToLanding = null,
    readinessBody = '',
  } = context;
  const distanceCopy = distanceToLanding === null ? 'the landing route is not readable' : `landing is ${distanceToLanding} away`;

  const table = {
    [ESCAPE_COST_LEVELS.CLEAN]: {
      label: 'Clean departure',
      costType: 'none',
      headline: 'No cost projected',
      body: 'Leaving now looks clean; waiting is the only thing adding cost.',
      nextDelayWarning: 'One more delay starts turning safety into pressure.',
      tone: 'green',
      reportLabel: 'Clean',
    },
    [ESCAPE_COST_LEVELS.CLOSE]: {
      label: 'Close departure',
      costType: 'close',
      headline: 'Close escape likely',
      body: 'Leaving now protects the run, but the route is no longer comfortable.',
      nextDelayWarning: 'One more delay may put recovered value on the line.',
      tone: 'gold',
      reportLabel: 'Close',
    },
    [ESCAPE_COST_LEVELS.ARTIFACT_RISK]: {
      label: 'Artifact at risk',
      costType: 'artifact-risk',
      headline: atRiskItem ? `${atRiskItem} at risk` : 'Recovered value at risk',
      body: atRiskItem
        ? `Leaving now is still possible, but waiting may put ${atRiskItem} on the line.`
        : 'Leaving now is still possible, but waiting may put recovered value on the line.',
      nextDelayWarning: 'One more delay may turn value risk into crew risk.',
      tone: 'orange',
      reportLabel: 'Costly',
    },
    [ESCAPE_COST_LEVELS.CREW_RISK]: {
      label: 'Crew at risk',
      costType: 'crew-risk',
      headline: atRiskPlayer?.label ? `${atRiskPlayer.label} at risk` : 'Crew at risk',
      body: atRiskPlayer?.label
        ? `Depart now or ${atRiskPlayer.label} may be the cost of leaving late.`
        : 'Depart now or a crew member may become the cost of leaving late.',
      nextDelayWarning: 'One more delay may collapse the route entirely.',
      tone: 'red',
      reportLabel: 'Costly',
    },
    [ESCAPE_COST_LEVELS.ROUTE_COLLAPSE]: {
      label: 'Route collapse',
      costType: 'route-collapse',
      headline: 'Route collapse projected',
      body: `${bandLabel || 'Collapse Risk'} ${pressure}; ${distanceCopy}. The run itself is on the line.`,
      nextDelayWarning: 'The next delay may strand recovered value before Flee can matter.',
      tone: 'red',
      reportLabel: 'Collapsed',
    },
    [ESCAPE_COST_LEVELS.NOT_READY]: {
      label: 'Not ready',
      costType: 'not-ready',
      headline: 'Escape not ready',
      body: readinessBody || 'The crew still needs landing access and recovered value before departure counts.',
      nextDelayWarning: 'Waiting without progress still raises the cost.',
      tone: 'neutral',
      reportLabel: 'Not Ready',
    },
  };

  return table[level] || table[ESCAPE_COST_LEVELS.NOT_READY];
}

export function deriveEscapeCostPreview({
  departPressure = null,
  players = [],
  activeInventory = {},
  location = '',
  landingSite = '',
  routeStatus = {},
  movePath = [],
  movement = 0,
  activeTab = null,
  stats = {},
  tileTraitEffects = null,
  tileTrait = null,
} = {}) {
  const pressure = Number(departPressure?.pressure || 0);
  const bandId = departPressure?.band?.id || 'stable';
  const bandLabel = departPressure?.band?.label || 'Stable Route';
  const readiness = departPressure?.readiness || {};
  const currentDistance = departPressure?.currentDistanceToLanding ?? routeDistance(location, landingSite);
  const intentLocation = movePath.length > 0 ? movePath[movePath.length - 1] : location;
  const intentDistance = departPressure?.distanceToLanding ?? routeDistance(intentLocation, landingSite);
  const canEscape = Boolean(readiness.canFlee);
  const atRiskItem = selectAtRiskItem(activeInventory);
  const atRiskPlayer = selectAtRiskPlayer(players);
  const hasRecoveredValue = Boolean(departPressure?.hasRecoveredValue || atRiskItem);
  const routeInvalid = routeStatus?.isValid === false;

  let level = ESCAPE_COST_LEVELS.NOT_READY;
  if (bandId === 'collapse' && (!canEscape || currentDistance > 0 || routeInvalid)) {
    level = ESCAPE_COST_LEVELS.ROUTE_COLLAPSE;
  } else if (!canEscape) {
    level = ESCAPE_COST_LEVELS.NOT_READY;
  } else if (bandId === 'collapse') {
    level = atRiskPlayer ? ESCAPE_COST_LEVELS.CREW_RISK : ESCAPE_COST_LEVELS.ARTIFACT_RISK;
  } else if (bandId === 'closing') {
    level = hasRecoveredValue ? ESCAPE_COST_LEVELS.ARTIFACT_RISK : ESCAPE_COST_LEVELS.CLOSE;
  } else if (bandId === 'stretching') {
    level = ESCAPE_COST_LEVELS.CLOSE;
  } else {
    level = ESCAPE_COST_LEVELS.CLEAN;
  }

  const base = previewForLevel(level, {
    pressure,
    bandLabel,
    atRiskItem,
    atRiskPlayer,
    distanceToLanding: currentDistance,
    readinessBody: readiness.body,
  });

  const preview = {
    ...base,
    level,
    pressure,
    bandId,
    bandLabel,
    atRiskItem,
    atRiskPlayer,
    canEscape,
    currentDistanceToLanding: currentDistance,
    intentDistanceToLanding: intentDistance,
    routeInvalid,
    tileTraitEffects,
    tileTrait,
  };
  const mitigations = mitigationsForPreview(preview, {
    movement,
    activeTab,
    routeStatus,
    stats,
    players,
    activeInventory,
    departPressure,
    tileTraitEffects,
    tileTrait,
    atRiskItem,
    atRiskPlayer,
    currentDistanceToLanding: currentDistance,
    hasRecoveredValue,
    routeInvalid,
  });

  return {
    ...preview,
    mitigations,
    bestMitigation: mitigations[0] || null,
  };
}

export function escapeCostToneClass(preview = {}) {
  return {
    green: 'border-oxide-green/35 bg-oxide-green/5 text-oxide-green',
    gold: 'border-compass/35 bg-compass/5 text-compass-bright',
    orange: 'border-desert/40 bg-desert/10 text-desert',
    red: 'border-signal-red/40 bg-signal-red/10 text-signal-red',
    neutral: 'border-exp-border bg-exp-dark/35 text-exp-text-dim',
  }[preview.tone] || 'border-exp-border bg-exp-dark/35 text-exp-text-dim';
}
