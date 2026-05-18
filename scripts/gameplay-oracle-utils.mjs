import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
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

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ORACLE_VERSION = '1.0.0';
export const oracleReportRoot = resolve(root, 'reports', 'simulator', 'oracle');
export const publicOracleRoot = resolve(root, 'app', 'public', 'simulator', 'oracle');
export const oracleSummaryIndexPath = resolve(oracleReportRoot, 'summary-index.json');
export const publicOracleSummaryIndexPath = resolve(publicOracleRoot, 'summary-index.json');
export const latestSimulatorReportPath = resolve(root, 'reports', 'simulator', 'latest-report.json');

export const ORACLE_DIMENSIONS = [
  'agency',
  'readability',
  'tension',
  'surprise',
  'recovery',
  'systemIntegration',
  'replayability',
  'pacing',
  'emotionalTexture',
  'outcomeLegibility',
];

export const DEFAULT_ORACLE_WEIGHTS = {
  agency: 1.25,
  readability: 1.25,
  tension: 1.1,
  surprise: 0.85,
  recovery: 0.85,
  systemIntegration: 1.2,
  replayability: 0.9,
  pacing: 1.1,
  emotionalTexture: 0.85,
  outcomeLegibility: 1.2,
};

export const DEFAULT_ORACLE_GATES = {
  minimumWeightedScore: 60,
  minimumAgency: 50,
  minimumReadability: 55,
  maximumRegression: 8,
  failOnBlocked: true,
};

export const SCENARIO_ORACLE_GOALS = {
  artifact: {
    weights: { agency: 1.35, surprise: 1.25, systemIntegration: 1.2, outcomeLegibility: 1.2 },
    minimums: { agency: 55, surprise: 45, outcomeLegibility: 55 },
  },
  escape: {
    weights: { tension: 1.35, readability: 1.3, outcomeLegibility: 1.3, pacing: 1.15 },
    minimums: { tension: 50, readability: 55, outcomeLegibility: 55 },
  },
  cooperation: {
    weights: { recovery: 1.35, systemIntegration: 1.35, agency: 1.2 },
    minimums: { recovery: 45, systemIntegration: 50 },
  },
  exploration: {
    weights: { agency: 1.25, surprise: 1.1, pacing: 1.2 },
    minimums: { agency: 50, pacing: 50 },
  },
  survival: {
    weights: { tension: 1.25, recovery: 1.15, readability: 1.15 },
    minimums: { tension: 45, readability: 50 },
  },
};

