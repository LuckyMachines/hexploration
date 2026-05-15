import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const root = resolve(__dirname, '..');
export const scenarioStorePath = resolve(root, 'simulator.scenarios.json');
export const scenarioReportRoot = resolve(root, 'reports', 'simulator', 'scenarios');
export const publicScenarioRoot = resolve(root, 'app', 'public', 'simulator', 'scenarios');

export const ALLOWED_STRATEGIES = ['balanced', 'risky', 'dig', 'move', 'rest', 'idle'];
export const SUPPORTED_TAGS = ['solo', 'multiplayer', 'cooperation', 'escape', 'artifact', 'exploration', 'survival', 'chaos', 'benchmark', 'regression', 'smoke'];

export const SETUP_SUPPORT = {
  playerStats: 'notYetSupported',
  revealedZones: 'notYetSupported',
  artifactsHeld: 'notYetSupported',
  landingRevealed: 'observedOnly',
  campsites: 'observedOnly',
  inventory: 'notYetSupported',
  queuePhase: 'observedOnly',
  dayNumber: 'observedOnly',
};

export const TARGET_PRESETS = {
  exploration: [
    { metric: 'revealedZones', op: '>=', value: 1.5, label: 'Reveal pace' },
    { metric: 'moveShare', op: '>=', value: 0.2, label: 'Move share' },
    { metric: 'flatTurnRate', op: '<=', value: 0.35, label: 'Flat-turn rate' },
  ],
  artifact: [
    { metric: 'artifacts', op: '>=', value: 0.25, label: 'Artifact average' },
    { metric: 'digActions', op: '>=', value: 1, label: 'Dig action count' },
  ],
  escape: [
    { metric: 'fleeActions', op: '>=', value: 1, label: 'Escape attempts' },
    { metric: 'lifeScore', op: '>=', value: 35, label: 'Life score' },
  ],
  cooperation: [
    { metric: 'helpActions', op: '>=', value: 1, label: 'Help action count' },
    { metric: 'zeroStatPlayers', op: '<=', value: 1, label: 'Zero-stat players' },
  ],
  survival: [
    { metric: 'zeroStatPlayers', op: '<=', value: 0.5, label: 'Zero-stat players' },
    { metric: 'invalidAttempts', op: '<=', value: 3, label: 'Invalid attempts' },
  ],
  chaos: [
    { metric: 'spikeTurns', op: '>=', value: 1, label: 'Spike turns' },
    { metric: 'lifeScore', op: '>=', value: 30, label: 'Life score' },
  ],
};

export const FAILURE_SIGNAL_PRESETS = {
  flatStreak: { metric: 'flatStreak', op: '>=', value: 3, label: 'Flat streak >= 3' },
  zeroStatPlayers: { metric: 'zeroStatPlayers', op: '>', value: 0, label: 'Any zero-stat player' },
  lowMoveShare: { metric: 'moveShare', op: '<', value: 0.2, label: 'Move share below 20%' },
  noHelp: { metric: 'helpActions', op: '==', value: 0, label: 'No help actions' },
  noFlee: { metric: 'fleeActions', op: '==', value: 0, label: 'No flee actions' },
  lowArtifacts: { metric: 'artifacts', op: '<', value: 0.25, label: 'Artifact average too low' },
};

function now() {
  return new Date().toISOString();
}

export function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function slugify(value) {
  return String(value || 'scenario')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'scenario';
}

export function stableSeed(value) {
  const text = String(value || 'scenario');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33 + text.charCodeAt(index)) % 1000003;
  }
  return `scenario-${Math.abs(hash).toString(36)}`;
}

export function defaultStore() {
  return {
    schemaVersion: 1,
    scenarios: [],
    packs: [
      { id: 'exploration', name: 'Exploration', scenarioIds: [] },
      { id: 'artifacts', name: 'Artifacts', scenarioIds: [] },
      { id: 'escape', name: 'Escape', scenarioIds: [] },
      { id: 'cooperation', name: 'Multiplayer Cooperation', scenarioIds: [] },
      { id: 'chaos-regression', name: 'Chaos Regression', scenarioIds: [] },
    ],
  };
}

export function loadScenarioStore(path = scenarioStorePath) {
  const loaded = readJson(path, null);
  if (!loaded) return defaultStore();
  return {
    ...defaultStore(),
    ...loaded,
    scenarios: Array.isArray(loaded.scenarios) ? loaded.scenarios : [],
    packs: Array.isArray(loaded.packs) ? loaded.packs : defaultStore().packs,
  };
}

