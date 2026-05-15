import { createHash } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, extname, relative, resolve } from 'path';
import {
  findScenario,
  loadScenarioStore,
  readJson,
  root,
  scenarioReportRoot,
  slugify,
  writeJson,
} from './scenario-utils.mjs';

export const MEMORY_VERSION = '1.0.0';
export const memoryReportRoot = resolve(root, 'reports', 'simulator', 'memory');
export const publicMemoryRoot = resolve(root, 'app', 'public', 'simulator', 'memory');
export const latestMemoryPath = resolve(memoryReportRoot, 'latest-memory.json');
export const publicLatestMemoryPath = resolve(publicMemoryRoot, 'latest-memory.json');

export const THEME_SYNONYMS = {
  cooperation: ['cooperation', 'coop', 'help', 'crew', 'together', 'shared'],
  escape: ['escape', 'flee', 'landing', 'exit'],
  artifact: ['artifact', 'relic', 'dig', 'treasure'],
  agency: ['agency', 'choice', 'control', 'meaningful'],
  readability: ['readability', 'legibility', 'clarity', 'clear', 'invalid'],
  pacing: ['pacing', 'flow', 'tempo', 'flat'],
  tension: ['tension', 'pressure', 'desperate', 'danger'],
  recovery: ['recovery', 'rest', 'help', 'comeback'],
  survival: ['survival', 'stat', 'exhausted', 'collapse', 'zero'],
  exploration: ['exploration', 'explore', 'move', 'reveal', 'map'],
  surprise: ['surprise', 'event', 'card', 'volatile', 'chaos'],
};

const AUTHORITY = {
  oracleReport: 5,
  autopilotReport: 4,
  setupReport: 4,
  simulatorReport: 3,
  autoTuneReport: 3,
  tuningLedger: 2,
  scenarioDefinition: 2,
  unknown: 1,
};

const REPORT_PATHS = [
  resolve(root, 'reports', 'simulator', 'latest-report.json'),
  resolve(root, 'reports', 'simulator', 'oracle'),
  resolve(root, 'reports', 'simulator', 'setup-forge'),
  resolve(root, 'reports', 'simulator', 'autopilot'),
  resolve(root, 'reports', 'simulator', 'experiments'),
  resolve(root, 'reports', 'simulator', 'tuning-ledger.json'),
  scenarioReportRoot,
];

export function nowIso() {
  return new Date().toISOString();
}

function hashId(parts) {
  return createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 16);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePath(path) {
  return relative(root, path).replace(/\\/g, '/');
}

function latestByTimestamp(events, type = null) {
  return events
    .filter((event) => !type || event.type === type)
    .sort((a, b) => Date.parse(b.generatedAt || 0) - Date.parse(a.generatedAt || 0))[0] || null;
}

function strongestWeakest(scores = {}) {
  const entries = Object.entries(scores).filter(([, value]) => value && Number.isFinite(Number(value.score)));
  return {
    weakest: [...entries].sort(([, a], [, b]) => Number(a.score) - Number(b.score))[0] || null,
    strongest: [...entries].sort(([, a], [, b]) => Number(b.score) - Number(a.score))[0] || null,
  };
}

function scenarioIdFor(source = {}) {
  return source.scenarioId
    || source.scenario?.id
    || source.scenarioDefinition?.id
    || source.config?.scenarioId
    || source.config?.scenario
    || source.baselineOracle?.scenarioId
    || source.finalOracle?.scenarioId
    || source.baselineRun?.scenarioId
    || null;
}

function generatedAtFor(source = {}, fallback = null) {
  return source.generatedAt
    || source.createdAt
    || source.updatedAt
    || source.appliedAt
    || source.timestamp
    || fallback
    || nowIso();
}

function sourceTitle(type, source = {}, scenario = null) {
  if (type === 'scenarioDefinition') return scenario?.name || source.name || source.id || 'Scenario definition';
  if (type === 'oracleReport') return `Oracle ${source.oracleVerdict || 'verdict'}`;
  if (type === 'autopilotReport') return source.selectedChange?.title || source.intent?.text || 'Scenario Autopilot';
  if (type === 'setupReport') return `Setup ${source.setupLevel || source.setupApplication?.setupLevel || 'report'}`;
  if (type === 'autoTuneReport') return source.winner?.name || source.recommendation || 'Auto-tune report';
  if (type === 'tuningLedger') return source.changed || source.hypothesis || 'Tuning ledger';
  return source.config?.scenario || source.engine || 'Simulator report';
}

function sourceSummary(type, source = {}, scenario = null) {
  if (type === 'scenarioDefinition') return scenario?.designQuestion || source.designQuestion || source.description || 'Saved scenario design question.';
  if (type === 'oracleReport') {
    const weak = strongestWeakest(source.experienceScores).weakest;
    return `Oracle verdict ${source.oracleVerdict || 'unknown'} at score ${source.weightedScore ?? 'unknown'}; weakest dimension ${weak?.[0] || 'unknown'}.`;
  }
  if (type === 'autopilotReport') {
    const selected = source.selectedChange?.title || 'no selected change';
    return `Autopilot ${source.mode || 'run'} ended ${source.finalVerdict || 'unknown'} with ${selected}.`;
  }
  if (type === 'setupReport') {
    const app = source.setupApplication || source;
    return `Setup reached ${source.setupLevel || app.setupLevel || 'unknown'} with ${asArray(app.applied).length} applied, ${asArray(app.skipped).length} skipped, ${asArray(app.failed).length} failed.`;
  }
  if (type === 'autoTuneReport') {
    return source.winner
      ? `Auto-tune winner ${source.winner.name || source.winner.id} scored ${source.winner.weightedScore ?? 'unknown'}.`
      : `Auto-tune produced ${asArray(source.candidates).length || asArray(source.results).length || 0} candidate(s) and no accepted winner.`;
  }
  if (type === 'tuningLedger') return source.note || source.hypothesis || source.changed || 'Tuning ledger entry.';
  const issue = source.funDebugger?.topIssue?.label || source.scenarioVerdict?.verdict || 'simulator evidence';
  return `Simulator run captured ${source.aggregate?.runs || asArray(source.runs).length || 1} run(s); top signal ${issue}.`;
}