function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function average(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length > 0 ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function max(values) {
  const numbers = values.map(Number).filter(Number.isFinite);
  return numbers.length > 0 ? Math.max(...numbers) : 0;
}

function ratio(count, total) {
  return total > 0 ? Number(count || 0) / total : 0;
}

function scoreFromIdeal(value, ideal, tolerance) {
  return clamp(100 - Math.abs(Number(value || 0) - ideal) * (100 / tolerance));
}

function scoreHigh(value, goodAt, zeroAt = 0) {
  if (goodAt === zeroAt) return Number(value) >= goodAt ? 100 : 0;
  return clamp(((Number(value || 0) - zeroAt) / (goodAt - zeroAt)) * 100);
}

function scoreLow(value, badAt, goodAt = 0) {
  if (badAt === goodAt) return Number(value) <= goodAt ? 100 : 0;
  return clamp(100 - ((Number(value || 0) - goodAt) / (badAt - goodAt)) * 100);
}

function sortedEntries(object) {
  return Object.entries(object || {}).sort(([a], [b]) => a.localeCompare(b));
}

function totalActions(report) {
  return Object.values(report.aggregate?.actionTotals || {}).reduce((sum, count) => sum + Number(count || 0), 0);
}

function actionShare(report, action) {
  return ratio(report.aggregate?.actionTotals?.[action] || 0, totalActions(report));
}

function allTurns(report) {
  return (report.runs || []).flatMap((run, runIndex) => (
    (run.turns || []).map((turn) => ({
      ...turn,
      runIndex,
      strategy: run.config?.strategy || report.config?.strategy || 'unknown',
      runLabel: run.config?.runLabel || `${run.config?.strategy || 'run'} ${runIndex + 1}`,
      runSummary: run.summary || {},
    }))
  ));
}

function allDebugTurns(report) {
  return (report.runs || []).flatMap((run, runIndex) => (
    (run.funDebugger?.turns || []).map((turn) => ({
      ...turn,
      runIndex,
      strategy: run.config?.strategy || report.config?.strategy || 'unknown',
    }))
  ));
}

function uniqueCount(values) {
  return new Set(values.filter((value) => value !== undefined && value !== null && value !== '')).size;
}

function turnStatTotal(snapshot) {
  return (snapshot?.players || []).reduce((sum, player) => (
    sum + Number(player.stats?.movement || 0) + Number(player.stats?.agility || 0) + Number(player.stats?.dexterity || 0)
  ), 0);
}

function turnArtifactCount(snapshot) {
  return (snapshot?.players || []).reduce((sum, player) => sum + (player.artifacts || []).length, 0);
}

function turnRevealedCount(snapshot) {
  return Number(snapshot?.activeZones?.count || 0);
}

function submittedActions(turn) {
  return (turn.submissions || []).map((submission) => submission.action).filter(Boolean);
}

function invalidAttemptsInTurn(turn) {
  return (turn.submissions || []).reduce((sum, submission) => (
    sum + (submission.validityLog || []).filter((entry) => entry.ok === false).length + (submission.error ? 1 : 0)
  ), 0);
}

function evidence(label, value, target, detail = '') {
  return { label, value, target, detail };
}

function scoreEvidence(metric, score, pieces) {
  return {
    metric,
    score: Math.round(score),
    evidence: pieces.filter(Boolean),
  };
}

export function normalizeReportForOracle(report = {}) {
  const normalized = {
    ...report,
    schemaVersion: Number(report.schemaVersion || 1),
    runs: Array.isArray(report.runs) && report.runs.length > 0 ? report.runs : [{
      config: report.config || {},
      turns: report.turns || [],
      summary: report.summary || {},
      funDebugger: report.funDebugger || null,
    }],
    aggregate: report.aggregate || { actionTotals: {}, actionShares: {}, averages: {}, strategies: {}, warnings: [] },
    funDebugger: report.funDebugger || {},
    summary: report.summary || {},
    config: report.config || {},
  };
  return normalized;
}

export function scenarioOracleGoals(scenario = {}) {
  const normalized = scenario.id ? normalizeScenario(scenario) : scenario;
  const tags = normalized.tags || [];
  const weights = { ...DEFAULT_ORACLE_WEIGHTS };
  const minimums = {};
  for (const tag of tags) {
    const goal = SCENARIO_ORACLE_GOALS[tag];
    if (!goal) continue;
    Object.assign(weights, Object.fromEntries(Object.entries(goal.weights || {}).map(([key, value]) => [key, Math.max(weights[key] || 1, value)])));
    Object.assign(minimums, goal.minimums || {});
  }
  return {
    weights: { ...weights, ...(normalized.oracleGoals?.weights || {}) },
    minimums: { ...minimums, ...(normalized.oracleGoals?.minimums || {}) },
    requiredTags: tags,
  };
}

export function scoreAgency(report) {
  const aggregate = report.aggregate || {};
  const avgChoice = Number(aggregate.averages?.meaningfulChoiceDensity || 0);
  const idleShare = actionShare(report, 'Idle');
  const restShare = actionShare(report, 'Rest');
  const actionVariety = uniqueCount(Object.keys(aggregate.actionTotals || {}));
  const repeatedFlat = report.funDebugger?.flatTurnRate || 0;
  const score = average([
    scoreHigh(avgChoice, 0.65, 0.15),
    scoreLow(idleShare, 0.35, 0.03),
    scoreLow(restShare, 0.55, 0.08),
    scoreHigh(actionVariety, 5, 1),
    scoreLow(repeatedFlat, 0.55, 0.05),
  ]);
  return scoreEvidence('agency', score, [
    evidence('Meaningful choice density', avgChoice, '>= 0.65'),
    evidence('Idle action share', idleShare, '<= 0.03 ideal'),
    evidence('Rest action share', restShare, '<= 0.08 ideal'),
    evidence('Action variety', actionVariety, '5+ distinct actions'),
    evidence('Flat turn rate pressure', repeatedFlat, '<= 0.05 ideal'),
  ]);
}

export function scoreReadability(report) {
  const averages = report.aggregate?.averages || {};
  const turns = allTurns(report);
  const skippedShare = ratio(turns.filter((turn) => turn.skipped).length, turns.length);
  const invalid = Number(averages.invalidAttempts || 0);
  const noDeltaTurns = turns.filter((turn) => {
    const statDelta = Math.abs(turnStatTotal(turn.after) - turnStatTotal(turn.before));
    const revealDelta = Math.abs(turnRevealedCount(turn.after) - turnRevealedCount(turn.before));
    const artifactDelta = Math.abs(turnArtifactCount(turn.after) - turnArtifactCount(turn.before));
    return !turn.skipped && statDelta === 0 && revealDelta === 0 && artifactDelta === 0 && submittedActions(turn).length > 0;
  });
  const noDeltaShare = ratio(noDeltaTurns.length, turns.length);
  const warningPenalty = Math.min(30, (report.aggregate?.warnings || []).length * 8);
  const score = clamp(average([
    scoreLow(invalid, 5, 0),
    scoreLow(skippedShare, 0.35, 0),
    scoreLow(noDeltaShare, 0.5, 0.05),
    scoreLow(warningPenalty, 30, 0),
  ]));
  return scoreEvidence('readability', score, [
    evidence('Average invalid attempts', invalid, '<= 0 ideal'),
    evidence('Skipped turn share', skippedShare, '0 ideal'),
    evidence('No-delta turn share', noDeltaShare, '<= 0.05 ideal'),
    evidence('Aggregate warning penalty', warningPenalty, '0 ideal'),
  ]);
}

export function scoreTension(report) {
  const averages = report.aggregate?.averages || {};
  const tensionCurve = (report.runs || []).flatMap((run) => run.summary?.tensionCurve || []);
  const avgTension = average(tensionCurve.map((point) => point.tension));
  const peakTension = max(tensionCurve.map((point) => point.tension));
  const spikeTurns = Number(averages.spikeTurns || 0);
  const zeroStats = Number(averages.zeroStatPlayers || 0);
  const fleeShare = actionShare(report, 'Flee');
  const score = average([
    scoreFromIdeal(avgTension, 38, 42),
    scoreHigh(peakTension, 55, 10),
    scoreFromIdeal(spikeTurns, 1.25, 2.5),
    scoreLow(zeroStats, 2, 0),
    scoreHigh(fleeShare, 0.08, 0),
  ]);
  return scoreEvidence('tension', score, [
    evidence('Average tension', avgTension, 'around 38'),
    evidence('Peak tension', peakTension, '>= 55'),
    evidence('Average spike turns', spikeTurns, 'around 1.25'),
    evidence('Zero-stat pressure', zeroStats, '<= 0 ideal'),
    evidence('Flee action share', fleeShare, '>= 0.08 for escape pressure'),
  ]);
}

export function scoreSurprise(report) {
  const averages = report.aggregate?.averages || {};
  const cardVariety = uniqueCount((report.runs || []).flatMap((run) => Object.keys(run.summary?.cardOutcomes || {})));
  const reveal = Number(averages.revealedZones || 0);
  const artifacts = Number(averages.artifacts || 0);
  const spikeTurns = Number(averages.spikeTurns || 0);
  const score = average([
    scoreHigh(cardVariety, 4, 0),
    scoreHigh(reveal, 2, 0),
    scoreHigh(artifacts, 0.75, 0),
    scoreHigh(spikeTurns, 1.5, 0),
  ]);
  return scoreEvidence('surprise', score, [
    evidence('Card/event variety', cardVariety, '4+ distinct outcomes'),
    evidence('Average revealed zones', reveal, '>= 2'),
    evidence('Average artifacts', artifacts, '>= 0.75'),
    evidence('Average spike turns', spikeTurns, '>= 1.5'),
  ]);
}

export function scoreRecovery(report) {
  const averages = report.aggregate?.averages || {};
  const restShare = actionShare(report, 'Rest');
  const helpShare = actionShare(report, 'Help');
  const statDelta = Number(averages.statDelta || 0);
  const zeroStats = Number(averages.zeroStatPlayers || 0);
  const score = average([
    scoreFromIdeal(restShare, 0.16, 0.3),
    scoreHigh(helpShare, 0.06, 0),
    scoreHigh(statDelta, 4, -12),
    scoreLow(zeroStats, 2, 0),
  ]);
  return scoreEvidence('recovery', score, [
    evidence('Rest share', restShare, 'around 0.16'),
    evidence('Help share', helpShare, '>= 0.06 in shared pressure'),
    evidence('Average stat delta', statDelta, '>= 4'),
    evidence('Average zero-stat players', zeroStats, '<= 0 ideal'),
  ]);
}

export function scoreSystemIntegration(report, scenario = {}) {
  const totals = report.aggregate?.actionTotals || {};
  const systems = new Set((report.funDebugger?.systemicRisks || []).map((item) => item.key));
  for (const action of Object.keys(totals)) systems.add(action.toLowerCase());
  const averages = report.aggregate?.averages || {};
  if (Number(averages.revealedZones || 0) > 0) systems.add('board');
  if (Number(averages.artifacts || 0) > 0) systems.add('artifacts');
  if (Number(averages.statDelta || 0) !== 0) systems.add('stats');
  if (actionShare(report, 'Flee') > 0) systems.add('escape');
  if (actionShare(report, 'Help') > 0) systems.add('cooperation');
  const observed = systems.size;
  const tags = scenario.tags || [];
  const tagHits = tags.filter((tag) => systems.has(tag) || (tag === 'exploration' && systems.has('board')) || (tag === 'survival' && systems.has('stats'))).length;
  const score = average([
    scoreHigh(observed, 7, 1),
    tags.length > 0 ? scoreHigh(tagHits / tags.length, 0.75, 0) : 70,
  ]);
  return scoreEvidence('systemIntegration', score, [
    evidence('Observed systems', observed, '7+ systems'),
    evidence('Scenario tag hits', `${tagHits}/${tags.length}`, '>= 75% of tags'),
    evidence('Systems', [...systems].sort().join(', ') || 'none', 'broad interaction'),
  ]);
}

export function scoreReplayability(report) {
  const strategies = Object.keys(report.aggregate?.strategies || {});
  const runs = report.runs || [];
  const artifactSpread = max(runs.map((run) => run.summary?.totalArtifacts || 0)) - Math.min(...runs.map((run) => Number(run.summary?.totalArtifacts || 0)), 0);
  const revealSpread = max(runs.map((run) => run.summary?.revealedZonesGained || 0)) - Math.min(...runs.map((run) => Number(run.summary?.revealedZonesGained || 0)), 0);
  const actionVariety = uniqueCount(Object.keys(report.aggregate?.actionTotals || {}));
  const score = average([
    scoreHigh(strategies.length, 3, 1),
    scoreHigh(runs.length, 3, 1),
    scoreHigh(artifactSpread + revealSpread, 2, 0),
    scoreHigh(actionVariety, 5, 1),
  ]);
  return scoreEvidence('replayability', score, [
    evidence('Strategy count', strategies.length, '3+ strategies'),
    evidence('Run count', runs.length, '3+ runs'),
    evidence('Outcome spread', artifactSpread + revealSpread, '>= 2 combined artifact/reveal spread'),
    evidence('Action variety', actionVariety, '5+ distinct actions'),
  ]);
}

export function scorePacing(report) {
  const turns = allTurns(report);
  const debugTurns = allDebugTurns(report);
  const firstMeaningful = turns.find((turn) => {
    const analysis = turn.analysis || {};
    return analysis.revealedDelta > 0 || analysis.artifactDelta > 0 || analysis.spike || submittedActions(turn).some((action) => action !== 'Idle');
  });
  const flatStreak = max((report.runs || []).flatMap((run) => (run.funDebugger?.flatStreaks || []).map((streak) => streak.length || 0)));
  const averageLife = average(debugTurns.map((turn) => turn.lifeScore));
  const climaxTurn = [...turns].sort((a, b) => ((b.analysis?.funDebugger?.lifeScore || 0) - (a.analysis?.funDebugger?.lifeScore || 0)))[0]?.turn || 0;
  const expectedClimax = Math.max(1, Math.round((report.config?.turns || turns.length || 8) * 0.7));
  const score = average([
    scoreLow(firstMeaningful?.turn || 99, 6, 1),
    scoreLow(flatStreak, 5, 0),
    scoreFromIdeal(climaxTurn || expectedClimax, expectedClimax, Math.max(3, expectedClimax)),
    scoreHigh(averageLife, 55, 10),
  ]);
  return scoreEvidence('pacing', score, [
    evidence('First meaningful turn', firstMeaningful?.turn || null, '<= 2 ideal'),
    evidence('Longest flat streak', flatStreak, '0 ideal'),
    evidence('Climax turn', climaxTurn || null, `around ${expectedClimax}`),
    evidence('Average life score', averageLife, '>= 55'),
  ]);
}

export function classifyTurnExperience(turn) {
  if (turn.skipped) return 'confused';
  const analysis = turn.analysis || {};
  const actions = submittedActions(turn);
  if (invalidAttemptsInTurn(turn) > 0) return 'confused';
  if (analysis.artifactDelta > 0 || turnArtifactCount(turn.after) > turnArtifactCount(turn.before)) return 'triumphant';
  if (analysis.spike || analysis.zeroStats > 0) return 'dangerous';
  if ((actions.includes('Rest') || actions.includes('Help')) && turnStatTotal(turn.after) >= turnStatTotal(turn.before)) return 'recovery';
  if (analysis.revealedDelta > 0 || turnRevealedCount(turn.after) > turnRevealedCount(turn.before)) return 'curious';
  if ((analysis.statDelta || 0) < 0) return 'pressured';
  if ((analysis.meaningfulChoiceDensity || 0) <= 0.2 || actions.every((action) => action === 'Idle')) return 'flat';
  return 'quiet';
}

export function scoreEmotionalTexture(report) {
  const labels = allTurns(report).map(classifyTurnExperience);
  const counts = labels.reduce((bucket, label) => {
    bucket[label] = (bucket[label] || 0) + 1;
    return bucket;
  }, {});
  const activeLabels = uniqueCount(labels);
  const flatShare = ratio((counts.flat || 0) + (counts.confused || 0), labels.length);
  const highTexture = ratio((counts.curious || 0) + (counts.dangerous || 0) + (counts.triumphant || 0) + (counts.recovery || 0), labels.length);
  const score = average([
    scoreHigh(activeLabels, 5, 1),
    scoreLow(flatShare, 0.55, 0.05),
    scoreHigh(highTexture, 0.45, 0.05),
  ]);
  return scoreEvidence('emotionalTexture', score, [
    evidence('Experience labels', activeLabels, '5+ labels'),
    evidence('Flat/confused share', flatShare, '<= 0.05 ideal'),
    evidence('High-texture share', highTexture, '>= 0.45'),
    evidence('Label mix', sortedEntries(counts).map(([label, count]) => `${label}:${count}`).join(', '), 'varied'),
  ]);
}

export function findDecisiveTurns(report) {
  const turns = allTurns(report);
  const decisive = [];
  function add(type, turn, why) {
    if (!turn) return;
    const id = `${type}:${turn.runIndex}:${turn.turn}`;
    if (decisive.some((item) => item.id === id)) return;
    decisive.push({
      id,
      type,
      turn: turn.turn,
      strategy: turn.strategy,
      label: type.replace(/-/g, ' '),
      why,
      actions: submittedActions(turn),
      statDelta: turnStatTotal(turn.after) - turnStatTotal(turn.before),
      revealedDelta: turnRevealedCount(turn.after) - turnRevealedCount(turn.before),
      artifactDelta: turnArtifactCount(turn.after) - turnArtifactCount(turn.before),
      experience: classifyTurnExperience(turn),
    });
  }
  add('first-meaningful-choice', turns.find((turn) => submittedActions(turn).some((action) => action !== 'Idle')), 'The first turn where the player did something other than wait.');
  add('first-discovery', turns.find((turn) => turnRevealedCount(turn.after) > turnRevealedCount(turn.before) || (turn.analysis?.revealedDelta || 0) > 0), 'The first visible board discovery.');
  add('first-recovery', turns.find((turn) => ['recovery'].includes(classifyTurnExperience(turn))), 'The first turn where recovery appears to matter.');
  add('first-artifact', turns.find((turn) => turnArtifactCount(turn.after) > turnArtifactCount(turn.before) || (turn.analysis?.artifactDelta || 0) > 0), 'The first artifact payoff.');
  add('escape-attempt', turns.find((turn) => submittedActions(turn).includes('Flee')), 'The first escape action.');
  add('collapse-point', turns.find((turn) => (turn.analysis?.zeroStats || 0) > 0), 'The first zero-stat collapse signal.');
  add('danger-spike', turns.find((turn) => turn.analysis?.spike), 'The first analyzed danger spike.');
  const worstDebug = [...allDebugTurns(report)].sort((a, b) => (a.lifeScore || 0) - (b.lifeScore || 0))[0];
  if (worstDebug) add('lowest-life-turn', turns.find((turn) => turn.runIndex === worstDebug.runIndex && turn.turn === worstDebug.turn), 'The lowest life-score turn.');
  return decisive.slice(0, 8);
}

export function scoreOutcomeLegibility(report) {
  const decisive = findDecisiveTurns(report);
  const failureReasons = (report.runs || []).flatMap((run) => run.summary?.failureReasons || []);
  const hasOutcome = Boolean(report.summary?.outcome || report.summary?.gameOver || report.aggregate?.averages);
  const decisiveCoverage = scoreHigh(decisive.length, 4, 0);
  const failureNoise = scoreLow(uniqueCount(failureReasons), 5, 0);
  const score = average([
    hasOutcome ? 75 : 35,
    decisiveCoverage,
    failureNoise,
    report.scenarioVerdict?.verdict === 'failed' ? 45 : 75,
  ]);
  return scoreEvidence('outcomeLegibility', score, [
    evidence('Outcome present', hasOutcome, 'true'),
    evidence('Decisive turns', decisive.length, '4+'),
    evidence('Distinct failure reasons', uniqueCount(failureReasons), '<= 0 ideal'),
    evidence('Scenario verdict', report.scenarioVerdict?.verdict || 'none', 'not failed'),
  ]);
}

export function classifyRunArc(run) {
  const summary = run.summary || {};
  const fun = run.funDebugger || {};
  const artifacts = Number(summary.totalArtifacts || 0);
  const flatRate = Number(fun.flatTurnRate || 0);
  const spikeCount = (summary.spikeTurns || []).length;
  const zeroStats = Number(summary.zeroStatPlayers || 0);
  const hasRecovery = (summary.actions?.Rest || 0) + (summary.actions?.Help || 0) > 0 && Number(summary.statTotalDelta || 0) >= 0;
  if (flatRate >= 0.6) return 'flatline';
  if (zeroStats > 0 && spikeCount > 0) return 'panic-spiral';
  if (artifacts > 0 && spikeCount > 0) return 'failed-but-interesting';
  if (artifacts > 0 && flatRate < 0.25) return 'earned-escape';
  if (hasRecovery) return 'recovery-story';
  if (spikeCount > 0) return 'lucky-spike';
  if (artifacts > 0) return 'early-payoff';
  return 'slow-burn';
}

function scoreVerdict(weightedScore, scenarioVerdict, confidence, blocked) {
  if (blocked) return 'blocked';
  if (scenarioVerdict === 'failed') return weightedScore >= 65 ? 'mixed' : 'fail';
  if (weightedScore >= 82 && confidence >= 0.65) return 'strong-pass';
  if (weightedScore >= 70) return 'pass';
  if (weightedScore >= 55) return 'mixed';
  if (weightedScore >= 42) return 'weak';
  return 'fail';
}

function diagnose(scores, scenario = {}, report = {}) {
  const sorted = Object.entries(scores).sort(([, a], [, b]) => a.score - b.score);
  const weakest = sorted[0];
  const strongest = [...sorted].sort(([, a], [, b]) => b.score - a.score)[0];
  const tags = scenario.tags || [];
  const messages = [];
  if (weakest) messages.push(`Weakest dimension is ${weakest[0]} at ${Math.round(weakest[1].score)}.`);
  if (strongest) messages.push(`Strongest dimension is ${strongest[0]} at ${Math.round(strongest[1].score)}.`);
  if (tags.includes('artifact') && (report.aggregate?.averages?.artifacts || 0) < 0.25) messages.push('The artifact intent is not producing enough payoff evidence.');
  if (tags.includes('escape') && actionShare(report, 'Flee') === 0) messages.push('The escape intent is not reaching visible flee behavior.');
  if (tags.includes('cooperation') && actionShare(report, 'Help') === 0) messages.push('The cooperation intent is not producing help behavior.');
  if ((report.aggregate?.warnings || []).length > 0) messages.push(`Aggregate warnings remain: ${report.aggregate.warnings.slice(0, 2).join(' / ')}.`);
  return messages;
}

function recommendationForWeakness(weakestMetric, scenario = {}, report = {}) {
  const tags = scenario.tags || [];
  const scenarioId = scenario.id || report.config?.scenario || 'benchmark';
  const common = {
    id: slugify(`${scenarioId}-${weakestMetric}-experiment`),
    priority: 'high',
    confidence: 0.7,
    expectedMetricMovement: { [weakestMetric]: '+8 to +15' },
    verificationCommand: scenario.id
      ? `npm run scenario:run -- --id=${scenario.id} && npm run oracle:scenario -- --id=${scenario.id}`
      : 'npm run sim:golden && npm run oracle:latest',
  };
  if (weakestMetric === 'agency') {
    return {
      ...common,
      title: 'Increase early meaningful choices',
      why: 'Agency is weak when players repeat passive actions or have too few visible valid alternatives.',
      changeType: 'game-rule-or-strategy',
      targetFiles: ['scripts/gameplay-simulator.mjs', 'simulator.balance.json'],
      risk: 'May increase action noise if readability is not checked at the same time.',
    };
  }
  if (weakestMetric === 'readability') {
    return {
      ...common,
      title: 'Reduce invalid and no-delta turns',
      why: 'Readability suffers when actions fail silently, skip, or produce no visible state change.',
      changeType: 'ui-readability-or-strategy',
      targetFiles: ['app/src/components/actions/ActionPanel.jsx', 'scripts/gameplay-simulator.mjs'],
      risk: 'Making choices too obvious can reduce tension if every action becomes low-risk.',
    };
  }
  if (weakestMetric === 'tension') {
    return {
      ...common,
      title: tags.includes('escape') ? 'Make escape pressure arrive earlier' : 'Add a controlled pressure spike',
      why: 'Tension needs a readable threat, a time window, and a recovery opportunity.',
      changeType: 'balance-knob',
      targetFiles: ['simulator.balance.json', 'simulator.tuning.json'],
      risk: 'Too much pressure can collapse recovery and readability.',
    };
  }
  if (weakestMetric === 'surprise' && tags.includes('artifact')) {
    return {
      ...common,
      title: 'Add earlier artifact clue payoff',
      why: 'Artifact scenarios need a clue or partial payoff before the final reward.',
      changeType: 'card-or-deck-content',
      targetFiles: ['scripts/populate-decks.mjs', 'contracts'],
      risk: 'More artifact payoff can weaken survival pressure.',
    };
  }
  if (weakestMetric === 'recovery' && tags.includes('cooperation')) {
    return {
      ...common,
      title: 'Make help or recovery visibly valuable',
      why: 'Cooperation is not proven until another player can clearly improve a bad state.',
      changeType: 'scenario-setup-support',
      targetFiles: ['scripts/scenario-utils.mjs', 'contracts'],
      risk: 'Requires setup hooks before exhausted-player assumptions can be fully enforced.',
    };
  }
  if (weakestMetric === 'systemIntegration') {
    return {
      ...common,
      title: 'Force one cross-system interaction in the scenario',
      why: 'The observed run does not connect enough board, stat, card, artifact, and action systems.',
      changeType: 'scenario-design',
      targetFiles: ['simulator.scenarios.json', 'scripts/scenario-utils.mjs'],
      risk: 'A too-specific scenario can overfit one path.',
    };
  }
  return {
    ...common,
    title: `Improve ${weakestMetric}`,
    why: `The Oracle identified ${weakestMetric} as the weakest experience dimension.`,
    changeType: 'telemetry-or-balance',
    targetFiles: ['simulator.tuning.json', 'scripts/gameplay-simulator.mjs'],
    risk: 'Verify adjacent scores do not regress.',
  };
}

export function recommendSmallestExperiment(scores, scenario, report) {
  const criticalSkipped = (report.setupApplication?.skipped || []).filter((item) => {
    const support = (report.setupApplication?.support || []).find((field) => field.key === item.field);
    return support?.critical;
  });
  const criticalFailed = (report.setupApplication?.failed || []).filter((item) => {
    const support = (report.setupApplication?.support || []).find((field) => field.key === item.field);
    return support?.critical;
  });
  if (criticalSkipped.length > 0 || criticalFailed.length > 0 || (report.setupForge?.requiredSetupLevel === 'exact' && report.setupLevel !== 'exact')) {
    const scenarioId = scenario.id || report.config?.scenario || 'scenario';
    return {
      primary: {
        id: slugify(`${scenarioId}-setup-support`),
        priority: 'high',
        confidence: 0.82,
        expectedMetricMovement: { confidence: '+10 to +20' },
        verificationCommand: scenario.id
          ? `npm run setup:validate -- --id=${scenario.id} && npm run scenario:run -- --id=${scenario.id}`
          : 'npm run setup:doctor',
        title: 'Unlock blocked setup support first',
        why: 'The design question depends on critical setup fields that were skipped or not enforced, so balance tuning would be weak evidence.',
        changeType: 'scenario-setup-support',
        targetFiles: ['scripts/setup-forge-utils.mjs', 'contracts', 'script/DeployXenovoya.s.sol'],
        risk: 'Adding setup hooks must stay local/dev-scoped or tightly role-gated.',
      },
      alternatives: [],
    };
  }
  const sorted = Object.entries(scores).sort(([, a], [, b]) => a.score - b.score);
  const primary = recommendationForWeakness(sorted[0]?.[0] || 'agency', scenario, report);
  const alternatives = sorted.slice(1, 4).map(([metric]) => recommendationForWeakness(metric, scenario, report));
  return {
    primary,
    alternatives,
  };
}

export function oracleTaskFromRecommendation(recommendation) {
  if (!recommendation) return null;
  return {
    priority: recommendation.priority || 'high',
    source: 'oracle',
    metric: Object.keys(recommendation.expectedMetricMovement || {})[0] || 'experience',
    message: recommendation.why,
    hint: `${recommendation.title}. Verify with ${recommendation.verificationCommand}.`,
  };
}

export function computeConfidence(report, scenario = {}, telemetryGaps = []) {
  let confidence = 0.85;
  const runs = report.runs?.length || 0;
  const strategies = Object.keys(report.aggregate?.strategies || {}).length;
  const unsupported = (scenario.initialState?.assumptions || []).filter((assumption) => assumption.support === 'notYetSupported' || assumption.mode === 'notYetSupported');
  if (runs < 2) confidence -= 0.12;
  if (strategies < 2) confidence -= 0.1;
  if (unsupported.length > 0) confidence -= Math.min(0.2, unsupported.length * 0.07);
  if (telemetryGaps.length > 0) confidence -= Math.min(0.25, telemetryGaps.length * 0.06);
  const setupLevel = report.setupLevel || report.setupApplication?.setupLevel;
  const criticalSkipped = (report.setupApplication?.skipped || []).filter((item) => {
    const support = (report.setupApplication?.support || []).find((field) => field.key === item.field);
    return support?.critical;
  });
  const criticalFailed = (report.setupApplication?.failed || []).filter((item) => {
    const support = (report.setupApplication?.support || []).find((field) => field.key === item.field);
    return support?.critical;
  });
  if (setupLevel === 'exact') confidence += 0.08;
  else if (setupLevel === 'partial') confidence += 0.03;
  else if (setupLevel === 'metadata') confidence -= 0.08;
  if (criticalSkipped.length > 0) confidence -= Math.min(0.2, criticalSkipped.length * 0.08);
  if (criticalFailed.length > 0) confidence -= Math.min(0.24, criticalFailed.length * 0.1);
  return clamp(confidence, 0.1, 0.95);
}

export function telemetryGapsForReport(report) {
  const gaps = [];
  if (!report.aggregate?.averages) gaps.push('aggregate averages missing');
  if (!report.aggregate?.actionTotals) gaps.push('action totals missing');
  if (!report.funDebugger?.averageLifeScore && report.funDebugger?.averageLifeScore !== 0) gaps.push('fun debugger score missing');
  if (!report.runs?.some((run) => run.turns?.length > 0)) gaps.push('turn traces missing');
  if (!report.runs?.some((run) => run.summary?.tensionCurve?.length > 0)) gaps.push('tension curve missing');
  return gaps;
}

export function evaluateRegressionGate(oracle, baselineOracle = null, gateConfig = {}) {
  const gates = { ...DEFAULT_ORACLE_GATES, ...gateConfig };
  const failures = [];
  if (gates.failOnBlocked && oracle.oracleVerdict === 'blocked') failures.push('oracle verdict is blocked');
  if (oracle.setup?.requiredSetupLevel === 'exact' && oracle.setup?.level !== 'exact') failures.push(`required exact setup ran as ${oracle.setup?.level || 'none'}`);
  if (oracle.setup?.requiredSetupLevel === 'partial' && ['metadata', 'none', undefined].includes(oracle.setup?.level)) failures.push(`required partial setup ran as ${oracle.setup?.level || 'none'}`);
  if (oracle.weightedScore < gates.minimumWeightedScore) failures.push(`weighted score ${oracle.weightedScore} < ${gates.minimumWeightedScore}`);
  if ((oracle.experienceScores.agency?.score || 0) < gates.minimumAgency) failures.push(`agency ${oracle.experienceScores.agency.score} < ${gates.minimumAgency}`);
  if ((oracle.experienceScores.readability?.score || 0) < gates.minimumReadability) failures.push(`readability ${oracle.experienceScores.readability.score} < ${gates.minimumReadability}`);
  if (baselineOracle?.weightedScore !== undefined) {
    const delta = oracle.weightedScore - baselineOracle.weightedScore;
    if (delta < -Math.abs(gates.maximumRegression)) failures.push(`weighted score regressed ${Math.abs(delta).toFixed(1)} points`);
  }
  return {
    passed: failures.length === 0,
    failures,
  };
}

export function compareOracleTrend(current, history = []) {
  const previous = history.find((entry) => entry.generatedAt !== current.generatedAt && entry.scenarioId === current.scenarioId)
    || history.find((entry) => entry.generatedAt !== current.generatedAt);
  if (!previous) return { direction: 'stable', delta: 0, basis: 'no previous oracle report' };
  const delta = Number(current.weightedScore || 0) - Number(previous.weightedScore || 0);
  const direction = delta > 4 ? 'improving' : delta < -4 ? 'regressing' : Math.abs(delta) <= 1 ? 'stable' : 'noisy';
  return { direction, delta, previousGeneratedAt: previous.generatedAt, basis: 'weighted score' };
}

export function evaluateOracle(inputReport, scenarioInput = null, config = {}) {
  const report = normalizeReportForOracle(inputReport);
  const scenario = scenarioInput?.id ? normalizeScenario(scenarioInput) : report.scenarioDefinition ? normalizeScenario(report.scenarioDefinition) : {};
  const goals = scenarioOracleGoals(scenario);
  const weights = { ...DEFAULT_ORACLE_WEIGHTS, ...config.weights, ...goals.weights };
  const telemetryGaps = telemetryGapsForReport(report);
  const scores = {
    agency: scoreAgency(report),
    readability: scoreReadability(report),
    tension: scoreTension(report),
    surprise: scoreSurprise(report),
    recovery: scoreRecovery(report),
    systemIntegration: scoreSystemIntegration(report, scenario),
    replayability: scoreReplayability(report),
    pacing: scorePacing(report),
    emotionalTexture: scoreEmotionalTexture(report),
    outcomeLegibility: scoreOutcomeLegibility(report),
  };
  const weightedTotal = ORACLE_DIMENSIONS.reduce((sum, key) => sum + scores[key].score * Number(weights[key] || 1), 0);
  const totalWeight = ORACLE_DIMENSIONS.reduce((sum, key) => sum + Number(weights[key] || 1), 0);
  const weightedScore = Math.round(weightedTotal / totalWeight);
  const confidence = computeConfidence(report, scenario, telemetryGaps);
  const unsupported = (scenario.initialState?.assumptions || []).filter((assumption) => assumption.support === 'notYetSupported' || assumption.mode === 'notYetSupported');
  const blocked = telemetryGaps.includes('turn traces missing') || ((config.blockOnUnsupported ?? false) && unsupported.length > 0);
  const recommendations = recommendSmallestExperiment(scores, scenario, report);
  const decisiveTurns = findDecisiveTurns(report);
  const runArcs = (report.runs || []).map((run) => ({
    strategy: run.config?.strategy || 'unknown',
    arc: classifyRunArc(run),
    outcome: run.summary?.outcome || 'unknown',
  }));
  const minimumFailures = Object.entries(goals.minimums || {})
    .filter(([metric, minimum]) => (scores[metric]?.score || 0) < Number(minimum))
    .map(([metric, minimum]) => `${metric} ${scores[metric].score} < scenario minimum ${minimum}`);
  const oracleVerdict = minimumFailures.length > 0
    ? scoreVerdict(Math.min(weightedScore, 54), report.scenarioVerdict?.verdict, confidence, blocked)
    : scoreVerdict(weightedScore, report.scenarioVerdict?.verdict, confidence, blocked);
  const oracle = {
    schemaVersion: 1,
    oracleVersion: ORACLE_VERSION,
    generatedAt: new Date().toISOString(),
    sourceReportPath: config.sourceReportPath || null,
    scenarioId: scenario.id || report.config?.scenario || 'unknown',
    designQuestion: scenario.designQuestion || report.scenarioVerdict?.designQuestion || 'Does this run create a fun, readable, alive turn arc?',
    oracleVerdict,
    confidence,
    weightedScore,
    experienceScores: scores,
    weights,
    scenarioGoals: goals,
    evidence: {
      decisiveTurns,
      runArcs,
      scenarioVerdict: report.scenarioVerdict || null,
      aggregateWarnings: report.aggregate?.warnings || [],
      telemetryGaps,
      setupApplication: report.setupApplication || null,
      setupDiff: report.setupApplication?.actualDiff || [],
    },
    diagnosis: diagnose(scores, scenario, report),
    recommendations,
    smallestNextExperiment: recommendations.primary,
    regressionRisks: [
      recommendations.primary?.risk,
      scenario.tags?.includes('artifact') ? 'Artifact payoff changes can reduce survival pressure if rewards become too frequent.' : null,
      scenario.tags?.includes('escape') ? 'Escape pressure changes can reduce readability if flee timing is not explained.' : null,
      scenario.tags?.includes('cooperation') ? 'Cooperation tuning can overfit multiplayer and make solo recovery too generous.' : null,
    ].filter(Boolean),
    setupSupportNeeded: unsupported.map((assumption) => ({
      key: assumption.key,
      description: assumption.description,
      support: assumption.support || assumption.mode,
    })),
    setup: {
      level: report.setupLevel || report.setupApplication?.setupLevel || (report.setupForge ? 'metadata' : 'none'),
      requiredSetupLevel: report.setupForge?.requiredSetupLevel || scenario.requiredSetupLevel || 'metadata',
      applied: report.setupApplication?.applied?.length || 0,
      skipped: report.setupApplication?.skipped?.length || 0,
      failed: report.setupApplication?.failed?.length || 0,
      criticalSkipped: (report.setupApplication?.skipped || []).filter((item) => {
        const support = (report.setupApplication?.support || []).find((field) => field.key === item.field);
        return support?.critical;
      }).length,
      criticalFailed: (report.setupApplication?.failed || []).filter((item) => {
        const support = (report.setupApplication?.support || []).find((field) => field.key === item.field);
        return support?.critical;
      }).length,
    },
    scenarioMinimumFailures: minimumFailures,
  };
  oracle.gate = evaluateRegressionGate(oracle, config.baselineOracle, config.gates || {});
  oracle.trend = compareOracleTrend(oracle, config.history || []);
  return oracle;
}

export function oracleReportPaths(scenarioId = null) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (scenarioId) {
    const scenarioDir = resolve(scenarioReportRoot, scenarioId);
    return {
      latest: resolve(scenarioDir, 'latest-oracle.json'),
      markdown: resolve(scenarioDir, 'latest-oracle.md'),
      stamped: resolve(scenarioDir, `oracle-${stamp}.json`),
      history: resolve(scenarioDir, 'oracle-history.json'),
      publicLatest: resolve(publicOracleRoot, 'scenarios', scenarioId, 'latest-oracle.json'),
    };
  }
  return {
    latest: resolve(oracleReportRoot, 'latest-oracle.json'),
    markdown: resolve(oracleReportRoot, 'latest-oracle.md'),
    stamped: resolve(oracleReportRoot, `oracle-${stamp}.json`),
    history: resolve(oracleReportRoot, 'history.json'),
    publicLatest: resolve(publicOracleRoot, 'latest-oracle.json'),
  };
}

