export const GROWTH_EVENT_TYPES = [
  'run_started',
  'action_taken',
  'run_completed',
  'share_card_generated',
  'share_clicked',
  'replay_opened',
  'feedback_submitted',
  'scenario_created',
];

export const GROWTH_SCENARIOS = [
  {
    id: 'escape-pressure-4p',
    name: 'Escape Pressure 4P',
    hook: 'Four exhausted explorers have one artifact and a closing route to the landing site.',
    premise: 'Get the artifact holder out while the crew keeps each other moving.',
    players: 4,
    maxTurns: 7,
    difficulty: 'tense',
    tags: ['co-op', 'escape', 'survival', 'pressure'],
    targetArcScore: 68,
    start: { morale: 58, danger: 34, departPressure: 54, routeStability: 46, artifacts: 1, savedPlayers: 0, revealed: 2, distance: 4 },
  },
  {
    id: 'solo-artifact-hunt',
    name: 'Solo Artifact Hunt',
    hook: 'One surveyor can grab a relic fast, but every dig makes the way home riskier.',
    premise: 'Find one artifact and escape before fatigue turns the board flat.',
    players: 1,
    maxTurns: 6,
    difficulty: 'fast',
    tags: ['solo', 'artifact', 'survival', 'beginner'],
    targetArcScore: 64,
    start: { morale: 64, danger: 22, departPressure: 28, routeStability: 72, artifacts: 0, savedPlayers: 0, revealed: 1, distance: 3 },
  },
  {
    id: 'low-stat-recovery',
    name: 'Low Stat Recovery',
    hook: 'The crew starts depleted, and the first good rest decides whether the run breathes.',
    premise: 'Stabilize the crew, reveal a route, then leave with at least one recovery moment.',
    players: 3,
    maxTurns: 6,
    difficulty: 'careful',
    tags: ['co-op', 'recovery', 'survival'],
    targetArcScore: 62,
    start: { morale: 42, danger: 30, departPressure: 38, routeStability: 62, artifacts: 0, savedPlayers: 0, revealed: 1, distance: 3 },
  },
];

export const WEEKLY_CHALLENGE = {
  id: 'weekly-escape-001',
  title: 'Weekly Challenge: Desperate Lift-Off',
  scenarioId: 'escape-pressure-4p',
  seed: 'weekly-escape-001',
  startsAt: '2026-05-15',
  endsAt: '2026-05-22',
  tagline: 'Can your crew escape with the artifact before the route collapses?',
};

function pressureBandForState(value = 0) {
  const pressure = clamp(value);
  if (pressure >= 75) return { id: 'collapse', label: 'Collapse Risk', tone: 'red' };
  if (pressure >= 50) return { id: 'closing', label: 'Closing Route', tone: 'orange' };
  if (pressure >= 25) return { id: 'stretching', label: 'Stretching Route', tone: 'gold' };
  return { id: 'stable', label: 'Stable Route', tone: 'green' };
}

const ACTIONS = {
  move: { label: 'Move', pulse: 10, agency: 16, friction: 8 },
  dig: { label: 'Dig', pulse: 14, agency: 18, friction: 14 },
  rest: { label: 'Rest', pulse: 9, agency: 10, friction: 7 },
  help: { label: 'Help', pulse: 12, agency: 14, friction: 8 },
  flee: { label: 'Flee', pulse: 18, agency: 20, friction: 16 },
  inspect: { label: 'Inspect', pulse: 7, agency: 9, friction: 5 },
};

const GROWTH_ACTION_BY_CONTRACT = {
  [Action.MOVE]: 'move',
  [Action.DIG]: 'dig',
  [Action.REST]: 'rest',
  [Action.HELP]: 'help',
  [Action.FLEE]: 'flee',
};