function metricsFor(type, source = {}) {
  if (type === 'oracleReport') {
    const { weakest, strongest } = strongestWeakest(source.experienceScores);
    return compact({
      weightedScore: source.weightedScore,
      confidence: source.confidence,
      weakestMetric: weakest?.[0],
      weakestScore: weakest?.[1]?.score,
      strongestMetric: strongest?.[0],
      strongestScore: strongest?.[1]?.score,
      setupLevel: source.setup?.level,
      criticalSkipped: source.setup?.criticalSkipped,
      gatePassed: source.gate?.passed,
    });
  }
  if (type === 'simulatorReport') {
    return compact({
      lifeScore: source.funDebugger?.averageLifeScore,
      flatTurnRate: source.funDebugger?.flatTurnRate,
      aliveTurnRate: source.funDebugger?.aliveTurnRate,
      invalidAttempts: source.aggregate?.averages?.invalidAttempts,
      zeroStatPlayers: source.aggregate?.averages?.zeroStatPlayers,
      artifacts: source.aggregate?.averages?.artifacts,
      revealedZones: source.aggregate?.averages?.revealedZones,
      runs: source.aggregate?.runs || asArray(source.runs).length,
      targetPassRate: source.scenarioVerdict?.targets?.length
        ? source.scenarioVerdict.targets.filter((target) => target.pass).length / source.scenarioVerdict.targets.length
        : undefined,
    });
  }
  if (type === 'setupReport') {
    const app = source.setupApplication || source;
    return compact({
      setupLevel: source.setupLevel || app.setupLevel,
      applied: asArray(app.applied).length,
      skipped: asArray(app.skipped).length,
      failed: asArray(app.failed).length,
      warnings: asArray(app.warnings).length,
      errors: asArray(app.errors).length,
    });
  }
  if (type === 'autopilotReport') {
    return compact({
      baselineScore: source.baselineOracle?.weightedScore,
      finalScore: source.finalOracle?.weightedScore ?? source.baselineOracle?.weightedScore,
      confidence: source.finalOracle?.confidence ?? source.baselineOracle?.confidence,
      scoreDelta: source.comparison?.delta?.weightedScore,
      lifeDelta: source.comparison?.delta?.lifeScore,
      flatDelta: source.comparison?.delta?.flatTurnRate,
      accepted: source.comparison?.accepted,
      candidates: asArray(source.candidateChanges).length,
    });
  }
  if (type === 'autoTuneReport') {
    return compact({
      winnerScore: source.winner?.weightedScore,
      candidates: asArray(source.candidates).length || asArray(source.results).length,
      rejected: [...asArray(source.ranked), ...asArray(source.results)].filter((item) => item.rejected || asArray(item.rejectedReasons).length > 0).length,
      dryRun: source.dryRun,
    });
  }
  return {};
}

function evidenceFor(type, source = {}) {
  if (type === 'oracleReport') {
    const { weakest, strongest } = strongestWeakest(source.experienceScores);
    return compact({
      verdict: source.oracleVerdict,
      weakestMetric: weakest ? { metric: weakest[0], score: weakest[1].score } : null,
      strongestMetric: strongest ? { metric: strongest[0], score: strongest[1].score } : null,
      diagnosis: asArray(source.diagnosis).slice(0, 3),
      smallestNextExperiment: source.smallestNextExperiment || null,
      gateFailures: asArray(source.gate?.failures),
      setupSupportNeeded: asArray(source.setupSupportNeeded),
    });
  }
  if (type === 'simulatorReport') {
    return compact({
      verdict: source.scenarioVerdict?.verdict,
      topIssue: source.funDebugger?.topIssue || null,
      topExperiments: asArray(source.funDebugger?.topExperiments).slice(0, 3),
      warnings: asArray(source.aggregate?.warnings).slice(0, 5),
      failedTargets: asArray(source.scenarioVerdict?.targets).filter((target) => !target.pass).map((target) => target.label || target.metric),
      triggeredFailures: asArray(source.scenarioVerdict?.failureSignals).filter((signal) => signal.pass).map((signal) => signal.label || signal.metric),
    });
  }
  if (type === 'setupReport') {
    const app = source.setupApplication || source;
    return compact({
      applied: asArray(app.applied).slice(0, 8),
      skipped: asArray(app.skipped).slice(0, 8),
      failed: asArray(app.failed).slice(0, 8),
      warnings: asArray(app.warnings).slice(0, 5),
      support: asArray(app.support).slice(0, 8),
    });
  }
  if (type === 'autopilotReport') {
    return compact({
      intent: source.intent?.text,
      finalVerdict: source.finalVerdict,
      selectedChange: source.selectedChange || null,
      comparison: source.comparison || null,
      rejectedReasons: asArray(source.comparison?.rejectedReasons),
      events: asArray(source.events).slice(-5),
    });
  }
  if (type === 'autoTuneReport') {
    return compact({
      winner: source.winner || null,
      recommendation: source.recommendation,
      rejected: [...asArray(source.ranked), ...asArray(source.results)]
        .filter((item) => item.rejected || asArray(item.rejectedReasons).length > 0)
        .slice(0, 6),
    });
  }
  return {};
}

function tagsFor(type, source = {}, scenario = null) {
  const values = new Set([
    ...asArray(scenario?.tags),
    ...asArray(source.tags),
    ...asArray(source.scenarioDefinition?.tags),
    ...asArray(source.scenario?.tags),
    ...asArray(source.intent?.qualities),
  ]);
  for (const theme of extractThemes(`${sourceTitle(type, source, scenario)} ${sourceSummary(type, source, scenario)} ${JSON.stringify(metricsFor(type, source))}`)) {
    values.add(theme);
  }
  return [...values].filter(Boolean).sort();
}

function systemsFor(type, source = {}) {
  const systems = new Set();
  if (type === 'scenarioDefinition') {
    for (const tag of asArray(source.tags)) systems.add(tag);
    if (source.setupForge) systems.add('setup');
  }
  if (type === 'oracleReport') {
    for (const item of asArray(source.evidence?.decisiveTurns)) systems.add(item.type);
    for (const needed of asArray(source.setupSupportNeeded)) systems.add(needed.key);
  }
  if (type === 'simulatorReport') {
    for (const key of Object.keys(source.aggregate?.actionTotals || {})) systems.add(key.toLowerCase());
    for (const risk of asArray(source.funDebugger?.systemicRisks)) systems.add(risk.key);
  }
  if (type === 'setupReport') {
    const app = source.setupApplication || source;
    for (const item of [...asArray(app.applied), ...asArray(app.skipped), ...asArray(app.failed)]) systems.add(item.field);
  }
  if (type === 'autopilotReport') {
    systems.add(source.selectedChange?.changeType || 'autopilot');
    for (const file of asArray(source.selectedChange?.files)) systems.add(file);
  }
  return [...systems].filter(Boolean).sort();
}