export function oracleSummaryEntry(oracle, extra = {}) {
  const scoreEntries = Object.entries(oracle.experienceScores || {});
  const weakest = [...scoreEntries].sort(([, a], [, b]) => a.score - b.score)[0];
  const strongest = [...scoreEntries].sort(([, a], [, b]) => b.score - a.score)[0];
  return {
    generatedAt: oracle.generatedAt,
    scenarioId: oracle.scenarioId,
    verdict: oracle.oracleVerdict,
    weightedScore: oracle.weightedScore,
    confidence: oracle.confidence,
    weakestScore: weakest ? { metric: weakest[0], score: weakest[1].score } : null,
    strongestScore: strongest ? { metric: strongest[0], score: strongest[1].score } : null,
    setupLevel: oracle.setup?.level || 'none',
    requiredSetupLevel: oracle.setup?.requiredSetupLevel || 'metadata',
    smallestNextExperiment: oracle.smallestNextExperiment?.title || null,
    commonFailurePattern: extra.commonFailurePattern || null,
    reportPath: extra.reportPath || null,
  };
}

export function writeOracleReport(oracle, { scenarioId = null, markdown = true } = {}) {
  const paths = oracleReportPaths(scenarioId);
  writeJson(paths.latest, oracle);
  writeJson(paths.stamped, oracle);
  writeJson(paths.publicLatest, oracle);
  if (markdown) writeMarkdownReport(paths.markdown, oracle);
  const history = readJson(paths.history, []);
  const entry = oracleSummaryEntry(oracle, { reportPath: paths.stamped });
  writeJson(paths.history, [entry, ...(Array.isArray(history) ? history : [])].slice(0, 100));
  const index = readJson(oracleSummaryIndexPath, []);
  const nextIndex = [entry, ...(Array.isArray(index) ? index : [])]
    .filter((item, indexNumber, list) => indexNumber === list.findIndex((candidate) => candidate.generatedAt === item.generatedAt && candidate.scenarioId === item.scenarioId))
    .slice(0, 250);
  writeJson(oracleSummaryIndexPath, nextIndex);
  writeJson(publicOracleSummaryIndexPath, nextIndex);
  return paths;
}

