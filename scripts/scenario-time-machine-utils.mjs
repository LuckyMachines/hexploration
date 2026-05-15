import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import {
  answerMemoryQuery,
  buildMemory,
  citationForEvent,
  latestMemoryPath,
  markdownForQuery,
  readLatestMemory,
} from './playable-design-memory-utils.mjs';
import {
  loadScenarioStore,
  readJson,
  root,
  slugify,
  writeJson,
} from './scenario-utils.mjs';

export const TIME_MACHINE_VERSION = '1.0.0';
export const timeMachineReportRoot = resolve(root, 'reports', 'simulator', 'time-machine');
export const publicTimeMachineRoot = resolve(root, 'app', 'public', 'simulator', 'time-machine');

const GOOD_VERDICTS = new Set(['strong-pass', 'pass', 'healthy', 'target-met', 'improved', 'answered']);
const BAD_VERDICTS = new Set(['fail', 'blocked', 'rejected-regression']);

function nowIso() {
  return new Date().toISOString();
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

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function timestamp(value) {
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleForEvent(event = {}) {
  return event.title || event.summary || event.type || 'timeline event';
}

export function loadTimeMachineMemory({ refreshMemory = false, includeRaw = true } = {}) {
  if (!refreshMemory && existsSync(latestMemoryPath)) {
    const latest = readLatestMemory({ includeRaw });
    if (latest?.events?.length) return latest;
  }
  return buildMemory({ includeRaw: true });
}

export function setupFidelityFromEvent(event = {}) {
  const metrics = event.metrics || {};
  const level = String(metrics.setupLevel || '').toLowerCase();
  let score = level === 'exact' ? 1 : level === 'partial' ? 0.72 : level === 'metadata' ? 0.38 : level === 'blocked' ? 0.08 : 0.5;
  score -= Math.min(0.35, number(metrics.failed) * 0.12);
  score -= Math.min(0.25, number(metrics.skipped) * 0.04);
  score -= Math.min(0.2, asArray(event.evidence?.setupSupportNeeded).length * 0.08);
  score -= Math.min(0.2, asArray(event.evidence?.failed).length * 0.08);
  return Math.max(0, Math.min(1, score));
}

export function timelinePointFromEvent(event = {}) {
  const metrics = event.metrics || {};
  const evidence = event.evidence || {};
  const setupFidelity = event.type === 'setupReport' || metrics.setupLevel || evidence.setupSupportNeeded
    ? setupFidelityFromEvent(event)
    : undefined;
  const point = compact({
    id: event.id,
    scenarioId: event.scenarioId,
    generatedAt: event.generatedAt,
    sourceType: event.type,
    sourcePath: event.sourcePath,
    title: titleForEvent(event),
    summary: event.summary,
    simulator: event.type === 'simulatorReport' ? compact({
      lifeScore: metrics.lifeScore,
      flatTurnRate: metrics.flatTurnRate,
      aliveTurnRate: metrics.aliveTurnRate,
      invalidAttempts: metrics.invalidAttempts,
      zeroStatPlayers: metrics.zeroStatPlayers,
      artifacts: metrics.artifacts,
      revealedZones: metrics.revealedZones,
      targetPassRate: metrics.targetPassRate,
      topIssue: evidence.topIssue?.label || evidence.topIssue?.key,
    }) : undefined,
    oracle: event.type === 'oracleReport' ? compact({
      weightedScore: metrics.weightedScore,
      confidence: metrics.confidence,
      verdict: evidence.verdict,
      weakestMetric: metrics.weakestMetric,
      weakestScore: metrics.weakestScore,
      strongestMetric: metrics.strongestMetric,
      strongestScore: metrics.strongestScore,
      gatePassed: metrics.gatePassed,
      gateFailures: asArray(evidence.gateFailures),
      smallestNextExperiment: evidence.smallestNextExperiment || null,
    }) : undefined,
    setup: event.type === 'setupReport' || setupFidelity !== undefined ? compact({
      level: metrics.setupLevel,
      applied: metrics.applied,
      skipped: metrics.skipped,
      failed: metrics.failed,
      blockedFields: unique([
        ...asArray(evidence.skipped).map((item) => item.field),
        ...asArray(evidence.failed).map((item) => item.field),
        ...asArray(evidence.setupSupportNeeded).map((item) => item.key),
      ]),
      fidelity: setupFidelity,
    }) : undefined,
    autopilot: event.type === 'autopilotReport' ? compact({
      mode: evidence.mode || event.metrics?.mode,
      finalVerdict: evidence.finalVerdict,
      selectedChange: evidence.selectedChange?.title,
      selectedChangeType: evidence.selectedChange?.changeType,
      baselineScore: metrics.baselineScore,
      finalScore: metrics.finalScore,
      scoreDelta: metrics.scoreDelta,
      lifeDelta: metrics.lifeDelta,
      flatDelta: metrics.flatDelta,
      accepted: metrics.accepted,
      rejectedReasons: asArray(evidence.rejectedReasons),
    }) : undefined,
    autoTune: event.type === 'autoTuneReport' ? compact({
      winner: evidence.winner?.name || evidence.winner?.id,
      winnerScore: metrics.winnerScore,
      candidates: metrics.candidates,
      rejected: metrics.rejected,
      recommendation: evidence.recommendation,
      dryRun: metrics.dryRun,
    }) : undefined,
    feeling: event.type === 'feelingReport' ? compact({
      arcScore: metrics.arcScore,
      arcShape: metrics.arcShape,
      firstAliveTurn: metrics.firstAliveTurn,
      firstFlatTurn: metrics.firstFlatTurn,
      bestMomentLabel: metrics.bestMomentLabel,
      worstMomentLabel: metrics.worstMomentLabel,
      strongestAgency: metrics.strongestAgency,
      strongestFriction: metrics.strongestFriction,
      recommendation: evidence.recommendation?.title,
      warnings: asArray(evidence.warnings),
    }) : undefined,
    tags: event.tags || [],
    systems: event.systems || [],
    citation: citationForEvent(event),
  });
  point.health = healthForPoint(point);
  return point;
}

export function healthForPoint(point = {}) {
  let score = 45;
  const reasons = [];
  if (point.oracle?.weightedScore !== undefined) {
    score = number(point.oracle.weightedScore);
    reasons.push(`Oracle score ${Math.round(score)}`);
  }
  if (point.autopilot?.finalScore !== undefined) {
    score = Math.max(score, number(point.autopilot.finalScore));
    reasons.push(`Autopilot final score ${Math.round(number(point.autopilot.finalScore))}`);
  }
  if (point.simulator?.lifeScore !== undefined) {
    score = score * 0.75 + number(point.simulator.lifeScore) * 0.25;
    reasons.push(`simulator life ${Math.round(number(point.simulator.lifeScore))}`);
  }
  if (point.feeling?.arcScore !== undefined) {
    score = score * 0.72 + number(point.feeling.arcScore) * 0.28;
    reasons.push(`feeling arc ${Math.round(number(point.feeling.arcScore))}`);
  }
  const confidence = point.oracle?.confidence ?? point.autopilot?.confidence;
  if (confidence !== undefined) {
    const confidencePenalty = (1 - number(confidence, 0.5)) * 14;
    score -= confidencePenalty;
    reasons.push(`confidence ${Math.round(number(confidence) * 100)}%`);
  }
  if (point.setup?.fidelity !== undefined) {
    const fidelity = number(point.setup.fidelity, 0.5);
    score = score * (0.72 + fidelity * 0.28);
    reasons.push(`setup fidelity ${Math.round(fidelity * 100)}%`);
  }
  score -= Math.min(12, number(point.simulator?.flatTurnRate) * 18);
  score -= Math.min(10, number(point.simulator?.invalidAttempts) * 1.5);
  score -= Math.min(10, number(point.simulator?.zeroStatPlayers) * 4);
  if (point.oracle?.gatePassed === false) {
    score -= 12;
    reasons.push('Oracle gate failed');
  }
  if (point.autopilot?.accepted === false) {
    score -= 14;
    reasons.push('Autopilot rejected regression');
  }
  if (BAD_VERDICTS.has(point.oracle?.verdict) || BAD_VERDICTS.has(point.autopilot?.finalVerdict)) score -= 10;
  if (GOOD_VERDICTS.has(point.oracle?.verdict) || GOOD_VERDICTS.has(point.autopilot?.finalVerdict)) score += 4;
  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    reasons,
  };
}

export function dedupeTimelinePoints(points = []) {
  const byKey = new Map();
  for (const point of points) {
    const key = [point.sourceType, point.generatedAt, point.title, point.summary].join('|');
    const existing = byKey.get(key);
    if (!existing || point.health.score > existing.health.score) byKey.set(key, point);
  }
  return [...byKey.values()].sort((a, b) => timestamp(a.generatedAt) - timestamp(b.generatedAt) || a.sourceType.localeCompare(b.sourceType));
}

export function buildScenarioTimeline(memory = {}, scenarioId = '') {
  const id = slugify(scenarioId);
  const points = asArray(memory.events)
    .filter((event) => event.scenarioId === id || (event.type === 'scenarioDefinition' && event.scenarioId === id))
    .map(timelinePointFromEvent);
  return dedupeTimelinePoints(points);
}

export function comparePoints(current = null, baseline = null) {
  if (!current || !baseline) return null;
  return {
    currentId: current.id,
    baselineId: baseline.id,
    currentGeneratedAt: current.generatedAt,
    baselineGeneratedAt: baseline.generatedAt,
    delta: {
      health: current.health.score - baseline.health.score,
      oracleScore: number(current.oracle?.weightedScore, NaN) - number(baseline.oracle?.weightedScore, NaN),
      confidence: number(current.oracle?.confidence, NaN) - number(baseline.oracle?.confidence, NaN),
      setupFidelity: number(current.setup?.fidelity, NaN) - number(baseline.setup?.fidelity, NaN),
      lifeScore: number(current.simulator?.lifeScore, NaN) - number(baseline.simulator?.lifeScore, NaN),
      flatTurnRate: number(current.simulator?.flatTurnRate, NaN) - number(baseline.simulator?.flatTurnRate, NaN),
      feelingArcScore: number(current.feeling?.arcScore, NaN) - number(baseline.feeling?.arcScore, NaN),
    },
    summary: summarizeDelta(current, baseline),
    citations: [baseline.citation, current.citation].filter(Boolean),
  };
}

function formatDelta(value) {
  if (!Number.isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${Math.abs(value) < 1 ? value.toFixed(2) : value.toFixed(1)}`;
}

function summarizeDelta(current, baseline) {
  const comparison = compareBare(current, baseline);
  if (comparison.health > 8) return `Health improved ${formatDelta(comparison.health)} points.`;
  if (comparison.health < -8) return `Health regressed ${formatDelta(comparison.health)} points.`;
  if (Math.abs(comparison.health) <= 3) return 'Health is broadly stable.';
  return `Health moved ${formatDelta(comparison.health)} points.`;
}

function compareBare(current, baseline) {
  return { health: number(current?.health?.score) - number(baseline?.health?.score) };
}

export function adjacentComparisons(timeline = []) {
  const comparisons = [];
  for (let index = 1; index < timeline.length; index += 1) {
    comparisons.push(comparePoints(timeline[index], timeline[index - 1]));
  }
  return comparisons.filter(Boolean);
}

export function bestKnownPoint(timeline = []) {
  return [...timeline]
    .filter((point) => number(point.setup?.fidelity, 0.65) >= 0.35)
    .sort((a, b) => b.health.score - a.health.score || timestamp(b.generatedAt) - timestamp(a.generatedAt))[0] || null;
}

export function lastGoodPoint(timeline = []) {
  return [...timeline].reverse().find((point) => (
    point.health.score >= 65
    || GOOD_VERDICTS.has(point.oracle?.verdict)
    || GOOD_VERDICTS.has(point.autopilot?.finalVerdict)
    || point.autopilot?.accepted === true
  )) || null;
}

export function timelineTrend(timeline = []) {
  if (timeline.length < 2) return 'insufficient-evidence';
  const latest = timeline[timeline.length - 1];
  if (latest.oracle?.gatePassed === false || number(latest.setup?.fidelity, 1) < 0.25) return 'blocked';
  const previous = timeline[timeline.length - 2];
  const first = timeline[0];
  const best = bestKnownPoint(timeline);
  const delta = latest.health.score - previous.health.score;
  if (best?.id === latest.id && latest.health.score - first.health.score >= 8) return 'improving';
  if (delta >= 8) return 'improving';
  if (delta <= -8) return 'regressing';
  const comparisons = adjacentComparisons(timeline).slice(-4).map((item) => item.delta.health).filter(Number.isFinite);
  if (comparisons.some((value) => value > 8) && comparisons.some((value) => value < -8)) return 'noisy';
  return 'stable';
}

export function biggestMovement(comparisons = [], direction = 'improvement') {
  const sorted = [...comparisons].filter((item) => Number.isFinite(item.delta.health));
  if (direction === 'regression') return sorted.filter((item) => item.delta.health < -3).sort((a, b) => a.delta.health - b.delta.health)[0] || null;
  return sorted.filter((item) => item.delta.health > 3).sort((a, b) => b.delta.health - a.delta.health)[0] || null;
}

export function inferCauses(timeline = [], comparison = null) {
  if (!comparison) return [];
  const start = timestamp(comparison.baselineGeneratedAt);
  const end = timestamp(comparison.currentGeneratedAt);
  const windowMs = 60 * 60 * 1000;
  return timeline
    .filter((point) => {
      const time = timestamp(point.generatedAt);
      return time >= start - windowMs && time <= end + windowMs && ['autopilotReport', 'autoTuneReport', 'setupReport', 'oracleReport'].includes(point.sourceType);
    })
    .map((point) => compact({
      inference: true,
      sourceType: point.sourceType,
      title: point.title,
      generatedAt: point.generatedAt,
      why: causeReason(point, comparison),
      citation: point.citation,
    }))
    .slice(0, 6);
}

function causeReason(point, comparison) {
  if (point.sourceType === 'autopilotReport') {
    if (point.autopilot?.accepted === true) return 'Nearby accepted Autopilot comparison may explain improvement.';
    if (point.autopilot?.accepted === false) return 'Nearby rejected Autopilot comparison may explain regression or blocked progress.';
    return 'Nearby Autopilot plan changed the scenario evidence path.';
  }
  if (point.sourceType === 'setupReport') return 'Setup fidelity changed near this movement.';
  if (point.sourceType === 'autoTuneReport') return 'Auto-tune evidence occurred near this movement.';
  if (point.sourceType === 'oracleReport') return comparison.delta.health < 0 ? 'Oracle evidence detected weaker health near this movement.' : 'Oracle evidence detected stronger health near this movement.';
  return 'Nearby evidence may explain the movement.';
}

export function recommendationForTimeline({ scenarioId, timeline = [], trend = 'insufficient-evidence', memory = null } = {}) {
  const latest = timeline[timeline.length - 1] || null;
  if (!latest) {
    return {
      priority: 'high',
      type: 'evidence',
      title: `Capture first exact-engine evidence for ${scenarioId}`,
      command: `npm run scenario:run -- --id=${scenarioId} && npm run oracle:scenario -- --id=${scenarioId}`,
      reason: 'Time Machine has no timeline points for this scenario.',
    };
  }
  if (number(latest.setup?.fidelity, 1) < 0.4 || asArray(latest.setup?.blockedFields).length > 0) {
    return {
      priority: 'high',
      type: 'setup',
      title: `Repair setup fidelity for ${scenarioId}`,
      command: 'npm run setup:doctor',
      reason: `Blocked setup fields: ${asArray(latest.setup?.blockedFields).join(', ') || 'setup fidelity below threshold'}.`,
      citations: [latest.citation].filter(Boolean),
    };
  }
  if (!timeline.some((point) => point.sourceType === 'simulatorReport') || !timeline.some((point) => point.sourceType === 'oracleReport')) {
    return {
      priority: 'high',
      type: 'evidence',
      title: `Capture simulator and Oracle pair for ${scenarioId}`,
      command: `npm run scenario:run -- --id=${scenarioId} && npm run oracle:scenario -- --id=${scenarioId}`,
      reason: 'A full then-vs-now comparison needs both simulator and Oracle evidence.',
      citations: [latest.citation].filter(Boolean),
    };
  }
  if (trend === 'regressing') {
    return {
      priority: 'high',
      type: 'revisit',
      title: `Compare ${scenarioId} against last good evidence`,
      command: `npm run time-machine:compare -- --id=${scenarioId} --against=last-good --markdown`,
      reason: 'Latest health regressed from the previous timeline point.',
      citations: [latest.citation].filter(Boolean),
    };
  }
  const latestFeeling = latest.feeling || [...timeline].reverse().find((point) => point.feeling)?.feeling;
  const latestFeelingCitation = latest.feeling ? latest.citation : [...timeline].reverse().find((point) => point.feeling)?.citation;
  if (latestFeeling && number(latestFeeling.arcScore, 100) < 55) {
    return {
      priority: 'medium',
      type: 'feeling',
      title: `Improve the felt control arc for ${scenarioId}`,
      command: `npm run feel:scenario -- --id=${scenarioId} --markdown`,
      reason: `Latest feeling arc is ${latestFeeling.arcShape || 'unknown'} at score ${latestFeeling.arcScore}.`,
      citations: [latestFeelingCitation].filter(Boolean),
    };
  }
  const weak = latest.oracle?.weakestMetric || timeline.findLast?.((point) => point.oracle?.weakestMetric)?.oracle?.weakestMetric;
  if (weak) {
    return {
      priority: 'medium',
      type: 'iteration',
      title: `Run Autopilot against ${weak} for ${scenarioId}`,
      command: `npm run autopilot:scenario -- --id=${scenarioId} --mode=single-pass`,
      reason: `Latest known weak dimension is ${weak}.`,
      citations: [latest.citation].filter(Boolean),
    };
  }
  const query = memory ? answerMemoryQuery(memory, `what should we try next for ${scenarioId}?`, { limit: 4 }) : null;
  return {
    priority: 'medium',
    type: 'memory',
    title: query?.recommendedNextAction?.title || `Refresh evidence for ${scenarioId}`,
    command: query?.recommendedNextAction?.command || `npm run memory:query -- "what should we try next for ${scenarioId}?"`,
    reason: query?.recommendedNextAction?.reason || 'No sharper Time Machine recommendation was available.',
  };
}

export function selectComparisonPoint(timeline = [], against = 'previous') {
  if (timeline.length === 0) return null;
  const latest = timeline[timeline.length - 1];
  if (against === 'latest') return latest;
  if (against === 'previous') return timeline[timeline.length - 2] || null;
  if (against === 'first') return timeline[0] || null;
  if (against === 'best') return bestKnownPoint(timeline);
  if (against === 'last-good') return lastGoodPoint(timeline);
  return timeline.find((point) => point.id === against) || null;
}

export function buildScenarioTimeMachine({ scenarioId, memory = null, refreshMemory = false, includeRaw = false, staleDays = 14 } = {}) {
  if (!scenarioId) throw new Error('scenarioId is required.');
  const loadedMemory = memory || loadTimeMachineMemory({ refreshMemory, includeRaw: true });
  const id = slugify(scenarioId);
  const scenario = asArray(loadedMemory.scenarios).find((item) => item.scenarioId === id)
    || asArray(loadScenarioStore().scenarios).find((item) => item.id === id)
    || { scenarioId: id, name: id };
  const timeline = buildScenarioTimeline(loadedMemory, id);
  const comparisons = adjacentComparisons(timeline);
  const latest = timeline[timeline.length - 1] || null;
  const first = timeline[0] || null;
  const previous = timeline[timeline.length - 2] || null;
  const best = bestKnownPoint(timeline);
  const lastGood = lastGoodPoint(timeline);
  const biggestImprovement = biggestMovement(comparisons, 'improvement');
  const biggestRegression = biggestMovement(comparisons, 'regression');
  const trend = timelineTrend(timeline);
  const stale = latest ? Date.now() - timestamp(latest.generatedAt) > staleDays * 24 * 60 * 60 * 1000 : true;
  const recommendation = recommendationForTimeline({ scenarioId: id, timeline, trend, memory: loadedMemory });
  const report = compact({
    schemaVersion: 1,
    timeMachineVersion: TIME_MACHINE_VERSION,
    generatedAt: nowIso(),
    scenarioId: id,
    name: scenario.name || scenario.scenarioId || id,
    designQuestion: scenario.designQuestion,
    trend,
    stale,
    timelineCount: timeline.length,
    latest,
    first,
    previous,
    bestKnown: best,
    lastGood,
    comparisons: {
      latestVsPrevious: comparePoints(latest, previous),
      latestVsFirst: comparePoints(latest, first),
      latestVsBest: best && latest?.id !== best.id ? comparePoints(latest, best) : null,
      latestVsLastGood: lastGood && latest?.id !== lastGood.id ? comparePoints(latest, lastGood) : null,
    },
    biggestImprovement,
    biggestRegression,
    inferredCauses: inferCauses(timeline, biggestRegression || biggestImprovement),
    summaries: summarizeTimeline(timeline, comparisons),
    recommendation,
    memoryQuery: loadedMemory ? answerMemoryQuery(loadedMemory, `what should we try next for ${id}?`, { limit: 4 }) : null,
    citations: timeline.map((point) => point.citation).filter(Boolean).slice(-20).reverse(),
    timeline: includeRaw ? timeline : timeline.map(publicTimelinePoint),
  });
  return report;
}

function publicTimelinePoint(point) {
  return compact({
    id: point.id,
    scenarioId: point.scenarioId,
    generatedAt: point.generatedAt,
    sourceType: point.sourceType,
    title: point.title,
    summary: point.summary,
    health: point.health,
    oracle: point.oracle,
    simulator: point.simulator,
    setup: point.setup,
    autopilot: point.autopilot,
    autoTune: point.autoTune,
    feeling: point.feeling,
    citation: point.citation,
  });
}

function summarizeTimeline(timeline = [], comparisons = []) {
  const latest = timeline[timeline.length - 1];
  const better = comparisons.filter((item) => item.delta.health > 3).map((item) => item.summary);
  const worse = comparisons.filter((item) => item.delta.health < -3).map((item) => item.summary);
  const blocked = timeline
    .filter((point) => number(point.setup?.fidelity, 1) < 0.4 || point.oracle?.gatePassed === false)
    .map((point) => `${point.generatedAt}: ${point.title}`)
    .slice(-5);
  return {
    whatChanged: comparisons.slice(-5).map((item) => item.summary),
    whatGotBetter: better.slice(-5),
    whatGotWorse: worse.slice(-5),
    whatStayedBlocked: blocked,
    currentState: latest ? `${latest.title}: health ${latest.health.score}` : 'No timeline evidence yet.',
  };
}

export function buildTimeMachineIndex({ memory = null, refreshMemory = false } = {}) {
  const loadedMemory = memory || loadTimeMachineMemory({ refreshMemory, includeRaw: true });
  const scenarioIds = unique([
    ...asArray(loadedMemory.scenarios).map((scenario) => scenario.scenarioId),
    ...asArray(loadedMemory.events).map((event) => event.scenarioId),
  ]);
  const scenarios = scenarioIds.map((scenarioId) => {
    const report = buildScenarioTimeMachine({ scenarioId, memory: loadedMemory });
    return compact({
      scenarioId,
      name: report.name,
      trend: report.trend,
      timelineCount: report.timelineCount,
      latestHealth: report.latest?.health?.score,
      latestGeneratedAt: report.latest?.generatedAt,
      bestHealth: report.bestKnown?.health?.score,
      lastGoodGeneratedAt: report.lastGood?.generatedAt,
      recommendation: report.recommendation,
    });
  }).sort((a, b) => String(a.scenarioId).localeCompare(String(b.scenarioId)));
  return {
    schemaVersion: 1,
    timeMachineVersion: TIME_MACHINE_VERSION,
    generatedAt: nowIso(),
    scenarioCount: scenarios.length,
    scenarios,
  };
}

export function timeMachineReportPaths(scenarioId = null) {
  if (!scenarioId) {
    return {
      index: resolve(timeMachineReportRoot, 'index.json'),
      publicIndex: resolve(publicTimeMachineRoot, 'index.json'),
    };
  }
  const id = slugify(scenarioId);
  return {
    dir: resolve(timeMachineReportRoot, id),
    latest: resolve(timeMachineReportRoot, id, 'latest-report.json'),
    markdown: resolve(timeMachineReportRoot, id, 'latest-report.md'),
    publicLatest: resolve(publicTimeMachineRoot, id, 'latest-report.json'),
  };
}

export function writeScenarioTimeMachine(report, { markdown = true } = {}) {
  const paths = timeMachineReportPaths(report.scenarioId);
  writeJson(paths.latest, report);
  writeJson(paths.publicLatest, report);
  if (markdown) {
    mkdirSync(dirname(paths.markdown), { recursive: true });
    writeFileSync(paths.markdown, markdownForTimeMachine(report));
  }
  return paths;
}

export function writeTimeMachineIndex(index) {
  const paths = timeMachineReportPaths();
  writeJson(paths.index, index);
  writeJson(paths.publicIndex, index);
  return paths;
}

export function markdownForTimeMachine(report = {}) {
  const timelineRows = asArray(report.timeline).map((point) => (
    `| ${point.generatedAt} | ${point.sourceType} | ${point.health?.score ?? ''} | ${point.title || ''} |`
  )).join('\n') || '| none | | | |';
  const causes = asArray(report.inferredCauses).map((cause) => `- inferred from ${cause.sourceType}: ${cause.title} - ${cause.why}`).join('\n') || '- No inferred cause available.';
  const citations = asArray(report.citations).map((citation) => `- ${citation.sourcePath} (${citation.type}${citation.scenarioId ? ` / ${citation.scenarioId}` : ''})`).join('\n') || '- No citations.';
  return `# Scenario Time Machine

Generated: ${report.generatedAt}

Scenario: ${report.scenarioId}

Trend: ${report.trend}

Timeline points: ${report.timelineCount}

Latest health: ${report.latest?.health?.score ?? 'n/a'}

Best known health: ${report.bestKnown?.health?.score ?? 'n/a'}

Last good: ${report.lastGood?.generatedAt || 'none'}

## Current State

${report.summaries?.currentState || 'No current state.'}

## Biggest Improvement

${report.biggestImprovement?.summary || 'No improvement detected.'}

## Biggest Regression

${report.biggestRegression?.summary || 'No regression detected.'}

## Inferred Causes

${causes}

## Recommendation

${report.recommendation?.title || 'No recommendation generated.'}

\`${report.recommendation?.command || 'npm run time-machine:doctor'}\`

## Timeline

| Generated | Source | Health | Title |
| --- | --- | ---: | --- |
${timelineRows}

## Memory Query

${report.memoryQuery ? markdownForQuery(report.memoryQuery) : 'No memory query attached.'}

## Citations

${citations}
`;
}

export function compareScenarioTimeMachine({ scenarioId, against = 'previous', memory = null, refreshMemory = false } = {}) {
  const report = buildScenarioTimeMachine({ scenarioId, memory, refreshMemory, includeRaw: true });
  const latest = report.timeline[report.timeline.length - 1] || null;
  const baseline = selectComparisonPoint(report.timeline, against);
  const comparison = comparePoints(latest, baseline);
  return {
    schemaVersion: 1,
    generatedAt: nowIso(),
    scenarioId: report.scenarioId,
    against,
    trend: report.trend,
    comparison,
    inferredCauses: inferCauses(report.timeline, comparison),
    recommendation: report.recommendation,
  };
}

export function timeMachineDoctor({ memory = null, staleDays = 14, refreshMemory = false } = {}) {
  const loadedMemory = memory || loadTimeMachineMemory({ refreshMemory, includeRaw: true });
  const index = buildTimeMachineIndex({ memory: loadedMemory });
  const findings = [];
  if (!existsSync(latestMemoryPath)) findings.push({ severity: 'warning', type: 'missing-memory', message: 'No latest Playable Design Memory snapshot exists.' });
  for (const scenario of index.scenarios) {
    const report = buildScenarioTimeMachine({ scenarioId: scenario.scenarioId, memory: loadedMemory });
    if (!report.timeline.some((point) => point.sourceType === 'simulatorReport')) {
      findings.push({ severity: 'info', type: 'missing-simulator', scenarioId: scenario.scenarioId, message: `No simulator timeline point for ${scenario.scenarioId}.`, command: `npm run scenario:run -- --id=${scenario.scenarioId}` });
    }
    if (!report.timeline.some((point) => point.sourceType === 'oracleReport')) {
      findings.push({ severity: 'warning', type: 'missing-oracle', scenarioId: scenario.scenarioId, message: `No Oracle timeline point for ${scenario.scenarioId}.`, command: `npm run oracle:scenario -- --id=${scenario.scenarioId}` });
    }
    if (report.stale) {
      findings.push({ severity: 'info', type: 'stale', scenarioId: scenario.scenarioId, message: `${scenario.scenarioId} latest timeline point is older than ${staleDays} days.` });
    }
    if (number(report.latest?.setup?.fidelity, 1) < 0.4) {
      findings.push({ severity: 'warning', type: 'setup-fidelity', scenarioId: scenario.scenarioId, message: `${scenario.scenarioId} setup fidelity is below threshold.`, command: 'npm run setup:doctor' });
    }
    if (report.trend === 'regressing') {
      findings.push({ severity: 'warning', type: 'latest-regression', scenarioId: scenario.scenarioId, message: `${scenario.scenarioId} latest point regressed from previous evidence.`, command: `npm run time-machine:compare -- --id=${scenario.scenarioId} --against=last-good --markdown` });
    }
    const dryRunOnly = report.timeline.some((point) => point.autopilot?.finalVerdict === 'planned') && !report.timeline.some((point) => point.sourceType === 'simulatorReport');
    if (dryRunOnly) {
      findings.push({ severity: 'info', type: 'dry-run-only', scenarioId: scenario.scenarioId, message: `${scenario.scenarioId} has Autopilot planning without later simulator evidence.` });
    }
    if (report.bestKnown?.id && report.latest?.id && report.bestKnown.id !== report.latest.id && report.bestKnown.health.score > report.latest.health.score + 8) {
      findings.push({ severity: 'warning', type: 'best-older-than-latest', scenarioId: scenario.scenarioId, message: `${scenario.scenarioId} best known version is older than latest evidence.` });
    }
  }
  return {
    generatedAt: nowIso(),
    ok: !findings.some((finding) => finding.severity === 'error'),
    warningCount: findings.filter((finding) => finding.severity === 'warning').length,
    infoCount: findings.filter((finding) => finding.severity === 'info').length,
    findings,
  };
}