export function classifyMemorySource(path, source) {
  const normalizedPath = path ? normalizePath(path) : '';
  if (normalizedPath.includes('/experiments/') && !normalizedPath.endsWith('/autotune-report.json') && !normalizedPath.endsWith('/index.json')) return 'unknown';
  if (source?.oracleVersion || source?.experienceScores || source?.oracleVerdict) return 'oracleReport';
  if (source?.autopilotVersion || source?.candidateChanges || normalizedPath.includes('/autopilot/')) return 'autopilotReport';
  if (source?.setupForgeVersion || source?.setupApplication || normalizedPath.includes('setup-forge') || normalizedPath.endsWith('latest-setup-report.json')) return 'setupReport';
  if (normalizedPath.includes('/experiments/') || source?.winner || source?.ranked || source?.results || source?.candidates) return 'autoTuneReport';
  if (normalizedPath.endsWith('tuning-ledger.json')) return 'tuningLedger';
  if (source?.aggregate || source?.funDebugger || source?.scenarioVerdict || source?.turns || source?.runs) return 'simulatorReport';
  return 'unknown';
}

export function normalizeMemorySource({ path = '', source = {}, type = null, scenario = null } = {}) {
  const sourceType = type || classifyMemorySource(path, source);
  const scenarioId = scenario?.id || scenarioIdFor(source);
  const generatedAt = generatedAtFor(source, scenario?.updatedAt || scenario?.createdAt || null);
  return compact({
    id: hashId([sourceType, path || 'inline', scenarioId || '', generatedAt, sourceTitle(sourceType, source, scenario)]),
    type: sourceType,
    scenarioId,
    generatedAt,
    title: sourceTitle(sourceType, source, scenario),
    summary: sourceSummary(sourceType, source, scenario),
    metrics: metricsFor(sourceType, source),
    tags: tagsFor(sourceType, source, scenario),
    systems: systemsFor(sourceType, source),
    evidence: evidenceFor(sourceType, source),
    sourcePath: path ? normalizePath(path) : 'memory-input',
    authority: AUTHORITY[sourceType] || AUTHORITY.unknown,
  });
}

export function scenarioDefinitionEvents(store = loadScenarioStore()) {
  return asArray(store.scenarios)
    .filter((scenario) => scenario.archived !== true)
    .map((scenario) => normalizeMemorySource({
      path: 'simulator.scenarios.json',
      source: scenario,
      type: 'scenarioDefinition',
      scenario,
    }));
}

function listJsonFiles(target, warnings, maxFiles = 1200) {
  if (!existsSync(target)) return [];
  if (extname(target).toLowerCase() === '.json') return [target];
  const results = [];
  const stack = [target];
  while (stack.length > 0 && results.length < maxFiles) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch (error) {
      warnings.push(`Could not read ${normalizePath(current)}: ${error.message}`);
      continue;
    }
    for (const entry of entries) {
      const full = resolve(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && extname(entry.name).toLowerCase() === '.json') results.push(full);
      if (results.length >= maxFiles) break;
    }
  }
  if (results.length >= maxFiles) warnings.push(`Report scan capped at ${maxFiles} JSON files.`);
  return results;
}

function readJsonWithWarning(path, warnings) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    warnings.push(`Skipped malformed JSON ${normalizePath(path)}: ${error.message}`);
    return null;
  }
}

export function collectMemorySources({ paths = REPORT_PATHS, store = loadScenarioStore(), maxFiles = 1200 } = {}) {
  const warnings = [];
  const sources = [];
  for (const event of scenarioDefinitionEvents(store)) sources.push({ event, source: null });
  const seenPaths = new Set();
  for (const target of paths) {
    for (const path of listJsonFiles(target, warnings, maxFiles)) {
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);
      const json = readJsonWithWarning(path, warnings);
      if (!json) continue;
      if (Array.isArray(json) && normalizePath(path).endsWith('tuning-ledger.json')) {
        json.forEach((entry, index) => {
          sources.push({ event: normalizeMemorySource({ path: `${path}#${index}`, source: entry, type: 'tuningLedger' }), source: entry });
        });
        continue;
      }
      if (Array.isArray(json)) continue;
      const type = classifyMemorySource(path, json);
      if (type === 'unknown') continue;
      const scenario = scenarioIdFor(json) ? findScenario(store, scenarioIdFor(json)) : null;
      sources.push({ event: normalizeMemorySource({ path, source: json, type, scenario }), source: json });
    }
  }
  return {
    events: dedupeMemoryEvents(sources.map((item) => item.event)),
    warnings,
  };
}

export function dedupeMemoryEvents(events = []) {
  const byKey = new Map();
  for (const event of events) {
    const key = [
      event.type,
      event.scenarioId || '',
      event.generatedAt || '',
      event.title || '',
      event.summary,
    ].join('|');
    const existing = byKey.get(key);
    if (!existing || event.authority > existing.authority) byKey.set(key, event);
  }
  return [...byKey.values()].sort((a, b) => Date.parse(b.generatedAt || 0) - Date.parse(a.generatedAt || 0) || b.authority - a.authority);
}

export function extractThemes(text = '') {
  const lower = String(text || '').toLowerCase();
  const themes = [];
  for (const [theme, words] of Object.entries(THEME_SYNONYMS)) {
    if (words.some((word) => lower.includes(word))) themes.push(theme);
  }
  return themes;
}

function countBy(values = []) {
  return values.reduce((bucket, value) => {
    if (value) bucket[value] = (bucket[value] || 0) + 1;
    return bucket;
  }, {});
}