export function markdownForOracle(oracle) {
  const scoreLines = ORACLE_DIMENSIONS.map((key) => {
    const score = oracle.experienceScores?.[key]?.score ?? 0;
    return `| ${key} | ${score} | ${Number(oracle.weights?.[key] || 1).toFixed(2)} |`;
  }).join('\n');
  const decisive = (oracle.evidence?.decisiveTurns || []).map((turn) => (
    `- T${turn.turn} ${turn.strategy}: ${turn.label} (${turn.experience}) - ${turn.why}`
  )).join('\n') || '- No decisive turns found.';
  const risks = (oracle.regressionRisks || []).map((risk) => `- ${risk}`).join('\n') || '- No specific risks detected.';
  return `# Gameplay Oracle Report

Generated: ${oracle.generatedAt}

Scenario: ${oracle.scenarioId}

Verdict: ${oracle.oracleVerdict}

Weighted score: ${oracle.weightedScore}

Confidence: ${Math.round((oracle.confidence || 0) * 100)}%

Design question: ${oracle.designQuestion}

## Scores

| Dimension | Score | Weight |
| --- | ---: | ---: |
${scoreLines}

## Diagnosis

${(oracle.diagnosis || []).map((line) => `- ${line}`).join('\n')}

## Decisive Turns

${decisive}

## Smallest Next Experiment

${oracle.smallestNextExperiment?.title || 'No experiment generated.'}

${oracle.smallestNextExperiment?.why || ''}

Verification: \`${oracle.smallestNextExperiment?.verificationCommand || 'npm run oracle:latest'}\`

## Regression Risks

${risks}
`;
}

