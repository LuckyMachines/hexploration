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
    start: { morale: 58, danger: 34, artifacts: 1, savedPlayers: 0, revealed: 2, distance: 4 },
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
    start: { morale: 64, danger: 22, artifacts: 0, savedPlayers: 0, revealed: 1, distance: 3 },
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
    start: { morale: 42, danger: 30, artifacts: 0, savedPlayers: 0, revealed: 1, distance: 3 },
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

const ACTIONS = {
  move: { label: 'Move', pulse: 10, agency: 16, friction: 8 },
  dig: { label: 'Dig', pulse: 14, agency: 18, friction: 14 },
  rest: { label: 'Rest', pulse: 9, agency: 10, friction: 7 },
  help: { label: 'Help', pulse: 12, agency: 14, friction: 8 },
  flee: { label: 'Flee', pulse: 18, agency: 20, friction: 16 },
  inspect: { label: 'Inspect', pulse: 7, agency: 9, friction: 5 },
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
  if (run.state.morale <= 0) return 'collapsed';
  if (run.turn >= run.scenario.maxTurns) return run.state.artifacts > 0 ? 'stranded-with-artifact' : 'lost';
  return 'in-progress';
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

export function createGrowthRun({ scenarioId = WEEKLY_CHALLENGE.scenarioId, seed = null } = {}) {
  const scenario = scenarioById(scenarioId);
  const runSeed = seed || `${scenario.id}-${Date.now().toString(36)}`;
  return {
    schemaVersion: 1,
    id: hash(`${scenario.id}|${runSeed}`).toString(36),
    scenario,
    seed: runSeed,
    turn: 0,
    state: { ...scenario.start, escaped: false },
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
  const delta = { morale: -3, danger: 4, artifacts: 0, revealed: 0, distance: 0, savedPlayers: 0 };

  if (action === 'move') {
    delta.distance = luck > 0.18 ? -1 : 0;
    delta.revealed = luck > 0.56 ? 1 : 0;
    delta.danger += spike > 0.72 ? 8 : -2;
  } else if (action === 'dig') {
    delta.artifacts = luck > 0.42 ? 1 : 0;
    delta.danger += 10;
    delta.morale += delta.artifacts ? 8 : -5;
  } else if (action === 'rest') {
    delta.morale += 16;
    delta.danger -= 6;
  } else if (action === 'help') {
    delta.savedPlayers = run.scenario.players > 1 && luck > 0.3 ? 1 : 0;
    delta.morale += 10 + delta.savedPlayers * 4;
    delta.danger -= 2;
  } else if (action === 'flee') {
    delta.distance = luck > 0.25 ? -2 : -1;
    delta.danger += before.distance <= 1 ? -8 : 8;
    delta.morale += before.artifacts > 0 ? 4 : -8;
  } else {
    delta.revealed = 1;
    delta.danger -= 1;
    delta.morale += 2;
  }

  const after = {
    ...before,
    morale: clamp(before.morale + delta.morale),
    danger: clamp(before.danger + delta.danger),
    artifacts: Math.max(0, before.artifacts + delta.artifacts),
    revealed: Math.max(0, before.revealed + delta.revealed),
    distance: Math.max(0, before.distance + delta.distance),
    savedPlayers: Math.min(run.scenario.players, before.savedPlayers + delta.savedPlayers),
  };
  after.escaped = after.distance <= 0 && (after.artifacts > 0 || action === 'flee');

  const agencyScore = clamp(ACTIONS[action].agency + Math.max(0, -delta.distance) * 12 + delta.artifacts * 18 + delta.revealed * 8 + delta.savedPlayers * 10 + 30);
  const frictionScore = clamp(ACTIONS[action].friction + (delta.distance === 0 && action === 'move' ? 18 : 0) + (delta.artifacts === 0 && action === 'dig' ? 14 : 0) + Math.max(0, after.danger - 70));
  const lifePulse = clamp(ACTIONS[action].pulse + agencyScore * 0.42 + after.morale * 0.22 - frictionScore * 0.26 + (after.escaped ? 24 : 0));
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
    feelingLabel: feelingFor({ action, state: after, delta, pulse: lifePulse, friction: frictionScore }),
    text: eventText(action, delta, after),
  };
  const next = {
    ...run,
    turn: nextTurn,
    state: after,
    timeline: [...run.timeline, event],
  };
  next.outcome = outcomeFor(next);
  next.completed = next.outcome !== 'in-progress';
  if (next.completed) next.completedAt = new Date().toISOString();
  return next;
}

function eventText(action, delta, after) {
  if (action === 'flee' && after.escaped) return 'The escape route snaps into focus and the crew reaches the landing site.';
  if (action === 'dig' && delta.artifacts > 0) return 'The dig hits something real: an artifact comes up before the danger can swallow the turn.';
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
  const payoffCount = timeline.filter((event) => ['payoff', 'surprise'].includes(event.feelingLabel)).length;
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
  return {
    scenarioId: run.scenario.id,
    scenarioName: run.scenario.name,
    seed: run.seed,
    outcome: run.outcome,
    completed: run.completed,
    turns: run.turn,
    maxTurns: run.scenario.maxTurns,
    artifacts: run.state.artifacts,
    savedPlayers: run.state.savedPlayers,
    morale: run.state.morale,
    danger: run.state.danger,
    bestMoment,
    worstMoment,
    firstAliveTurn: firstAlive?.turn || null,
    firstFlatTurn: firstFlat?.turn || null,
    arcScore,
    arcShape,
    challengeScore: scoreChallengeRun(run),
  };
}

export function shareTextForRun(run) {
  const summary = summarizeGrowthRun(run);
  const verb = summary.outcome === 'escaped' ? 'escaped' : summary.outcome === 'collapsed' ? 'collapsed' : 'survived';
  return `I ${verb} ${summary.scenarioName} with ${summary.artifacts} artifact(s), arc ${summary.arcShape} ${summary.arcScore}, seed ${summary.seed}. Can you beat this run?`;
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
  return escaped
    + run.state.artifacts * 140
    + run.state.savedPlayers * 90
    + Math.max(0, run.scenario.maxTurns - run.turn) * 35
    + run.state.morale
    - run.state.danger;
}

export function rankChallengeRuns(runs = []) {
  return [...runs]
    .filter((run) => run?.scenario?.id === WEEKLY_CHALLENGE.scenarioId && run.completed)
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