function topCounts(counts, limit = 5) {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function currentRecommendationFor(events = []) {
  const latestOracle = latestByTimestamp(events, 'oracleReport');
  const latestAutopilot = latestByTimestamp(events, 'autopilotReport');
  const setup = latestByTimestamp(events, 'setupReport');
  if (setup && (number(setup.metrics.skipped) > 0 || number(setup.metrics.failed) > 0)) {
    return {
      source: 'setup',
      priority: 'high',
      title: 'Resolve setup evidence limits before tuning balance',
      command: 'npm run setup:doctor',
      reason: 'Blocked or skipped setup fields reduce confidence in scenario conclusions.',
    };
  }
  if (latestAutopilot?.evidence?.selectedChange) {
    return {
      source: 'autopilot',
      priority: latestAutopilot.metrics.accepted === false ? 'high' : 'medium',
      title: latestAutopilot.evidence.selectedChange.title,
      command: latestAutopilot.evidence.selectedChange.verificationCommand || 'npm run autopilot:latest -- --markdown',
      reason: latestAutopilot.evidence.selectedChange.hypothesis || latestAutopilot.summary,
    };
  }
  if (latestOracle?.evidence?.smallestNextExperiment) {
    const experiment = latestOracle.evidence.smallestNextExperiment;
    return {
      source: 'oracle',
      priority: experiment.priority || 'medium',
      title: experiment.title,
      command: experiment.verificationCommand || 'npm run oracle:latest',
      reason: experiment.why || latestOracle.summary,
    };
  }
  return {
    source: 'memory',
    priority: 'medium',
    title: 'Capture fresh exact-engine evidence',
    command: 'npm run scenario:run -- --id=<scenario-id> && npm run oracle:scenario -- --id=<scenario-id>',
    reason: 'Memory does not have enough recent evidence to recommend a smaller change.',
  };
}

export function buildScenarioRollups(events = [], store = loadScenarioStore()) {
  const scenarios = asArray(store.scenarios).filter((scenario) => scenario.archived !== true);
  const ids = new Set([...scenarios.map((scenario) => scenario.id), ...events.map((event) => event.scenarioId).filter(Boolean)]);
  return [...ids].sort().map((scenarioId) => {
    const scenario = findScenario(store, scenarioId) || { id: scenarioId, name: scenarioId, tags: [] };
    const scenarioEvents = events.filter((event) => event.scenarioId === scenarioId || (event.type === 'scenarioDefinition' && event.scenarioId === scenarioId));
    const latestOracle = latestByTimestamp(scenarioEvents, 'oracleReport');
    const latestSimulator = latestByTimestamp(scenarioEvents, 'simulatorReport');
    const latestSetup = latestByTimestamp(scenarioEvents, 'setupReport');
    const latestAutopilot = latestByTimestamp(scenarioEvents, 'autopilotReport');
    const weakCounts = countBy([
      ...scenarioEvents.map((event) => event.metrics?.weakestMetric),
      ...scenarioEvents.map((event) => event.evidence?.topIssue?.key || event.evidence?.topIssue?.label),
      ...scenarioEvents.flatMap((event) => asArray(event.evidence?.failedTargets)),
      ...scenarioEvents.flatMap((event) => asArray(event.evidence?.triggeredFailures)),
    ]);
    const blockedFields = scenarioEvents.flatMap((event) => [
      ...asArray(event.evidence?.skipped).map((item) => item.field),
      ...asArray(event.evidence?.failed).map((item) => item.field),
      ...asArray(event.evidence?.setupSupportNeeded).map((item) => item.key),
    ]).filter(Boolean);
    const acceptedChanges = scenarioEvents
      .filter((event) => event.type === 'autopilotReport' && event.metrics?.accepted === true)
      .map((event) => event.evidence?.selectedChange?.title || event.title);
    const rejectedChanges = scenarioEvents
      .filter((event) => event.type === 'autopilotReport' && event.metrics?.accepted === false)
      .map((event) => event.evidence?.selectedChange?.title || event.title);
    return compact({
      scenarioId,
      name: scenario.name || scenarioId,
      designQuestion: scenario.designQuestion,
      tags: asArray(scenario.tags),
      importance: scenario.importance || 'supporting',
      eventCount: scenarioEvents.length,
      latestGeneratedAt: latestByTimestamp(scenarioEvents)?.generatedAt || null,
      latestScore: latestOracle?.metrics?.weightedScore ?? latestAutopilot?.metrics?.finalScore ?? null,
      latestConfidence: latestOracle?.metrics?.confidence ?? latestAutopilot?.metrics?.confidence ?? null,
      latestVerdict: latestOracle?.evidence?.verdict || latestAutopilot?.evidence?.finalVerdict || latestSimulator?.evidence?.verdict || null,
      latestSetupLevel: latestOracle?.metrics?.setupLevel || latestSetup?.metrics?.setupLevel || null,
      weakestMetric: latestOracle?.metrics?.weakestMetric || null,
      strongestMetric: latestOracle?.metrics?.strongestMetric || null,
      recurringIssues: topCounts(weakCounts, 6),
      blockedSetupFields: topCounts(countBy(blockedFields), 6),
      acceptedChanges,
      rejectedChanges,
      currentRecommendation: currentRecommendationFor(scenarioEvents),
      citations: scenarioEvents.slice(0, 8).map(citationForEvent),
    });
  });
}

export function buildThemeRollups(events = []) {
  return Object.keys(THEME_SYNONYMS).map((theme) => {
    const themeEvents = events.filter((event) => asArray(event.tags).includes(theme) || asArray(event.systems).includes(theme) || extractThemes(`${event.title} ${event.summary}`).includes(theme));
    const scenarios = [...new Set(themeEvents.map((event) => event.scenarioId).filter(Boolean))].sort();
    const weakCounts = countBy(themeEvents.map((event) => event.metrics?.weakestMetric));
    const latest = latestByTimestamp(themeEvents);
    return {
      theme,
      eventCount: themeEvents.length,
      scenarioIds: scenarios,
      latestGeneratedAt: latest?.generatedAt || null,
      recurringWeaknesses: topCounts(weakCounts, 4),
      latestSignal: latest ? `${latest.title}: ${latest.summary}` : 'No evidence yet.',
      citations: themeEvents.slice(0, 5).map(citationForEvent),
    };
  }).filter((theme) => theme.eventCount > 0);
}

export function buildExperiments(events = []) {
  return events
    .filter((event) => ['autopilotReport', 'autoTuneReport'].includes(event.type))
    .map((event) => {
      const accepted = event.type === 'autoTuneReport' ? Boolean(event.evidence?.winner) : event.metrics?.accepted === true;
      const rejected = event.type === 'autopilotReport' ? event.metrics?.accepted === false : !accepted && number(event.metrics?.rejected) > 0;
      return compact({
        id: event.id,
        generatedAt: event.generatedAt,
        scenarioId: event.scenarioId,
        sourceType: event.type,
        title: event.evidence?.selectedChange?.title || event.evidence?.winner?.name || event.title,
        status: accepted ? 'accepted' : rejected ? 'rejected' : event.metrics?.dryRun ? 'planned' : 'inconclusive',
        targetMetric: event.evidence?.selectedChange?.targetMetric || event.evidence?.winner?.targetMetric || null,
        scoreDelta: event.metrics?.scoreDelta,
        confidence: event.metrics?.confidence,
        reason: event.evidence?.selectedChange?.hypothesis || event.evidence?.recommendation || event.summary,
        rejectedReasons: asArray(event.evidence?.rejectedReasons),
        citation: citationForEvent(event),
      });
    })
    .sort((a, b) => Date.parse(b.generatedAt || 0) - Date.parse(a.generatedAt || 0));
}

export function buildSetupLimits(events = [], scenarios = []) {
  const importance = Object.fromEntries(scenarios.map((scenario) => [scenario.scenarioId, scenario.importance || 'supporting']));
  const fields = {};
  for (const event of events) {
    const blocked = [
      ...asArray(event.evidence?.skipped).map((item) => ({ field: item.field, reason: item.reason })),
      ...asArray(event.evidence?.failed).map((item) => ({ field: item.field, reason: item.error })),
      ...asArray(event.evidence?.setupSupportNeeded).map((item) => ({ field: item.key, reason: item.support || item.description })),
    ].filter((item) => item.field);
    for (const item of blocked) {
      const score = importance[event.scenarioId] === 'core' ? 3 : 1;
      const entry = fields[item.field] || { field: item.field, count: 0, score: 0, scenarios: new Set(), reasons: new Set(), citations: [] };
      entry.count += 1;
      entry.score += score;
      if (event.scenarioId) entry.scenarios.add(event.scenarioId);
      if (item.reason) entry.reasons.add(String(item.reason));
      entry.citations.push(citationForEvent(event));
      fields[item.field] = entry;
    }
  }
  return Object.values(fields)
    .map((entry) => ({
      field: entry.field,
      count: entry.count,
      score: entry.score,
      scenarioIds: [...entry.scenarios].sort(),
      reasons: [...entry.reasons].slice(0, 5),
      recommendation: setupLimitRecommendation(entry.field),
      citations: entry.citations.slice(0, 5),
    }))
    .sort((a, b) => b.score - a.score || a.field.localeCompare(b.field));
}

function setupLimitRecommendation(field) {
  const recommendations = {
    landingZone: 'Add a safe pre-start landing-zone override or remove landing-zone dependence from the scenario.',
    currentDay: 'Add dev-only queue/day seeding or restate the scenario as pressure generated by prelude turns.',
    queuePhase: 'Add a queue phase harness before claiming phase-specific evidence.',
    playerLocations: 'Prefer revealed-zone and prelude movement evidence until location setup is exact.',
    artifacts: 'Keep artifact setup exact through the supported artifact setter before tuning payoff.',
    playerStats: 'Use Setup Forge stat setters before evaluating survival or recovery pressure.',
  };
  return recommendations[field] || `Add or reduce setup dependence for ${field}.`;
}

export function buildFindings(events = [], scenarioRollups = []) {
  const findings = [];
  const weakCounts = countBy(events.map((event) => event.metrics?.weakestMetric).filter(Boolean));
  for (const item of topCounts(weakCounts, 8).filter((entry) => entry.count >= 2)) {
    findings.push({
      type: 'recurring-weakness',
      severity: item.count >= 4 ? 'high' : 'medium',
      title: `${item.key} is recurring across evidence`,
      summary: `${item.key} appears as the weakest dimension in ${item.count} memory event(s).`,
      citations: events.filter((event) => event.metrics?.weakestMetric === item.key).slice(0, 5).map(citationForEvent),
    });
  }
  for (const event of events.filter((item) => item.type === 'autopilotReport' && item.metrics?.accepted === true).slice(0, 5)) {
    findings.push({
      type: 'effective-intervention',
      severity: 'positive',
      title: event.evidence?.selectedChange?.title || 'Accepted Autopilot change',
      summary: `Accepted with score delta ${event.metrics.scoreDelta ?? 'unknown'} and confidence ${event.metrics.confidence ?? 'unknown'}.`,
      citations: [citationForEvent(event)],
    });
  }
  for (const event of events.filter((item) => item.type === 'autopilotReport' && item.metrics?.accepted === false).slice(0, 5)) {
    findings.push({
      type: 'rejected-intervention',
      severity: 'high',
      title: event.evidence?.selectedChange?.title || 'Rejected Autopilot change',
      summary: asArray(event.evidence?.rejectedReasons).join(' / ') || 'Rejected by comparison gates.',
      citations: [citationForEvent(event)],
    });
  }
  for (const scenario of scenarioRollups.filter((item) => asArray(item.blockedSetupFields).length > 0).slice(0, 8)) {
    findings.push({
      type: 'setup-blocker',
      severity: scenario.importance === 'core' ? 'high' : 'medium',
      title: `${scenario.scenarioId} has setup evidence limits`,
      summary: scenario.blockedSetupFields.map((item) => `${item.key} x${item.count}`).join(', '),
      citations: asArray(scenario.citations).slice(0, 3),
    });
  }
  for (const scenario of scenarioRollups.filter((item) => item.latestConfidence !== null && number(item.latestConfidence) < 0.6).slice(0, 8)) {
    findings.push({
      type: 'evidence-quality',
      severity: 'medium',
      title: `${scenario.scenarioId} has low-confidence evidence`,
      summary: `Latest confidence is ${Math.round(number(scenario.latestConfidence) * 100)}%.`,
      citations: asArray(scenario.citations).slice(0, 3),
    });
  }
  return findings.slice(0, 20);
}

export function buildOpenQuestions(events = [], scenarioRollups = [], { staleDays = 14 } = {}) {
  const now = Date.now();
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  const questions = [];
  for (const scenario of scenarioRollups) {
    if (!events.some((event) => event.scenarioId === scenario.scenarioId && event.type === 'simulatorReport')) {
      questions.push({
        type: 'missing-simulator',
        scenarioId: scenario.scenarioId,
        question: `What does ${scenario.scenarioId} do in the exact-engine simulator?`,
        command: `npm run scenario:run -- --id=${scenario.scenarioId}`,
      });
    }
    if (!events.some((event) => event.scenarioId === scenario.scenarioId && event.type === 'oracleReport')) {
      questions.push({
        type: 'missing-oracle',
        scenarioId: scenario.scenarioId,
        question: `How does the Oracle score ${scenario.scenarioId}?`,
        command: `npm run oracle:scenario -- --id=${scenario.scenarioId}`,
      });
    }
    if (scenario.latestGeneratedAt && now - Date.parse(scenario.latestGeneratedAt) > staleMs) {
      questions.push({
        type: 'stale-evidence',
        scenarioId: scenario.scenarioId,
        question: `Is ${scenario.scenarioId} still accurate after recent systems work?`,
        command: `npm run scenario:run -- --id=${scenario.scenarioId} && npm run oracle:scenario -- --id=${scenario.scenarioId}`,
      });
    }
    if (number(scenario.latestConfidence, 1) < 0.6) {
      questions.push({
        type: 'low-confidence',
        scenarioId: scenario.scenarioId,
        question: `Which missing setup or telemetry would raise confidence for ${scenario.scenarioId}?`,
        command: `npm run memory:query -- "why is ${scenario.scenarioId} low confidence"`,
      });
    }
    if (asArray(scenario.blockedSetupFields).length > 0) {
      questions.push({
        type: 'setup-blocked',
        scenarioId: scenario.scenarioId,
        question: `Which setup fields are blocking honest conclusions for ${scenario.scenarioId}?`,
        command: `npm run setup:doctor`,
      });
    }
  }
  return questions.slice(0, 50);
}

export function buildRecommendations(events = [], scenarioRollups = [], setupLimits = []) {
  const recommendations = [];
  for (const limit of setupLimits.slice(0, 5)) {
    recommendations.push({
      priority: limit.score >= 3 ? 'high' : 'medium',
      type: 'setup',
      title: limit.recommendation,
      command: 'npm run setup:doctor',
      reason: `${limit.field} appears in ${limit.count} blocked setup signal(s).`,
      citations: limit.citations.slice(0, 3),
    });
  }
  for (const scenario of scenarioRollups.filter((item) => item.eventCount === 1).slice(0, 6)) {
    recommendations.push({
      priority: 'medium',
      type: 'evidence',
      title: `Capture simulator and Oracle evidence for ${scenario.scenarioId}`,
      command: `npm run scenario:run -- --id=${scenario.scenarioId} && npm run oracle:scenario -- --id=${scenario.scenarioId}`,
      reason: 'The memory currently has only scenario definition evidence.',
      citations: scenario.citations.slice(0, 2),
    });
  }
  for (const scenario of scenarioRollups.filter((item) => item.weakestMetric && asArray(item.blockedSetupFields).length === 0).slice(0, 6)) {
    recommendations.push({
      priority: scenario.importance === 'core' ? 'high' : 'medium',
      type: 'iteration',
      title: `Run Autopilot against ${scenario.weakestMetric} for ${scenario.scenarioId}`,
      command: `npm run autopilot:scenario -- --id=${scenario.scenarioId} --mode=single-pass`,
      reason: `Latest Oracle weakness is ${scenario.weakestMetric}.`,
      citations: scenario.citations.slice(0, 3),
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'medium',
      type: 'baseline',
      title: 'Build a fresh memory snapshot after the next simulator run',
      command: 'npm run memory:build',
      reason: 'No high-priority evidence gaps were found.',
      citations: [],
    });
  }
  return recommendations.slice(0, 20);
}

export function citationForEvent(event = {}) {
  return compact({
    id: event.id,
    type: event.type,
    scenarioId: event.scenarioId,
    generatedAt: event.generatedAt,
    sourcePath: event.sourcePath,
    title: event.title,
    keyMetric: event.metrics?.weightedScore !== undefined
      ? `score ${event.metrics.weightedScore}`
      : event.metrics?.lifeScore !== undefined
        ? `life ${event.metrics.lifeScore}`
        : event.metrics?.setupLevel || event.metrics?.finalScore || null,
  });
}

function sourceCounts(events = []) {
  return countBy(events.map((event) => event.type));
}

export function buildMemory({ includeRaw = false, staleDays = 14, store = loadScenarioStore(), sources = null } = {}) {
  const collected = sources ? { events: dedupeMemoryEvents(sources), warnings: [] } : collectMemorySources({ store });
  const scenarios = buildScenarioRollups(collected.events, store);
  const themes = buildThemeRollups(collected.events);
  const setupLimits = buildSetupLimits(collected.events, scenarios);
  const experiments = buildExperiments(collected.events);
  const findings = buildFindings(collected.events, scenarios);
  const openQuestions = buildOpenQuestions(collected.events, scenarios, { staleDays });
  const recommendations = buildRecommendations(collected.events, scenarios, setupLimits);
  return compact({
    schemaVersion: 1,
    memoryVersion: MEMORY_VERSION,
    generatedAt: nowIso(),
    sourceCounts: sourceCounts(collected.events),
    scenarioCount: scenarios.length,
    eventCount: collected.events.length,
    scenarios,
    themes,
    findings,
    experiments: experiments.slice(0, 50),
    setupLimits,
    openQuestions,
    recommendations,
    queryExamples: [
      'what do we know about escape pressure?',
      'which setup blockers matter most?',
      'what improved cooperation?',
      'what should we try next for solo-artifact-hunt?',
    ],
    citations: collected.events.slice(0, 20).map(citationForEvent),
    warnings: collected.warnings,
    events: includeRaw ? collected.events : undefined,
  });
}

export function parseMemoryQuery(query = '', memory = null) {
  const text = String(query || '').trim();
  const lower = text.toLowerCase();
  const scenarioIds = new Set();
  for (const scenario of asArray(memory?.scenarios)) {
    if (lower.includes(String(scenario.scenarioId).toLowerCase()) || lower.includes(String(scenario.name || '').toLowerCase())) {
      scenarioIds.add(scenario.scenarioId);
    }
  }
  for (const match of lower.matchAll(/[a-z0-9]+(?:-[a-z0-9]+){1,}/g)) scenarioIds.add(match[0]);
  const themes = extractThemes(lower);
  const metricWords = ['agency', 'readability', 'tension', 'surprise', 'recovery', 'systemIntegration', 'replayability', 'pacing', 'emotionalTexture', 'outcomeLegibility', 'lifeScore', 'flatTurnRate', 'confidence'];
  const metrics = metricWords.filter((metric) => lower.includes(metric.toLowerCase()) || lower.includes(metric.replace(/[A-Z]/g, (char) => ` ${char.toLowerCase()}`)));
  return {
    text,
    scenarioIds: [...scenarioIds],
    themes,
    metrics,
    wantsBlockers: /\b(block|blocked|setup|skipped|failed|limit)\b/.test(lower),
    wantsAccepted: /\b(accepted|worked|improved|winner|better)\b/.test(lower),
    wantsRejected: /\b(rejected|regressed|worse|failed)\b/.test(lower),
    wantsNext: /\b(next|recommend|try|should|todo|action)\b/.test(lower),
    keywords: lower.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !['what', 'which', 'about', 'know', 'with', 'this', 'that'].includes(word)),
  };
}