export function writeMarkdownReport(path, oracle) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, markdownForOracle(oracle));
}

export function findScenarioForReport(report) {
  if (report.scenarioDefinition?.id) return normalizeScenario(report.scenarioDefinition);
  const id = report.config?.scenarioId || report.config?.scenario;
  if (!id) return null;
  const store = loadScenarioStore();
  return findScenario(store, id);
}

export function readOracleHistory(scenarioId = null) {
  const paths = oracleReportPaths(scenarioId);
  return readJson(paths.history, []);
}

export function readLatestOracle(scenarioId = null) {
  const paths = oracleReportPaths(scenarioId);
  return readJson(paths.latest, null);
}

export function evaluateCommonFailurePattern(oracles) {
  const weakMetrics = {};
  for (const oracle of oracles) {
    const weakest = Object.entries(oracle.experienceScores || {}).sort(([, a], [, b]) => a.score - b.score)[0];
    if (!weakest) continue;
    weakMetrics[weakest[0]] = (weakMetrics[weakest[0]] || 0) + 1;
  }
  const [metric, count] = Object.entries(weakMetrics).sort(([, a], [, b]) => b - a || 0)[0] || [];
  if (!metric) return null;
  return `${metric} is the most common weak dimension across ${count} scenario${count === 1 ? '' : 's'}.`;
}