export function saveScenarioStore(store, path = scenarioStorePath) {
  writeJson(path, store);
}

export function findScenario(store, id) {
  return (store.scenarios || []).find((scenario) => scenario.id === id && scenario.archived !== true) || null;
}

function tagsFromText(text) {
  const lower = text.toLowerCase();
  const tags = new Set();
  if (/solo|single/.test(lower)) tags.add('solo');
  if (/(multi|4-player|four player|cooperation|coop|crew|help)/.test(lower)) tags.add('multiplayer');
  if (/(cooperation|coop|help|crew|together)/.test(lower)) tags.add('cooperation');
  if (/(escape|flee|landing|exit)/.test(lower)) tags.add('escape');
  if (/(artifact|relic|dig|treasure)/.test(lower)) tags.add('artifact');
  if (/(exploration|explore|reveal|move|map|route)/.test(lower)) tags.add('exploration');
  if (/(exhausted|survival|weak|zero|stat|pressure|injured)/.test(lower)) tags.add('survival');
  if (/(chaos|risky|volatile|random)/.test(lower)) tags.add('chaos');
  if (/(benchmark|regression)/.test(lower)) tags.add('benchmark');
  if (tags.size === 0) tags.add('smoke');
  return [...tags].filter((tag) => SUPPORTED_TAGS.includes(tag));
}

function targetsForTags(tags) {
  const targets = [];
  for (const tag of tags) {
    for (const target of TARGET_PRESETS[tag] || []) {
      if (!targets.some((existing) => existing.metric === target.metric && existing.op === target.op)) targets.push(target);
    }
  }
  if (targets.length === 0) targets.push({ metric: 'lifeScore', op: '>=', value: 30, label: 'Life score' });
  return targets;
}

function failureSignalsForTags(tags) {
  const signals = [FAILURE_SIGNAL_PRESETS.flatStreak];
  if (tags.includes('survival')) signals.push(FAILURE_SIGNAL_PRESETS.zeroStatPlayers);
  if (tags.includes('exploration')) signals.push(FAILURE_SIGNAL_PRESETS.lowMoveShare);
  if (tags.includes('cooperation')) signals.push(FAILURE_SIGNAL_PRESETS.noHelp);
  if (tags.includes('escape')) signals.push(FAILURE_SIGNAL_PRESETS.noFlee);
  if (tags.includes('artifact')) signals.push(FAILURE_SIGNAL_PRESETS.lowArtifacts);
  return signals;
}

function strategiesForTags(tags, players) {
  if (tags.includes('cooperation') && players >= 4) return ['balanced', 'rest', 'move', 'risky'];
  if (tags.includes('escape')) return ['risky', 'move', 'balanced'];
  if (tags.includes('artifact')) return ['dig', 'balanced', 'risky'];
  if (tags.includes('exploration')) return ['move', 'balanced', 'risky'];
  if (tags.includes('chaos')) return ['risky', 'move', 'dig', 'idle'];
  if (players >= 4) return ['balanced', 'move', 'rest', 'risky'];
  return ['balanced'];
}

function initialAssumptionsFromText(text) {
  const lower = text.toLowerCase();
  const assumptions = [];
  const exhausted = lower.match(/(\d+|one|two|three|four)\s+exhausted/);
  if (exhausted || /exhausted|weak|injured/.test(lower)) {
    assumptions.push({
      key: 'playerStats',
      description: exhausted ? `${exhausted[1]} exhausted player(s)` : 'one or more exhausted players',
      support: SETUP_SUPPORT.playerStats,
      mode: 'notYetSupported',
    });
  }
  if (/artifact/.test(lower) && /(has|with|holding|one artifact)/.test(lower)) {
    assumptions.push({
      key: 'artifactsHeld',
      description: 'one player starts with or has pressure around an artifact',
      support: SETUP_SUPPORT.artifactsHeld,
      mode: 'notYetSupported',
    });
  }
  if (/landing.*revealed|revealed.*landing/.test(lower)) {
    assumptions.push({
      key: 'landingRevealed',
      description: 'landing zone is visible or strategically relevant',
      support: SETUP_SUPPORT.landingRevealed,
      mode: 'observedOnly',
    });
  }
  return assumptions;
}