export function rankMemoryEvents(events = [], parsed = {}, limit = 12) {
  return events
    .map((event) => {
      const haystack = `${event.title} ${event.summary} ${asArray(event.tags).join(' ')} ${asArray(event.systems).join(' ')} ${JSON.stringify(event.metrics)} ${JSON.stringify(event.evidence)}`.toLowerCase();
      let score = event.authority || 0;
      if (parsed.scenarioIds.includes(event.scenarioId)) score += 20;
      for (const theme of parsed.themes) {
        if (asArray(event.tags).includes(theme) || haystack.includes(theme)) score += 8;
      }
      for (const metric of parsed.metrics) {
        if (Object.prototype.hasOwnProperty.call(event.metrics || {}, metric) || haystack.includes(metric.toLowerCase())) score += 6;
      }
      if (parsed.wantsBlockers && (asArray(event.evidence?.skipped).length || asArray(event.evidence?.failed).length || asArray(event.evidence?.setupSupportNeeded).length)) score += 10;
      if (parsed.wantsAccepted && (event.metrics?.accepted === true || event.evidence?.winner)) score += 10;
      if (parsed.wantsRejected && (event.metrics?.accepted === false || asArray(event.evidence?.rejectedReasons).length)) score += 10;
      for (const keyword of parsed.keywords) {
        if (haystack.includes(keyword)) score += 1;
      }
      const ageDays = Math.max(0, (Date.now() - Date.parse(event.generatedAt || 0)) / 86400000);
      score += Math.max(0, 4 - Math.min(4, ageDays / 7));
      return { event, score };
    })
    .filter((item) => item.score > 1)
    .sort((a, b) => b.score - a.score || Date.parse(b.event.generatedAt || 0) - Date.parse(a.event.generatedAt || 0))
    .slice(0, limit);
}