function hash(value) {
  let h = 2166136261;
  for (const char of String(value)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function roll(seed, turn, action, salt = 'main') {
  return hash(`${seed}|${turn}|${action}|${salt}`) / 4294967295;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function scenarioById(scenarioId) {
  return GROWTH_SCENARIOS.find((scenario) => scenario.id === scenarioId) || GROWTH_SCENARIOS[0];
}

function outcomeFor(run) {
  if (run.state.escaped) return 'escaped';
  if (run.state.departPressure >= 100) return run.state.artifacts?.length > 0 ? 'route-collapsed-with-value' : 'route-collapsed';
  if (run.state.morale <= 0) return 'collapsed';
  if (run.turn >= run.scenario.maxTurns) return run.state.artifacts?.length > 0 ? 'stranded-with-artifact' : 'lost';
  return 'in-progress';
}

function escapeCostForState(run = {}, state = {}) {
  const artifacts = Array.isArray(state.artifacts) ? state.artifacts : [];
  const pressure = clamp(state.departPressure ?? state.danger ?? 0);
  const atLanding = Number(state.distance || 0) <= 0;
  const hasRecoveredValue = artifacts.length > 0;
  const canEscape = atLanding && hasRecoveredValue;
  const band = pressureBandForState(pressure);
  const atRiskItem = artifacts[0]?.name || '';
  const atRiskPlayer = state.savedPlayers < (run.scenario?.players || 1)
    ? { label: `P${Math.min((state.savedPlayers || 0) + 1, run.scenario?.players || 1)}` }
    : null;

  let level = 'not-ready';
  if (band.id === 'collapse' && !canEscape) level = 'route-collapse';
  else if (!canEscape) level = 'not-ready';
  else if (band.id === 'collapse') level = atRiskPlayer ? 'crew-risk' : 'artifact-risk';
  else if (band.id === 'closing') level = 'artifact-risk';
  else if (band.id === 'stretching') level = 'close';
  else level = 'clean';

  const headline = {
    clean: 'No cost projected',
    close: 'Close escape likely',
    'artifact-risk': atRiskItem ? `${atRiskItem} at risk` : 'Recovered value at risk',
    'crew-risk': atRiskPlayer?.label ? `${atRiskPlayer.label} at risk` : 'Crew at risk',
    'route-collapse': 'Route collapse projected',
    'not-ready': 'Escape not ready',
  }[level];

  const preview = {
    level,
    costType: level,
    headline,
    label: {
      clean: 'Clean departure',
      close: 'Close departure',
      'artifact-risk': 'Artifact at risk',
      'crew-risk': 'Crew at risk',
      'route-collapse': 'Route collapse',
      'not-ready': 'Not ready',
    }[level],
    reportLabel: {
      clean: 'Clean',
      close: 'Close',
      'artifact-risk': 'Costly',
      'crew-risk': 'Costly',
      'route-collapse': 'Collapsed',
      'not-ready': 'Not Ready',
    }[level],
    atRiskItem,
    atRiskPlayer,
    pressure,
    canEscape,
  };
  const mitigations = mitigationsForPreview(preview, {
    movement: Math.max(0, 5 - (state.distance || 0)),
    players: Array.from({ length: run.scenario?.players || 1 }, (_, index) => ({
      playerID: index + 1,
      movement: index < (state.savedPlayers || 0) ? 3 : 1,
      agility: index < (state.savedPlayers || 0) ? 3 : 1,
      dexterity: 2,
      isActive: true,
    })),
    activeInventory: { artifact: atRiskItem },
    departPressure: { pressure, routeStability: state.routeStability ?? clamp(100 - pressure) },
    currentDistanceToLanding: Number(state.distance || 0),
    hasRecoveredValue,
  });
  return {
    ...preview,
    mitigations,
    bestMitigation: mitigations[0] || null,
  };
}

function mitigationForAction(escapeCostPreview = {}, action = '') {
  const mitigation = escapeCostPreview.mitigations?.find((item) => GROWTH_ACTION_BY_CONTRACT[item.action] === action) || null;
  const severe = ['artifact-risk', 'crew-risk', 'route-collapse'].includes(escapeCostPreview.level);
  const ignoredSevere = severe && action === 'dig' && mitigation?.id !== 'recover-value';
  return {
    id: mitigation?.id || null,
    label: mitigation?.label || null,
    matched: Boolean(mitigation?.available),
    effect: mitigation?.effect || null,
    ignoredSevere,
  };
}

function contractActionForGrowth(action = '') {
  return {
    move: Action.MOVE,
    dig: Action.DIG,
    rest: Action.REST,
    help: Action.HELP,
    flee: Action.FLEE,
  }[action] || Action.MOVE;
}

function growthTraitFor(run = {}, action = '', turn = 0) {
  const candidates = [
    TILE_TRAIT_IDS.SIGNAL,
    TILE_TRAIT_IDS.UNSTABLE_GROUND,
    TILE_TRAIT_IDS.CACHE,
    TILE_TRAIT_IDS.SHELTER,
    TILE_TRAIT_IDS.HIGH_GROUND,
    TILE_TRAIT_IDS.OLD_TRAIL,
    TILE_TRAIT_IDS.ECHO_FIELD,
    TILE_TRAIT_IDS.RELIC_VEIN,
  ].map((id) => TRAIT_DEFINITIONS[id]).filter(Boolean);
  const trait = candidates[hash(`${run.seed}|${run.scenario?.id}|${turn}|${action}|trait`) % candidates.length];
  const contractAction = contractActionForGrowth(action);
  const matched = trait.preferredAction === contractAction
    || (action === 'move' && [TILE_TRAIT_IDS.SIGNAL, TILE_TRAIT_IDS.OLD_TRAIL, TILE_TRAIT_IDS.HIGH_GROUND].includes(trait.id))
    || (action === 'flee' && [TILE_TRAIT_IDS.SIGNAL, TILE_TRAIT_IDS.CACHE, TILE_TRAIT_IDS.OLD_TRAIL].includes(trait.id));
  const warning = (action === 'dig' && [TILE_TRAIT_IDS.UNSTABLE_GROUND, TILE_TRAIT_IDS.RELIC_VEIN].includes(trait.id))
    || (action === 'move' && trait.id === TILE_TRAIT_IDS.UNSTABLE_GROUND);
  return {
    id: trait.id,
    label: trait.label,
    category: trait.category,
    preferredAction: trait.preferredAction,
    matched,
    warning,
    pressureDelta: matched ? Math.min(0, trait.pressureDelta) : warning ? Math.max(4, trait.pressureDelta) : 0,
    costDelta: matched ? Math.min(0, trait.costDelta) : warning ? Math.max(3, trait.costDelta) : 0,
    text: warning ? `${trait.label} turns the choice into sharper pressure and escape cost.`
      : matched ? `${trait.label} makes the action feel spatial and useful.`
        : trait.summary,
  };
}

function feelingFor({ action, state, delta, pulse, friction }) {
  if (action === 'flee' && state.escaped) return 'payoff';
  if (action === 'rest' || action === 'help') return delta.morale > 0 ? 'recovery' : 'hopeful';
  if (action === 'dig' && delta.artifacts > 0) return 'payoff';
  if (friction >= 55) return 'friction';
  if (state.danger >= 78) return 'panic';
  if (pulse >= 64) return 'alive';
  if (delta.revealed > 0) return 'surprise';
  if (pulse <= 32) return 'flat';
  return 'tense';
}

export function availableGrowthActions(run) {
  if (!run || run.completed) return [];
  return Object.entries(ACTIONS).map(([id, action]) => ({ id, label: action.label }));
}

export function createGrowthRun({ scenarioId = WEEKLY_CHALLENGE.scenarioId, seed = null, mode = 'standard', challenge = false } = {}) {
  const scenario = scenarioById(scenarioId);
  const runSeed = seed || `${scenario.id}-${Date.now().toString(36)}`;
  const fun = initialFunState({ scenario, seed: runSeed, mode, challenge });
  const state = applyModifierToState({ ...scenario.start, artifacts: fun.artifacts, escaped: false }, fun.modifier);
  return {
    schemaVersion: 1,
    id: hash(`${scenario.id}|${runSeed}`).toString(36),
    scenario,
    seed: runSeed,
    turn: 0,
    state,
    fun,
    timeline: [],
    completed: false,
    outcome: 'in-progress',
    createdAt: new Date().toISOString(),
  };
}

export function applyGrowthAction(run, actionId) {
  const action = ACTIONS[actionId] ? actionId : 'inspect';
  if (!run || run.completed) return run;
  const nextTurn = run.turn + 1;
  const before = { ...run.state };
  const luck = roll(run.seed, nextTurn, action);
  const spike = roll(run.seed, nextTurn, action, 'danger');
  let delta = { morale: -3, danger: 4, departPressure: 4, artifacts: 0, revealed: 0, distance: 0, savedPlayers: 0 };
  const digStreak = action === 'dig' ? Number(run.fun?.digStreak || 0) + 1 : 0;

  if (action === 'move') {
    delta.distance = luck > 0.18 ? -1 : 0;
    delta.revealed = luck > 0.56 ? 1 : 0;
    delta.danger += spike > 0.72 ? 8 : -2;
    delta.departPressure += delta.distance < 0 ? -5 : 6;
  } else if (action === 'dig') {
    delta.artifacts = luck > Math.max(0.2, 0.46 - digStreak * 0.08) ? 1 : 0;
    delta.danger += 8 + digStreak * 4;
    delta.departPressure += 8 + digStreak * 3;
    delta.morale += delta.artifacts ? 8 : -5;
  } else if (action === 'rest') {
    delta.morale += 16;
    delta.danger -= 6;
    delta.departPressure -= 9;
  } else if (action === 'help') {
    delta.savedPlayers = run.scenario.players > 1 && luck > 0.3 ? 1 : 0;
    delta.morale += 10 + delta.savedPlayers * 4;
    delta.danger -= 2;
    delta.departPressure -= 6;
  } else if (action === 'flee') {
    delta.distance = luck > 0.25 ? -2 : -1;
    delta.danger += before.distance <= 1 ? -8 : 8;
    delta.departPressure += before.distance <= 1 && before.artifacts?.length > 0 ? -16 : 8;
    delta.morale += before.artifacts?.length > 0 ? 4 : -8;
  } else {
    delta.revealed = 1;
    delta.danger -= 1;
    delta.morale += 2;
    delta.departPressure -= 2;
  }
  if ((before.departPressure || 0) >= 75 && !['rest', 'help', 'flee'].includes(action)) {
    delta.departPressure += 5;
    delta.danger += 3;
  }
  delta = roleDelta(run, action, delta);
  delta = comebackDelta(run, action, delta);
  const eventCard = secondaryEventFor(run, action);
  delta = applyEventEffect(delta, eventCard);
  const tileTrait = growthTraitFor(run, action, nextTurn);
  if (tileTrait.matched) {
    delta.departPressure = (delta.departPressure || 0) + tileTrait.pressureDelta;
    delta.agency = (delta.agency || 0) + 10;
    delta.lifePulse = (delta.lifePulse || 0) + 6;
    if (tileTrait.id === TILE_TRAIT_IDS.CACHE) delta.artifacts = Math.max(delta.artifacts || 0, action === 'dig' ? 1 : 0);
    if (tileTrait.id === TILE_TRAIT_IDS.HIGH_GROUND) delta.revealed = (delta.revealed || 0) + 1;
    if ([TILE_TRAIT_IDS.SHELTER, TILE_TRAIT_IDS.ECHO_FIELD].includes(tileTrait.id)) delta.morale = (delta.morale || 0) + 4;
  }
  if (tileTrait.warning) {
    delta.departPressure = (delta.departPressure || 0) + tileTrait.pressureDelta;
    delta.danger = (delta.danger || 0) + 4;
    delta.friction = (delta.friction || 0) + 10;
  }
  const finalTurn = nextTurn >= run.scenario.maxTurns;
  const flatLikely = delta.distance === 0 && delta.artifacts === 0 && delta.revealed === 0 && delta.savedPlayers === 0 && !['rest', 'help'].includes(action);
  if (finalTurn && flatLikely) {
    delta.revealed += 1;
    if (action === 'flee' || action === 'move') delta.distance -= 1;
  }

  const beforeArtifacts = Array.isArray(before.artifacts) ? before.artifacts : [];
  const discoveredArtifact = delta.artifacts > 0 ? artifactFor(run.seed, nextTurn) : null;
  const after = {
    ...before,
    morale: clamp(before.morale + delta.morale),
    danger: clamp(before.danger + delta.danger),
    departPressure: clamp((before.departPressure ?? before.danger ?? 0) + delta.departPressure),
    artifacts: discoveredArtifact ? [...beforeArtifacts, discoveredArtifact] : beforeArtifacts,
    revealed: Math.max(0, before.revealed + delta.revealed),
    distance: Math.max(0, before.distance + delta.distance),
    savedPlayers: Math.min(run.scenario.players, before.savedPlayers + delta.savedPlayers),
  };
  after.routeStability = clamp(100 - after.departPressure);
  after.escaped = after.distance <= 0 && (after.artifacts.length > 0 || action === 'flee');

  const fleeOutcome = fleeOutcomeFor(run, after, action);
  let escapeCostPreview = escapeCostForState(run, after);
  const mitigationApplied = mitigationForAction(escapeCostPreview, action);
  if (mitigationApplied.matched) {
    delta.agency = (delta.agency || 0) + 8;
  }
  if (mitigationApplied.ignoredSevere) {
    after.departPressure = clamp(after.departPressure + 6);
    after.routeStability = clamp(100 - after.departPressure);
    delta.departPressure = (delta.departPressure || 0) + 6;
    delta.friction = (delta.friction || 0) + 8;
    escapeCostPreview = escapeCostForState(run, after);
  }
  const agencyScore = clamp(ACTIONS[action].agency + Math.max(0, -delta.distance) * 12 + delta.artifacts * 18 + delta.revealed * 8 + delta.savedPlayers * 10 + (delta.agency || 0) + 30 + (eventCard ? 6 : 0));
  const frictionScore = clamp(ACTIONS[action].friction + (delta.friction || 0) + (delta.distance === 0 && action === 'move' ? 18 : 0) + (delta.artifacts === 0 && action === 'dig' ? 14 : 0) + Math.max(0, after.danger - 70) + Math.max(0, after.departPressure - 70) * 0.6);
  const lifePulse = clamp(ACTIONS[action].pulse + agencyScore * 0.42 + after.morale * 0.22 - frictionScore * 0.26 + (delta.lifePulse || 0) + (after.escaped ? 24 : 0) + (after.departPressure >= 75 && action === 'flee' ? 8 : 0));
  const feelingLabel = eventCard?.feelingBias || feelingFor({ action, state: after, delta, pulse: lifePulse, friction: frictionScore });
  const moment = momentForEvent({ action, feelingLabel, after, eventCard, fleeOutcome });
  const comebackLabel = (before.morale <= 35 && ['rest', 'help'].includes(action)) ? 'clutch-rest'
    : (before.danger >= 70 && action === 'help') ? 'team-save'
      : (finalTurn && action === 'flee' && after.distance <= 1) ? 'desperate-flee'
        : null;
  const event = {
    turn: nextTurn,
    action,
    label: ACTIONS[action].label,
    before,
    after,
    delta,
    agencyScore,
    frictionScore,
    lifePulse,
    feelingLabel,
    reactionClass: reactionClassFor(action, feelingLabel),
    bark: barkFor({ seed: run.seed, turn: nextTurn, action, feelingLabel, outcome: after.escaped ? 'escaped' : '' }),
    momentType: moment?.type || null,
    momentTitle: moment?.title || null,
    eventCard,
    tileTrait,
    traitEffect: tileTrait.text,
    traitMatchedAction: tileTrait.matched,
    comebackLabel,
    fleeOutcome,
    escapeCostPreview: (action === 'flee' || after.departPressure >= 50) ? escapeCostPreview : null,
    mitigationApplied,
    discoveredArtifact,
    text: eventText(action, delta, after, { eventCard, discoveredArtifact, fleeOutcome, mitigationApplied, tileTrait }),
  };
  const nextFun = {
    ...(run.fun || {}),
    digStreak,
    maxDigStreak: Math.max(Number(run.fun?.maxDigStreak || 0), digStreak),
    lastReactionClass: event.reactionClass,
  };
  const next = {
    ...run,
    turn: nextTurn,
    state: after,
    fun: nextFun,
    timeline: [...run.timeline, event],
  };
  next.outcome = outcomeFor(next);
  next.completed = next.outcome !== 'in-progress';
  if (next.completed) {
    next.completedAt = new Date().toISOString();
    const summary = summarizeGrowthRun(next);
    next.summary = summary;
    next.fun = { ...next.fun, personalBests: personalBestsAfter([next]) };
  }
  return next;
}

function eventText(action, delta, after, { eventCard = null, discoveredArtifact = null, fleeOutcome = null, mitigationApplied = null, tileTrait = null } = {}) {
  if (mitigationApplied?.matched) return `Cost reduced: ${mitigationApplied.label}. ${mitigationApplied.effect}`;
  if (mitigationApplied?.ignoredSevere) return 'The crew ignores the visible reduction and digs into a sharper pressure spike.';
  if (tileTrait?.matched || tileTrait?.warning) return tileTrait.text;
  if (eventCard) return `${eventCard.title}: ${eventCard.text}`;
  if (action === 'flee' && after.escaped) return 'The escape route snaps into focus and the crew reaches the landing site.';
  if (action === 'flee' && fleeOutcome) return `Flee result: ${fleeOutcome}. The route is close enough to remember.`;
  if (action === 'dig' && discoveredArtifact) return `The dig finds the ${discoveredArtifact.name}: ${discoveredArtifact.hook}`;
  if (action === 'dig' && delta.artifacts > 0) return 'The dig hits something real: an artifact comes up before the danger can swallow the turn.';
  if (after.departPressure >= 100) return 'Depart Pressure maxes out and the route home collapses.';
  if (delta.departPressure >= 12) return 'The choice pays in pressure; the map home is closing faster now.';
  if (delta.departPressure <= -6) return 'The crew buys back a little route stability.';
  if (action === 'rest') return 'The crew catches breath, and the next decision has room to matter.';
  if (action === 'help' && delta.savedPlayers > 0) return 'A teammate gets pulled back into the run.';
  if (action === 'move' && delta.distance < 0) return 'The route shortens and the board answers the input.';
  if (action === 'inspect') return 'The board gives up useful information before anyone commits.';
  return 'The action changes less than hoped, but the pressure still moves.';
}

function bestBy(timeline, score) {
  return [...timeline].sort((a, b) => score(b) - score(a))[0] || null;
}

export function summarizeGrowthRun(run) {
  const timeline = run?.timeline || [];
  const bestMoment = bestBy(timeline, (event) => event.lifePulse + event.agencyScore * 0.25 + (['payoff', 'recovery', 'surprise'].includes(event.feelingLabel) ? 18 : 0));
  const worstMoment = bestBy(timeline, (event) => event.frictionScore + (100 - event.lifePulse) * 0.2);
  const averagePulse = timeline.length ? timeline.reduce((sum, event) => sum + event.lifePulse, 0) / timeline.length : 0;
  const averageAgency = timeline.length ? timeline.reduce((sum, event) => sum + event.agencyScore, 0) / timeline.length : 0;
  const averageFriction = timeline.length ? timeline.reduce((sum, event) => sum + event.frictionScore, 0) / timeline.length : 0;
  const firstAlive = timeline.find((event) => event.feelingLabel === 'alive' || event.lifePulse >= 60);
  const firstFlat = timeline.find((event) => event.feelingLabel === 'flat' || event.lifePulse <= 32);
  const payoffCount = timeline.filter((event) => ['payoff', 'surprise'].includes(event.feelingLabel) || event.momentType === 'payoff').length;
  const recoveryCount = timeline.filter((event) => event.feelingLabel === 'recovery').length;
  const arcScore = clamp(averagePulse * 0.52 + averageAgency * 0.25 + (100 - averageFriction) * 0.23 + payoffCount * 4 + recoveryCount * 3 + (firstAlive && firstAlive.turn <= 2 ? 8 : 0));
  const startPulse = timeline.slice(0, 2).reduce((sum, event) => sum + event.lifePulse, 0) / Math.max(1, Math.min(2, timeline.length));
  const endPulse = timeline.slice(-2).reduce((sum, event) => sum + event.lifePulse, 0) / Math.max(1, Math.min(2, timeline.length));
  const arcShape = timeline.length === 0
    ? 'unplayed'
    : timeline.some((event) => event.feelingLabel === 'payoff') && endPulse >= startPulse
      ? 'payoff-rise'
      : firstFlat
        ? 'drag-and-recover'
        : endPulse > startPulse + 8
          ? 'rising'
          : endPulse < startPulse - 8
            ? 'falling'
            : 'steady-pressure';
  const quality = funQualityForRun(run);
  const artifactNames = publicArtifactNames(run);
  const base = {
    scenarioId: run.scenario.id,
    scenarioName: run.scenario.name,
    seed: run.seed,
    outcome: run.outcome,
    completed: run.completed,
    turns: run.turn,
    maxTurns: run.scenario.maxTurns,
    artifacts: artifactNames.length,
    artifactNames,
    savedPlayers: run.state.savedPlayers,
    morale: run.state.morale,
    danger: run.state.danger,
    departPressure: run.state.departPressure ?? run.state.danger,
    routeStability: run.state.routeStability ?? clamp(100 - (run.state.departPressure ?? run.state.danger ?? 0)),
    bestMoment,
    worstMoment,
    firstAliveTurn: firstAlive?.turn || null,
    firstFlatTurn: firstFlat?.turn || null,
    arcScore,
    arcShape,
    challengeScore: scoreChallengeRun(run),
    funQuality: quality,
    escapeCostPreview: escapeCostForState(run, run.state),
  };
  const title = runTitleFor({ run, summary: base, quality });
  const badges = badgesForRun(run, base, quality);
  return {
    ...base,
    runTitle: title,
    badges,
    bestBark: quality.shareWorthyMoment?.bark || bestMoment?.bark || null,
    epilogue: epilogueForRun(run, quality),
  };
}

export function shareTextForRun(run) {
  const summary = summarizeGrowthRun(run);
  const verb = summary.outcome === 'escaped' ? 'escaped' : summary.outcome === 'collapsed' ? 'collapsed' : summary.outcome?.includes('route-collapsed') ? 'lost the route' : 'survived';
  const badge = summary.badges?.[0] ? ` Badge: ${summary.badges[0]}.` : '';
  const artifacts = summary.artifactNames?.length ? ` Found ${summary.artifactNames.join(', ')}.` : '';
  const cost = summary.escapeCostPreview?.level && summary.escapeCostPreview.level !== 'not-ready'
    ? ` ${summary.escapeCostPreview.headline}.`
    : '';
  const mitigation = (run.timeline || []).find((event) => event.mitigationApplied?.matched)?.mitigationApplied;
  const traitMoment = (run.timeline || []).find((event) => event.tileTrait?.matched || event.tileTrait?.warning)?.tileTrait;
  const mitigationCopy = mitigation?.label ? ` Cut cost with ${mitigation.label}.` : '';
  const traitCopy = traitMoment?.label ? ` Tile moment: ${traitMoment.label}.` : '';
  return `${summary.runTitle}: I ${verb} ${summary.scenarioName} with ${summary.artifacts} artifact(s), pressure ${summary.departPressure}, arc ${summary.arcShape} ${summary.arcScore}, seed ${summary.seed}.${cost}${mitigationCopy}${traitCopy}${artifacts}${badge} Can you beat this run?`;
}

export function encodeRun(run) {
  const json = JSON.stringify(run);
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeRun(encoded) {
  if (!encoded) return null;
  try {
    if (typeof atob === 'function') {
      const normalized = String(encoded).replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(normalized))));
    }
    return JSON.parse(Buffer.from(String(encoded), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function replayPathForRun(run) {
  return `/replay/${encodeRun(run)}`;
}

export function scoreChallengeRun(run) {
  const escaped = run.state.escaped ? 1000 : 0;
  const artifacts = Array.isArray(run.state.artifacts) ? run.state.artifacts.length : Number(run.state.artifacts || 0);
  const escapeCost = escapeCostForState(run, run.state);
  const matchedMitigations = (run.timeline || []).filter((event) => event.mitigationApplied?.matched).length;
  const ignoredSevere = (run.timeline || []).filter((event) => event.mitigationApplied?.ignoredSevere).length;
  const matchedTraits = (run.timeline || []).filter((event) => event.tileTrait?.matched).length;
  const warningTraits = (run.timeline || []).filter((event) => event.tileTrait?.warning).length;
  const cleanBonus = escapeCost.level === 'clean' && artifacts > 0 ? 80 : 0;
  const costPenalty = {
    clean: 0,
    close: 20,
    'artifact-risk': 60,
    'crew-risk': 100,
    'route-collapse': 180,
    'not-ready': 40,
  }[escapeCost.level] || 0;
  return escaped
    + artifacts * 140
    + run.state.savedPlayers * 90
    + Math.max(0, run.scenario.maxTurns - run.turn) * 35
    + run.state.morale
    + cleanBonus
    + matchedMitigations * 25
    + matchedTraits * 18
    - run.state.danger
    - Math.max(0, (run.state.departPressure || 0) - 60)
    - costPenalty
    - ignoredSevere * 40
    - warningTraits * 22;
}

export function rankChallengeRuns(runs = [], scenarioId = WEEKLY_CHALLENGE.scenarioId) {
  return [...runs]
    .filter((run) => run?.scenario?.id === scenarioId && run.completed)
    .sort((a, b) => scoreChallengeRun(b) - scoreChallengeRun(a));
}

export function growthEvent(type, payload = {}) {
  return {
    id: hash(`${type}|${Date.now()}|${JSON.stringify(payload)}`).toString(36),
    type: GROWTH_EVENT_TYPES.includes(type) ? type : 'action_taken',
    timestamp: new Date().toISOString(),
    ...payload,
  };
}

export function buildPublicProgress({ runs = [], feelingIndex = null, timeMachineIndex = null } = {}) {
  return GROWTH_SCENARIOS.map((scenario) => {
    const scenarioRuns = runs.filter((run) => run.scenario?.id === scenario.id);
    const completed = scenarioRuns.filter((run) => run.completed);
    const latestRun = completed[completed.length - 1] || scenarioRuns[scenarioRuns.length - 1] || null;
    const feeling = feelingIndex?.scenarios?.find((item) => item.scenarioId === scenario.id);
    const timeMachine = timeMachineIndex?.scenarios?.find((item) => item.scenarioId === scenario.id);
    return {
      scenarioId: scenario.id,
      name: scenario.name,
      hook: scenario.hook,
      runs: scenarioRuns.length,
      completions: completed.length,
      completionRate: scenarioRuns.length ? completed.length / scenarioRuns.length : 0,
      latestArcScore: latestRun ? summarizeGrowthRun(latestRun).arcScore : feeling?.arcScore,
      latestArcShape: latestRun ? summarizeGrowthRun(latestRun).arcShape : feeling?.arcShape,
      latestRun,
      latestHealth: timeMachine?.latestHealth,
      trend: timeMachine?.trend || (completed.length > 0 ? 'local-evidence' : 'needs-runs'),
      nextExperiment: feeling?.recommendation?.title || timeMachine?.recommendation?.title || 'Capture a completed public run.',
    };
  });
}

export function buildDevlogEntries(progress = []) {
  return progress.map((item) => ({
    id: `${item.scenarioId}-growth-note`,
    title: `${item.name}: ${item.trend}`,
    body: item.runs > 0
      ? `${item.completions}/${item.runs} local public runs completed. Latest felt arc is ${item.latestArcShape || 'unknown'} at ${item.latestArcScore ?? 'n/a'}.`
      : `No public run has landed yet. The next useful experiment is ${item.nextExperiment}`,
    next: item.nextExperiment,
  }));
}

export function buildCreatorScenario({ prompt = '', players = 1, desiredFeeling = 'alive', duration = 6 } = {}) {
  const cleanPrompt = String(prompt || 'Custom expedition').trim();
  const id = cleanPrompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'custom-expedition';
  const safePlayers = Math.max(1, Math.min(4, Number(players) || 1));
  const safeDuration = Math.max(4, Math.min(10, Number(duration) || 6));
  return {
    id,
    name: cleanPrompt.replace(/\b\w/g, (char) => char.toUpperCase()).slice(0, 64),
    players: safePlayers,
    maxTurns: safeDuration,
    tags: [safePlayers > 1 ? 'co-op' : 'solo', desiredFeeling, 'created'],
    hook: cleanPrompt,
    premise: `A ${safePlayers}-player scenario tuned to feel ${desiredFeeling}.`,
    playPath: `/play?scenario=solo-artifact-hunt&seed=${id}`,
  };
}

export { actionPreviewFor };
import {
  actionPreviewFor,
  applyEventEffect,
  applyModifierToState,
  artifactFor,
  badgesForRun,
  barkFor,
  comebackDelta,
  epilogueForRun,
  fleeOutcomeFor,
  funQualityForRun,
  initialFunState,
  momentForEvent,
  personalBestsAfter,
  publicArtifactNames,
  reactionClassFor,
  roleDelta,
  runTitleFor,
  secondaryEventFor,
} from './funLoop.js';
import { Action } from './constants.js';
import { mitigationsForPreview } from './escapeCostPreview.js';
import { TILE_TRAIT_IDS, TRAIT_DEFINITIONS } from './tileTraits.js';