export function summarizeOraclePack(oracles, packId = 'custom') {
  const valid = oracles.filter(Boolean);
  const commonFailurePattern = evaluateCommonFailurePattern(valid);
  const weakest = [...valid].sort((a, b) => a.weightedScore - b.weightedScore)[0] || null;
  const strongest = [...valid].sort((a, b) => b.weightedScore - a.weightedScore)[0] || null;
  const recommendation = weakest?.smallestNextExperiment || null;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    packId,
    oracleCount: valid.length,
    packVerdict: valid.some((oracle) => ['fail', 'blocked'].includes(oracle.oracleVerdict))
      ? 'needs-work'
      : valid.every((oracle) => ['strong-pass', 'pass'].includes(oracle.oracleVerdict))
        ? 'healthy'
        : 'mixed',
    averageWeightedScore: Math.round(average(valid.map((oracle) => oracle.weightedScore))),
    weakestScenario: weakest ? oracleSummaryEntry(weakest) : null,
    strongestScenario: strongest ? oracleSummaryEntry(strongest) : null,
    commonFailurePattern,
    projectLevelRecommendation: recommendation,
    scenarios: valid.map((oracle) => oracleSummaryEntry(oracle, { commonFailurePattern })),
  };
}

export function doctorReport() {
  const store = loadScenarioStore();
  const latestReportExists = existsSync(latestSimulatorReportPath);
  const latestOracleExists = existsSync(oracleReportPaths().latest);
  const scenarioFindings = (store.scenarios || []).map((scenario) => {
    const normalized = normalizeScenario(scenario);
    const reportPath = resolve(scenarioReportRoot, normalized.id, 'latest-report.json');
    const oraclePath = oracleReportPaths(normalized.id).latest;
    const unsupported = (normalized.initialState?.assumptions || []).filter((assumption) => assumption.support === 'notYetSupported' || assumption.mode === 'notYetSupported');
    return {
      id: normalized.id,
      hasScenarioReport: existsSync(reportPath),
      hasOracleReport: existsSync(oraclePath),
      unsupportedAssumptions: unsupported.map((assumption) => assumption.key),
      hasOracleGoals: Boolean(normalized.oracleGoals),
      importance: normalized.importance || 'supporting',
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    latestReportExists,
    latestOracleExists,
    scenarios: scenarioFindings,
    missingScenarioReports: scenarioFindings.filter((item) => !item.hasScenarioReport).map((item) => item.id),
    staleOracleReports: scenarioFindings.filter((item) => item.hasScenarioReport && !item.hasOracleReport).map((item) => item.id),
    unsupportedAssumptionCount: scenarioFindings.reduce((sum, item) => sum + item.unsupportedAssumptions.length, 0),
  };
}