function sentenceList(items = [], fallback = 'No evidence found.') {
  return items.length > 0 ? items.join(' ') : fallback;
}

export function answerMemoryQuery(memory, query, { limit = 8 } = {}) {
  const parsedQuery = parseMemoryQuery(query, memory);
  const events = asArray(memory.events).length > 0 ? memory.events : [];
  const ranked = rankMemoryEvents(events, parsedQuery, limit);
  const matchedEvents = ranked.map((item) => item.event);
  const scenarioHits = asArray(memory.scenarios).filter((scenario) => parsedQuery.scenarioIds.includes(scenario.scenarioId));
  const themeHits = asArray(memory.themes).filter((theme) => parsedQuery.themes.includes(theme.theme));
  const blockers = [
    ...asArray(memory.setupLimits).filter((limitItem) => parsedQuery.wantsBlockers || parsedQuery.keywords.includes(limitItem.field.toLowerCase())),
    ...scenarioHits.flatMap((scenario) => asArray(scenario.blockedSetupFields).map((field) => ({ ...field, scenarioId: scenario.scenarioId }))),
  ].slice(0, 5);
  const known = [
    ...scenarioHits.map((scenario) => `${scenario.scenarioId}: ${scenario.latestVerdict || 'unknown verdict'}, score ${scenario.latestScore ?? 'unknown'}, confidence ${scenario.latestConfidence === null || scenario.latestConfidence === undefined ? 'unknown' : `${Math.round(number(scenario.latestConfidence) * 100)}%`}.`),
    ...themeHits.map((theme) => `${theme.theme}: ${theme.eventCount} event(s) across ${theme.scenarioIds.length} scenario(s); ${theme.latestSignal}`),
    ...matchedEvents.slice(0, 4).map((event) => `${event.title}: ${event.summary}`),
  ];
  const changed = asArray(memory.experiments)
    .filter((experiment) => (
      parsedQuery.scenarioIds.length === 0 || parsedQuery.scenarioIds.includes(experiment.scenarioId)
    ) && (
      parsedQuery.themes.length === 0 || parsedQuery.themes.some((theme) => String(experiment.reason || '').toLowerCase().includes(theme))
    ))
    .slice(0, 4)
    .map((experiment) => `${experiment.status}: ${experiment.title}${experiment.scoreDelta !== undefined ? ` (${experiment.scoreDelta > 0 ? '+' : ''}${experiment.scoreDelta} score)` : ''}.`);
  const uncertain = [
    ...asArray(memory.openQuestions)
      .filter((question) => parsedQuery.scenarioIds.length === 0 || parsedQuery.scenarioIds.includes(question.scenarioId))
      .slice(0, 4)
      .map((question) => question.question),
    ...blockers.map((blocker) => blocker.scenarioId ? `${blocker.scenarioId} setup blocker: ${blocker.key || blocker.field}.` : `Setup blocker: ${blocker.field}.`),
  ];
  const recommendation = asArray(memory.recommendations).find((item) => (
    parsedQuery.scenarioIds.length === 0 || String(item.command || item.reason || '').includes(parsedQuery.scenarioIds[0])
  )) || memory.recommendations?.[0] || null;
  const answer = [
    `What we know: ${sentenceList(known)}`,
    `What changed: ${sentenceList(changed, 'No accepted or rejected experiment directly matched this query.')}`,
    `What is still uncertain: ${sentenceList(uncertain, 'No explicit uncertainty matched this query.')}`,
    `Recommended next action: ${recommendation ? `${recommendation.title} (${recommendation.command}).` : 'Build memory after fresh scenario evidence.'}`,
  ].join('\n');
  return {
    query,
    parsedQuery,
    answer,
    confidence: matchedEvents.length >= 3 || scenarioHits.length > 0 || themeHits.length > 0 ? 'medium' : 'low',
    matchedEvents: matchedEvents.map(citationForEvent),
    citations: [...matchedEvents.map(citationForEvent), ...scenarioHits.flatMap((scenario) => asArray(scenario.citations))].slice(0, 10),
    recommendedNextAction: recommendation,
    unknowns: uncertain,
  };
}