export function parseScenarioIntent(text, overrides = {}) {
  const source = String(text || '').trim();
  const lower = source.toLowerCase();
  const playerMatch = lower.match(/([1-4])\s*(?:p|player|players|-player)/);
  const players = Number(overrides.players || (playerMatch ? playerMatch[1] : lower.includes('solo') ? 1 : lower.includes('cooperation') ? 4 : 1));
  const tags = [...new Set([...(overrides.tags || []), ...tagsFromText(source)])];
  const turns = Number(overrides.turns || (lower.includes('short') ? 6 : lower.includes('long') ? 16 : players >= 4 ? 10 : 12));
  const id = overrides.id || slugify(source || `scenario-${Date.now()}`);
  const name = overrides.name || source.replace(/\s+/g, ' ').trim() || id;
  const strategies = overrides.strategies || strategiesForTags(tags, players);

  return normalizeScenario({
    id,
    name,
    version: 1,
    description: source,
    designQuestion: overrides.designQuestion || questionForTags(tags, players),
    players,
    turns,
    strategies,
    batch: Number(overrides.batch || 1),
    seed: overrides.seed || stableSeed(id),
    tags,
    initialState: {
      assumptions: initialAssumptionsFromText(source),
      support: SETUP_SUPPORT,
    },
    targets: overrides.targets || targetsForTags(tags),
    failureSignals: overrides.failureSignals || failureSignalsForTags(tags),
    notes: {
      author: overrides.note || '',
      hypothesis: source,
      decision: '',
    },
    ladder: {
      prerequisites: [],
      easier: [],
      harder: [],
      related: [],
    },
    packs: tags.filter((tag) => ['exploration', 'artifact', 'escape', 'cooperation'].includes(tag)),
    createdAt: now(),
    updatedAt: now(),
    archived: false,
  });
}

export function questionForTags(tags, players) {
  if (tags.includes('escape') && tags.includes('cooperation')) return 'Does escape pressure create interesting cooperation instead of pure panic?';
  if (tags.includes('escape')) return 'Does escape pressure create a readable, high-stakes decision?';
  if (tags.includes('artifact')) return 'Does artifact hunting produce payoff before the run goes flat?';
  if (tags.includes('exploration')) return 'Does movement create visible discovery and route tension?';
  if (tags.includes('survival')) return 'Does stat pressure create meaningful recovery choices before collapse?';
  if (tags.includes('chaos')) return 'Does volatility create drama without drowning out decisions?';
  return players > 1 ? 'Does this multiplayer setup produce readable shared decisions?' : 'Does this setup produce an alive solo turn arc?';
}

export function normalizeScenario(scenario) {
  const id = slugify(scenario.id || scenario.name);
  const players = Math.max(1, Math.min(4, Number(scenario.players || 1)));
  const tags = [...new Set((scenario.tags || []).filter((tag) => SUPPORTED_TAGS.includes(tag)))];
  const strategies = (scenario.strategies || strategiesForTags(tags, players)).filter((strategy) => ALLOWED_STRATEGIES.includes(strategy));
  return {
    schemaVersion: 1,
    ...scenario,
    id,
    name: scenario.name || id,
    version: Number(scenario.version || 1),
    players,
    turns: Math.max(1, Number(scenario.turns || (players >= 4 ? 10 : 12))),
    strategies: strategies.length > 0 ? strategies : ['balanced'],
    batch: Math.max(1, Number(scenario.batch || 1)),
    seed: scenario.seed || stableSeed(id),
    tags,
    initialState: {
      assumptions: scenario.initialState?.assumptions || [],
      support: { ...SETUP_SUPPORT, ...(scenario.initialState?.support || {}) },
    },
    targets: scenario.targets?.length > 0 ? scenario.targets : targetsForTags(tags),
    failureSignals: scenario.failureSignals?.length > 0 ? scenario.failureSignals : failureSignalsForTags(tags),
    notes: scenario.notes || {},
    ladder: scenario.ladder || { prerequisites: [], easier: [], harder: [], related: [] },
    packs: scenario.packs || tags.filter((tag) => ['exploration', 'artifact', 'escape', 'cooperation'].includes(tag)),
    importance: scenario.importance || (tags.includes('artifact') || tags.includes('escape') || tags.includes('cooperation') ? 'core' : 'supporting'),
    oracleGoals: scenario.oracleGoals || {},
    createdAt: scenario.createdAt || now(),
    updatedAt: now(),
    archived: Boolean(scenario.archived),
  };
}