export function memoryReportPaths() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    latest: latestMemoryPath,
    markdown: resolve(memoryReportRoot, 'latest-memory.md'),
    index: resolve(memoryReportRoot, 'index.json'),
    stamped: resolve(memoryReportRoot, `memory-${stamp}.json`),
    history: resolve(memoryReportRoot, 'history.json'),
    publicLatest: publicLatestMemoryPath,
  };
}

export function markdownForMemory(memory = {}) {
  const scenarioRows = asArray(memory.scenarios).map((scenario) => (
    `| ${scenario.scenarioId} | ${scenario.latestVerdict || 'unknown'} | ${scenario.latestScore ?? ''} | ${scenario.weakestMetric || ''} | ${scenario.currentRecommendation?.title || ''} |`
  )).join('\n') || '| none | | | | |';
  const findings = asArray(memory.findings).map((finding) => `- ${finding.severity}: ${finding.title} - ${finding.summary}`).join('\n') || '- No findings yet.';
  const limits = asArray(memory.setupLimits).map((limit) => `- ${limit.field}: ${limit.recommendation} (${limit.count} signal(s))`).join('\n') || '- No setup limits detected.';
  const recommendations = asArray(memory.recommendations).map((item) => `- ${item.priority}: ${item.title} - \`${item.command}\``).join('\n') || '- No recommendation generated.';
  return `# Playable Design Memory

Generated: ${memory.generatedAt}

Events: ${memory.eventCount || 0}

Scenarios: ${memory.scenarioCount || 0}

## Source Counts

${Object.entries(memory.sourceCounts || {}).map(([key, count]) => `- ${key}: ${count}`).join('\n') || '- none'}

## Findings

${findings}

## Scenarios

| Scenario | Verdict | Score | Weakest | Next |
| --- | --- | ---: | --- | --- |
${scenarioRows}

## Setup Limits

${limits}

## Recommendations

${recommendations}

## Query Examples

${asArray(memory.queryExamples).map((query) => `- \`npm run memory:query -- "${query}"\``).join('\n')}
`;
}

export function markdownForQuery(result = {}) {
  return `# Playable Design Memory Query

Query: ${result.query}

Confidence: ${result.confidence}

${result.answer}

## Citations

${asArray(result.citations).map((citation) => `- ${citation.sourcePath} (${citation.type}${citation.scenarioId ? ` / ${citation.scenarioId}` : ''})`).join('\n') || '- No citations.'}
`;
}

export function writeMemory(memory, { markdown = true } = {}) {
  const paths = memoryReportPaths();
  writeJson(paths.latest, memory);
  writeJson(paths.stamped, memory);
  writeJson(paths.publicLatest, memory);
  const index = {
    generatedAt: memory.generatedAt,
    memoryVersion: memory.memoryVersion,
    sourceCounts: memory.sourceCounts,
    scenarioCount: memory.scenarioCount,
    eventCount: memory.eventCount,
    findings: asArray(memory.findings).slice(0, 10),
    recommendations: asArray(memory.recommendations).slice(0, 10),
  };
  writeJson(paths.index, index);
  const history = readJson(paths.history, []);
  writeJson(paths.history, [index, ...(Array.isArray(history) ? history : [])].slice(0, 100));
  if (markdown) {
    mkdirSync(dirname(paths.markdown), { recursive: true });
    writeFileSync(paths.markdown, markdownForMemory(memory));
  }
  return paths;
}

export function readLatestMemory({ includeRaw = false } = {}) {
  const memory = readJson(latestMemoryPath, null);
  if (!memory) return null;
  if (includeRaw && !asArray(memory.events).length) return buildMemory({ includeRaw: true });
  return memory;
}

export function memoryDoctor(memory = null, { staleDays = 14 } = {}) {
  const report = memory || buildMemory({ includeRaw: true, staleDays });
  const findings = [];
  for (const [type, expected] of Object.entries({
    scenarioDefinition: 'Scenario definitions',
    simulatorReport: 'Simulator reports',
    oracleReport: 'Oracle reports',
    autopilotReport: 'Autopilot reports',
  })) {
    if (!report.sourceCounts?.[type]) {
      findings.push({ severity: expected === 'Autopilot reports' ? 'info' : 'warning', type: 'missing-source', message: `${expected} are missing from memory.` });
    }
  }
  for (const question of asArray(report.openQuestions).slice(0, 20)) {
    const severity = question.type === 'setup-blocked' || question.type === 'missing-oracle' ? 'warning' : 'info';
    findings.push({ severity, type: question.type, scenarioId: question.scenarioId, message: question.question, command: question.command });
  }
  for (const limit of asArray(report.setupLimits).slice(0, 10)) {
    findings.push({ severity: limit.score >= 3 ? 'warning' : 'info', type: 'setup-limit', field: limit.field, message: limit.recommendation });
  }
  return {
    generatedAt: nowIso(),
    ok: !findings.some((finding) => finding.severity === 'error'),
    warningCount: findings.filter((finding) => finding.severity === 'warning').length,
    infoCount: findings.filter((finding) => finding.severity === 'info').length,
    findings,
  };
}

export function memoryForScenario(memory = {}, scenarioId = '') {
  const id = slugify(scenarioId);
  return asArray(memory.scenarios).find((scenario) => scenario.scenarioId === id) || null;
}