export function validateScenario(scenario, allScenarios = []) {
  const errors = [];
  const warnings = [];
  if (!scenario.id) errors.push('missing id');
  if (!scenario.name) errors.push('missing name');
  if (!scenario.designQuestion) errors.push('missing designQuestion');
  if (scenario.players < 1 || scenario.players > 4) errors.push('players must be between 1 and 4');
  if (!Array.isArray(scenario.strategies) || scenario.strategies.length === 0) errors.push('at least one strategy is required');
  for (const strategy of scenario.strategies || []) {
    if (!ALLOWED_STRATEGIES.includes(strategy)) errors.push(`unknown strategy: ${strategy}`);
  }
  for (const target of scenario.targets || []) {
    if (!['>=', '<=', '>', '<', '=='].includes(target.op)) errors.push(`invalid target operator for ${target.metric}`);
  }
  const duplicates = allScenarios.filter((item) => item.id === scenario.id);
  if (duplicates.length > 1) errors.push(`duplicate id: ${scenario.id}`);
  for (const assumption of scenario.initialState?.assumptions || []) {
    if (assumption.support === 'notYetSupported' || assumption.mode === 'notYetSupported') {
      warnings.push(`${assumption.key} is stored as an assumption; not enforced by setup yet`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function validateStore(store) {
  const scenarios = store.scenarios || [];
  const results = scenarios.map((scenario) => ({ id: scenario.id, ...validateScenario(scenario, scenarios) }));
  return {
    ok: results.every((result) => result.ok),
    results,
  };
}

export function compileScenarioArgs(scenario, extra = {}) {
  const normalized = normalizeScenario(scenario);
  const args = [
    `--scenario-id=${normalized.id}`,
    `--scenario=${normalized.id}`,
    `--players=${normalized.players}`,
    `--turns=${normalized.turns}`,
    `--batch=${normalized.batch}`,
    `--seed=${normalized.seed}`,
    `--strategies=${normalized.strategies.join(',')}`,
    `--scenario-file=${extra.scenarioFile || scenarioStorePath}`,
    `--design-question=${normalized.designQuestion}`,
    `--tags=${normalized.tags.join(',')}`,
  ];
  if (extra.quiet) args.push('--quiet');
  if (extra.balance) args.push(`--balance=${extra.balance}`);
  return args;
}

export function scenarioToSimulatorPreset(scenario) {
  const normalized = normalizeScenario(scenario);
  return {
    players: normalized.players,
    turns: normalized.turns,
    strategy: normalized.strategies[0] || 'balanced',
    strategies: normalized.strategies.join(','),
    batch: normalized.batch,
    label: normalized.name,
    scenarioDefinition: normalized,
  };
}

export function metricValue(report, metric) {
  const actionTotals = report.aggregate?.actionTotals || {};
  const totalActions = Object.values(actionTotals).reduce((sum, count) => sum + Number(count || 0), 0);
  const flatStreak = Math.max(
    0,
    ...(report.runs || []).flatMap((run) => (run.funDebugger?.flatStreaks || []).map((streak) => streak.length || 0)),
  );
  const values = {
    lifeScore: report.funDebugger?.averageLifeScore || 0,
    flatTurnRate: report.funDebugger?.flatTurnRate || 0,
    aliveTurnRate: report.funDebugger?.aliveTurnRate || 0,
    artifacts: report.aggregate?.averages?.artifacts || 0,
    revealedZones: report.aggregate?.averages?.revealedZones || 0,
    invalidAttempts: report.aggregate?.averages?.invalidAttempts || 0,
    zeroStatPlayers: report.aggregate?.averages?.zeroStatPlayers || 0,
    spikeTurns: report.aggregate?.averages?.spikeTurns || 0,
    moveShare: totalActions > 0 ? Number(actionTotals.Move || 0) / totalActions : 0,
    digActions: Number(actionTotals.Dig || 0),
    helpActions: Number(actionTotals.Help || 0),
    fleeActions: Number(actionTotals.Flee || 0),
    flatStreak,
  };
  return values[metric] ?? 0;
}

export function evaluateCheck(report, check) {
  const actual = metricValue(report, check.metric);
  const target = Number(check.value);
  const pass = check.op === '>=' ? actual >= target
    : check.op === '<=' ? actual <= target
      : check.op === '>' ? actual > target
        : check.op === '<' ? actual < target
          : check.op === '==' ? actual === target
            : false;
  return { ...check, actual, pass };
}

export function evaluateScenarioReport(report, scenario) {
  const targetResults = (scenario.targets || []).map((target) => evaluateCheck(report, target));
  const failureResults = (scenario.failureSignals || []).map((signal) => evaluateCheck(report, signal));
  const triggeredFailures = failureResults.filter((result) => result.pass);
  const passedTargets = targetResults.filter((result) => result.pass);
  const unsupported = (scenario.initialState?.assumptions || []).filter((assumption) => assumption.support === 'notYetSupported' || assumption.mode === 'notYetSupported');
  let verdict = 'answered';
  const reasons = [];
  if (triggeredFailures.length > 0) {
    verdict = 'failed';
    reasons.push(`failure signals triggered: ${triggeredFailures.map((item) => item.label || item.metric).join(', ')}`);
  }
  if (passedTargets.length < targetResults.length) {
    verdict = triggeredFailures.length > 0 ? 'failed' : 'inconclusive';
    reasons.push(`targets passed ${passedTargets.length}/${targetResults.length}`);
  }
  if (unsupported.length > 0 && verdict === 'answered') {
    verdict = 'inconclusive';
    reasons.push('some initial assumptions were not engine-enforced');
  }
  if (reasons.length === 0) reasons.push('scenario targets passed without failure signals');
  return {
    scenarioId: scenario.id,
    designQuestion: scenario.designQuestion,
    verdict,
    reasons,
    targets: targetResults,
    failureSignals: failureResults,
    unsupportedAssumptions: unsupported,
    nextScenario: suggestFollowUpScenario(scenario, verdict),
  };
}

export function suggestFollowUpScenario(scenario, verdict) {
  const base = normalizeScenario(scenario);
  const suffix = verdict === 'failed' ? 'easier' : verdict === 'answered' ? 'harder' : 'isolated';
  return {
    id: slugify(`${base.id}-${suffix}`),
    name: `${base.name} (${suffix})`,
    changes: verdict === 'failed'
      ? ['reduce pressure', 'shorten run', 'isolate one system']
      : verdict === 'answered'
        ? ['increase pressure', 'add multiplayer variant', 'extend turns']
        : ['remove unsupported assumptions', 'narrow design question'],
  };
}

export function scenarioReportPaths(scenarioId) {
  const dir = resolve(scenarioReportRoot, scenarioId);
  const publicDir = resolve(publicScenarioRoot, scenarioId);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    dir,
    publicDir,
    latest: resolve(dir, 'latest-report.json'),
    stamped: resolve(dir, `run-${stamp}.json`),
    publicLatest: resolve(publicDir, 'latest-report.json'),
    history: resolve(dir, 'history.json'),
  };
}

export function writeScenarioReport(report, scenario) {
  const paths = scenarioReportPaths(scenario.id);
  writeJson(paths.latest, report);
  writeJson(paths.stamped, report);
  writeJson(paths.publicLatest, report);
  const history = readJson(paths.history, []);
  const entry = {
    generatedAt: report.generatedAt || now(),
    scenarioId: scenario.id,
    verdict: report.scenarioVerdict?.verdict || 'unknown',
    lifeScore: report.funDebugger?.averageLifeScore || 0,
    flatTurnRate: report.funDebugger?.flatTurnRate || 0,
    targetPassRate: report.scenarioVerdict?.targets?.length
      ? report.scenarioVerdict.targets.filter((target) => target.pass).length / report.scenarioVerdict.targets.length
      : 0,
    topIssue: report.funDebugger?.topIssue?.label || null,
    topExperiment: report.funDebugger?.topExperiments?.[0]?.experiment || null,
    reportPath: paths.stamped,
  };
  writeJson(paths.history, [entry, ...(Array.isArray(history) ? history : [])].slice(0, 100));
  return paths;
}

export function runSimulatorForScenario(scenario, extra = {}) {
  const args = [resolve(root, 'scripts', 'gameplay-simulator.mjs'), ...compileScenarioArgs(scenario, extra)];
  const timeout = Number(extra.timeoutMs || extra.timeout || 180_000);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 180_000,
  });
  return result;
}

export function upsertScenario(store, scenario) {
  const normalized = normalizeScenario(scenario);
  const next = { ...store, scenarios: [...(store.scenarios || [])] };
  const index = next.scenarios.findIndex((item) => item.id === normalized.id);
  if (index >= 0) next.scenarios[index] = normalized;
  else next.scenarios.push(normalized);
  for (const packId of normalized.packs || []) {
    const pack = (next.packs || []).find((item) => item.id === packId);
    if (pack && !pack.scenarioIds.includes(normalized.id)) pack.scenarioIds.push(normalized.id);
  }
  return next;
}
