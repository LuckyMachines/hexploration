import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
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

export const FEELING_BLACK_BOX_VERSION = '1.0.0';
export const feelingReportRoot = resolve(root, 'reports', 'simulator', 'feeling-black-box');
export const publicFeelingRoot = resolve(root, 'app', 'public', 'simulator', 'feeling-black-box');
export const FEELING_LABELS = ['alive', 'tense', 'confusing', 'flat', 'hopeful', 'payoff', 'panic', 'recovery', 'dead-end', 'friction', 'surprise', 'setup-doubt'];
export const FEELING_POLARITIES = ['positive', 'negative', 'mixed', 'neutral'];
export const FEELING_INTENSITIES = ['low', 'medium', 'high'];
export const ARC_SHAPES = ['rising', 'falling', 'spiky', 'flatline', 'recovery', 'payoff-then-drift', 'panic-loop', 'uncertain'];

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

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, number(value)));
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function timestamp(value) {
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePath(path) {
  return path ? relative(root, path).replace(/\\/g, '/') : '';
}

function totalStats(state = {}) {
  return asArray(state.players).reduce((sum, player) => (
    sum
    + number(player.stats?.movement)
    + number(player.stats?.agility)
    + number(player.stats?.dexterity)
  ), 0);
}

function zeroStatPlayers(state = {}) {
  return asArray(state.players).filter((player) => (
    number(player.stats?.movement) <= 0
    || number(player.stats?.agility) <= 0
    || number(player.stats?.dexterity) <= 0
  )).length;
}

function artifactCount(state = {}) {
  return asArray(state.players).reduce((sum, player) => sum + asArray(player.artifacts).length, 0);
}

function inventoryCount(state = {}) {
  return asArray(state.players).reduce((sum, player) => sum + asArray(player.inventory).length, 0);
}

function actionList(submissions = []) {
  return asArray(submissions).map((submission) => submission.action).filter(Boolean);
}

function acceptedSubmissionCount(event = {}) {
  return asArray(event.submissions).filter((submission) => submission.action && !submission.error && !submission.skipped).length;
}

function hasEnginePulse(event = {}) {
  return acceptedSubmissionCount(event) > 0 && number(event.progressCount) > 0;
}

function scenarioIdForReport(report = {}) {
  return slugify(
    report.scenarioId
    || report.scenarioDefinition?.id
    || report.config?.scenarioId
    || report.config?.scenario
    || report.baselineRun?.scenarioId
    || report.finalRun?.scenarioId
    || report.baselineRun?.scenarioDefinition?.id
    || report.finalRun?.scenarioDefinition?.id
    || report.baselineRun?.config?.scenarioId
    || report.finalRun?.config?.scenarioId
    || 'benchmark',
  );
}

function sourceMeta(report = {}, sourcePath = '') {
  return {
    generatedAt: report.generatedAt || nowIso(),
    sourcePath: normalizePath(sourcePath),
    scenarioId: scenarioIdForReport(report),
    strategy: report.config?.strategy || report.strategy || report.baselineRun?.config?.strategy || report.finalRun?.config?.strategy,
    seed: report.config?.seed || report.seed || report.baselineRun?.config?.seed || report.finalRun?.config?.seed,
    playerCount: report.config?.players || report.summary?.activePlayers || asArray(report.initial?.players).length || report.baselineRun?.summary?.activePlayers || report.finalRun?.summary?.activePlayers,
  };
}

export function feelingPaths(scenarioId = null) {
  if (!scenarioId) {
    return {
      latest: resolve(feelingReportRoot, 'latest-report.json'),
      latestMarkdown: resolve(feelingReportRoot, 'latest-report.md'),
      index: resolve(feelingReportRoot, 'index.json'),
      publicLatest: resolve(publicFeelingRoot, 'latest-report.json'),
      publicIndex: resolve(publicFeelingRoot, 'index.json'),
    };
  }
  const id = slugify(scenarioId);
  return {
    dir: resolve(feelingReportRoot, id),
    latest: resolve(feelingReportRoot, id, 'latest-report.json'),
    latestMarkdown: resolve(feelingReportRoot, id, 'latest-report.md'),
    publicLatest: resolve(publicFeelingRoot, id, 'latest-report.json'),
  };
}

export function sourcePathForScenario(scenarioId) {
  return resolve(scenarioReportRoot, slugify(scenarioId), 'latest-report.json');
}

export function loadFeelingSourceReport({ file = null, scenarioId = null } = {}) {
  if (file) {
    const candidate = resolve(root, file);
    return existsSync(candidate)
      ? { report: readJson(candidate, null), sourcePath: candidate }
      : { report: null, sourcePath: candidate };
  }
  const candidates = [
    scenarioId ? sourcePathForScenario(scenarioId) : null,
    resolve(root, 'reports', 'simulator', 'latest-report.json'),
    resolve(root, 'reports', 'simulator', 'autopilot', 'latest-report.json'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    return {
      report: readJson(candidate, null),
      sourcePath: candidate,
    };
  }
  return { report: null, sourcePath: candidates[0] || resolve(root, 'reports', 'simulator', 'latest-report.json') };
}

export function diffTurnState(before = {}, after = {}) {
  const beforePlayers = asArray(before.players);
  const afterPlayers = asArray(after.players);
  const locationChanges = afterPlayers.filter((player) => {
    const previous = beforePlayers.find((item) => String(item.playerId) === String(player.playerId));
    return previous && previous.location !== player.location;
  }).length;
  return {
    statDelta: totalStats(after) - totalStats(before),
    locationChanges,
    artifactDelta: artifactCount(after) - artifactCount(before),
    revealedDelta: number(after.activeZones?.count) - number(before.activeZones?.count),
    inventoryDelta: inventoryCount(after) - inventoryCount(before),
    activePlayerDelta: afterPlayers.filter((player) => player.active !== false).length - beforePlayers.filter((player) => player.active !== false).length,
    queueChanged: before.queuePhase !== after.queuePhase || before.phase !== after.phase,
    zeroStatDelta: zeroStatPlayers(after) - zeroStatPlayers(before),
    zeroStatPlayers: zeroStatPlayers(after),
    cardDraws: asArray(after.lastDayEvents?.cardsDrawn).filter(Boolean).length,
    gameOver: Boolean(after.gameOver && !before.gameOver),
  };
}

function reportRuns(report = {}) {
  if (asArray(report.runs).length > 0) return report.runs.map((run, index) => ({ ...run, runIndex: index }));
  const nestedRuns = [report.baselineRun, report.finalRun].filter((run) => asArray(run?.turns).length > 0);
  if (nestedRuns.length > 0) {
    return nestedRuns.map((run, index) => ({
      ...run,
      runIndex: index,
      scenarioId: run.scenarioId || report.scenarioId,
      scenarioDefinition: run.scenarioDefinition || report.scenarioDefinition,
      config: run.config || report.config,
    }));
  }
  return [{ ...report, runIndex: 0 }];
}

export function normalizeTurnEvidence(report = {}, { sourcePath = '' } = {}) {
  const meta = sourceMeta(report, sourcePath);
  return reportRuns(report).flatMap((run) => {
    const runTurns = asArray(run.turns);
    return runTurns.map((turn, index) => {
      const before = turn.before || (index === 0 ? run.initial || report.initial : runTurns[index - 1]?.after) || {};
      const after = turn.after || before;
      const submissions = asArray(turn.submissions);
      const diff = diffTurnState(before, after);
      const actions = actionList(submissions);
      return {
        runIndex: run.runIndex || 0,
        turn: turn.turn ?? index + 1,
        playerId: submissions.length === 1 ? submissions[0].playerId : null,
        source: submissions.length > 0 ? 'player' : 'system',
        action: actions.join(', ') || (turn.skipped ? 'Wait' : 'Idle'),
        actions,
        valid: submissions.length === 0 ? !turn.skipped : submissions.every((submission) => !submission.error),
        skipped: Boolean(turn.skipped),
        before,
        after,
        diff,
        submissions,
        invalidAttempts: submissions.reduce((sum, submission) => sum + number(submission.invalidAttempts), 0),
        errors: submissions.filter((submission) => submission.error),
        validChoiceCount: Math.max(0, ...submissions.map((submission) => number(submission.validChoiceCount))),
        progressCount: number(turn.progressCount),
        acceptedSubmissions: submissions.filter((submission) => submission.action && !submission.error && !submission.skipped).length,
        analysis: turn.analysis || {},
        funDebugger: turn.analysis?.funDebugger || {},
        scenarioId: meta.scenarioId,
        generatedAt: meta.generatedAt,
        sourcePath: meta.sourcePath,
        strategy: meta.strategy,
        seed: meta.seed,
        playerCount: meta.playerCount,
        citation: compact({
          sourcePath: meta.sourcePath,
          scenarioId: meta.scenarioId,
          generatedAt: meta.generatedAt,
          runIndex: run.runIndex || 0,
          turn: turn.turn ?? index + 1,
        }),
      };
    });
  });
}

function candidate(label, weight, reason, systems = []) {
  return { label, weight, reason, systems };
}

function setupDoubt(report = {}, event = {}) {
  return Boolean(
    report.setupLevel === 'metadata'
    || asArray(report.setupApplication?.skipped).length > 0
    || asArray(report.setupApplication?.failed).length > 0
    || asArray(report.unsupportedAssumptions).length > 0
    || event.funDebugger?.systems?.includes?.('setup'),
  );
}

function choosePrimary(candidates = []) {
  return [...candidates].sort((a, b) => b.weight - a.weight)[0] || candidate('flat', 1, 'No meaningful feeling signal was detected.', []);
}

function polarityFor(label) {
  if (['alive', 'hopeful', 'payoff', 'recovery', 'surprise'].includes(label)) return 'positive';
  if (['confusing', 'flat', 'panic', 'dead-end', 'friction', 'setup-doubt'].includes(label)) return 'negative';
  if (label === 'tense') return 'mixed';
  return 'neutral';
}

function intensityFor(weight, event = {}) {
  const pulse = number(event.lifePulse, 0);
  if (weight >= 80 || pulse >= 75 || pulse <= 25) return 'high';
  if (weight >= 45 || pulse >= 45) return 'medium';
  return 'low';
}

export function computeTurnAgencyScore(event = {}) {
  const diff = event.diff || {};
  const accepted = acceptedSubmissionCount(event);
  const enginePulse = hasEnginePulse(event);
  let score = 35;
  if (event.valid || accepted > 0) score += 12;
  score += Math.min(20, accepted * 4);
  if (enginePulse) score += 16;
  if (diff.locationChanges > 0) score += 14;
  if (diff.revealedDelta > 0) score += 16;
  if (diff.artifactDelta > 0) score += 20;
  if (diff.statDelta !== 0) score += 8;
  if (diff.cardDraws > 0) score += 8;
  if (event.validChoiceCount > 1) score += 8;
  if (event.actions?.includes('Help')) score += 10;
  if (event.invalidAttempts > 0) score -= Math.min(20, event.invalidAttempts * 6);
  if (!event.valid && accepted === 0) score -= 20;
  if (!diff.locationChanges && !diff.revealedDelta && !diff.artifactDelta && !diff.statDelta && !diff.cardDraws && !enginePulse) score -= 16;
  if (event.skipped) score -= 22;
  return Math.round(clamp(score));
}

export function computeTurnFrictionScore(event = {}) {
  const diff = event.diff || {};
  const accepted = acceptedSubmissionCount(event);
  const enginePulse = hasEnginePulse(event);
  let score = 12;
  score += Math.min(35, number(event.invalidAttempts) * 10);
  score += asArray(event.errors).length * 22;
  if (!event.valid && accepted === 0) score += 24;
  if (enginePulse) score -= 10;
  if (event.skipped) score += 22;
  if (!diff.locationChanges && !diff.revealedDelta && !diff.artifactDelta && !diff.statDelta && !diff.cardDraws && !enginePulse) score += 18;
  if (event.actions?.includes('Move') && diff.locationChanges <= 0 && diff.revealedDelta <= 0) score += 14;
  if (event.actions?.includes('Dig') && diff.artifactDelta <= 0) score += 10;
  if (event.validChoiceCount === 1) score += 8;
  return Math.round(clamp(score));
}

export function computeTurnLifePulse(event = {}) {
  const diff = event.diff || {};
  const agency = event.agencyScore ?? computeTurnAgencyScore(event);
  const friction = event.frictionScore ?? computeTurnFrictionScore(event);
  const enginePulse = hasEnginePulse(event);
  let pulse = 30 + agency * 0.45 - friction * 0.35;
  if (enginePulse) pulse += 18;
  if (diff.artifactDelta > 0) pulse += 18;
  if (diff.revealedDelta > 0) pulse += 12;
  if (diff.locationChanges > 0) pulse += 8;
  if (diff.statDelta > 0) pulse += 8;
  if (diff.statDelta < 0) pulse += Math.min(10, Math.abs(diff.statDelta) * 2);
  if (diff.zeroStatDelta > 0) pulse -= 16;
  if (diff.cardDraws > 0) pulse += 8;
  if (acceptedSubmissionCount(event) >= 3) pulse += 8;
  if (event.skipped) pulse -= 18;
  return Math.round(clamp(pulse));
}

export function scoreFeelingConfidence(event = {}) {
  let confidence = 0.35;
  const diff = event.diff || {};
  if (event.before && event.after) confidence += 0.2;
  if (asArray(event.submissions).length > 0) confidence += 0.12;
  if (hasEnginePulse(event)) confidence += 0.08;
  if (event.action && event.action !== 'Idle') confidence += 0.08;
  if (diff.locationChanges || diff.revealedDelta || diff.artifactDelta || diff.statDelta || diff.cardDraws) confidence += 0.15;
  if (event.funDebugger?.classification) confidence += 0.08;
  if (event.skipped || !event.valid) confidence += 0.04;
  if (!event.before?.players || !event.after?.players) confidence -= 0.18;
  if (event.source === 'aggregate') confidence -= 0.2;
  return Math.round(clamp(confidence, 0.1, 0.95) * 100) / 100;
}

export function controlFeelNote(event = {}) {
  const action = event.action || 'Idle';
  const diff = event.diff || {};
  if (event.skipped) return 'No input state: waiting became the feeling.';
  if (hasEnginePulse(event) && asArray(event.errors).length > 0) return 'Some input was rejected, but accepted actions advanced the turn.';
  if (!event.valid || asArray(event.errors).length > 0) return 'Input was rejected, causing friction.';
  if (hasEnginePulse(event)) return 'Accepted input advanced the engine turn.';
  if (action.includes('Move') && (diff.locationChanges > 0 || diff.revealedDelta > 0)) return 'Pressing move changed the board.';
  if (action.includes('Move')) return 'Pressing move produced little visible board feedback.';
  if (action.includes('Dig') && diff.artifactDelta > 0) return 'Pressing dig produced artifact payoff.';
  if (action.includes('Dig')) return 'Pressing dig produced no visible payoff.';
  if (action.includes('Rest') && diff.statDelta > 0) return 'Pressing rest created recovery.';
  if (action.includes('Rest')) return 'Pressing rest slowed the rhythm without visible recovery.';
  if (action.includes('Flee')) return 'Pressing flee created escape pressure.';
  if (action.includes('Help')) return 'Pressing help made another player matter.';
  if (action === 'Idle') return 'No input state: idle carried the turn.';
  return `Pressing ${action.toLowerCase()} produced ${diff.locationChanges || diff.revealedDelta || diff.artifactDelta || diff.statDelta ? 'visible consequence' : 'limited visible consequence'}.`;
}

export function classifyFeelingEvent(turnEvidence = {}, { report = {} } = {}) {
  const event = { ...turnEvidence };
  event.agencyScore = computeTurnAgencyScore(event);
  event.frictionScore = computeTurnFrictionScore(event);
  event.lifePulse = computeTurnLifePulse(event);
  const diff = event.diff || {};
  const labels = [];
  const enginePulse = hasEnginePulse(event);
  const positiveDelta = diff.locationChanges > 0 || diff.revealedDelta > 0 || diff.artifactDelta > 0 || diff.statDelta > 0 || diff.cardDraws > 0;
  const meaningfulDelta = positiveDelta || diff.statDelta !== 0 || enginePulse;
  if ((positiveDelta || enginePulse) && (event.valid || acceptedSubmissionCount(event) > 0)) {
    const pressurePenalty = diff.statDelta < 0 || event.invalidAttempts > 0 || asArray(event.errors).length > 0 ? 16 : 0;
    labels.push(candidate('alive', 62 + event.agencyScore * 0.25 + (enginePulse ? 18 : 0) - pressurePenalty, enginePulse ? 'Accepted input advanced the exact engine turn.' : 'Valid input changed meaningful state.', ['input', 'state']));
  }
  if (diff.revealedDelta > 0 || diff.cardDraws > 0) labels.push(candidate('surprise', 50 + diff.revealedDelta * 8 + diff.cardDraws * 8, 'The turn revealed new information or surfaced an event.', ['discovery']));
  if (diff.artifactDelta > 0 || event.actions?.includes('Flee')) labels.push(candidate('payoff', 92 + Math.max(0, diff.artifactDelta) * 8 + (enginePulse ? 8 : 0), 'The turn produced artifact or escape payoff.', ['reward']));
  if (diff.statDelta > 0 || event.actions?.includes('Rest') || event.actions?.includes('Help')) labels.push(candidate('recovery', 80 + Math.max(0, diff.statDelta) * 5, 'The turn created recovery or support.', ['recovery']));
  if (diff.statDelta > 0 || diff.revealedDelta > 0 || diff.locationChanges > 0) labels.push(candidate('hopeful', 48, 'The turn opened a future opportunity.', ['future-choice']));
  if (diff.zeroStatPlayers > 0 || diff.statDelta <= -4 || event.actions?.includes('Flee')) labels.push(candidate('tense', 58 + Math.abs(Math.min(0, diff.statDelta)) * 3, 'Pressure increased around survival or escape.', ['pressure']));
  if (diff.zeroStatDelta > 0 || diff.statDelta <= -6) labels.push(candidate('panic', 70 + diff.zeroStatDelta * 10, 'Survival deteriorated sharply.', ['survival']));
  if (event.invalidAttempts > 0 || asArray(event.errors).length > 0) labels.push(candidate('confusing', 58 + event.invalidAttempts * 5 - (enginePulse ? 14 : 0), 'The turn contained invalid or failed input.', ['readability']));
  if (!event.valid || event.invalidAttempts > 0 || asArray(event.errors).length > 0) labels.push(candidate('friction', 62 + event.frictionScore * 0.2 - (enginePulse ? 12 : 0), 'The intended action was blocked or unclear.', ['action-validity']));
  if (!meaningfulDelta && event.valid && !event.skipped) labels.push(candidate('flat', 60 + event.frictionScore * 0.2, 'The turn produced no meaningful visible state delta.', ['pacing']));
  if (event.skipped || (!enginePulse && !event.valid && event.invalidAttempts >= 2) || (event.validChoiceCount === 1 && !meaningfulDelta)) labels.push(candidate('dead-end', 64, 'The player had little useful agency.', ['agency']));
  if (setupDoubt(report, event)) labels.push(candidate('setup-doubt', 52, 'Scenario confidence depends on unsupported setup evidence.', ['setup']));
  const primary = choosePrimary(labels);
  const secondary = labels.filter((item) => item.label !== primary.label).sort((a, b) => b.weight - a.weight).slice(0, 4);
  return {
    ...event,
    feelingLabel: primary.label,
    secondaryLabels: secondary.map((item) => item.label),
    polarity: polarityFor(primary.label),
    intensity: intensityFor(primary.weight, event),
    confidence: scoreFeelingConfidence(event),
    reason: primary.reason,
    evidence: compact({
      diff,
      invalidAttempts: event.invalidAttempts,
      validChoiceCount: event.validChoiceCount,
      funDebuggerClassification: event.funDebugger?.classification,
      lifeScore: event.funDebugger?.lifeScore,
    }),
    systems: unique([...(primary.systems || []), ...secondary.flatMap((item) => item.systems || []), ...asArray(event.funDebugger?.systems)]),
    controlFeelNote: controlFeelNote(event),
  };
}

export function buildFeelingTimeline(report = {}, { sourcePath = '' } = {}) {
  return normalizeTurnEvidence(report, { sourcePath }).map((event) => classifyFeelingEvent(event, { report }));
}

function countBy(values = []) {
  return values.reduce((counts, value) => {
    if (value) counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

export function labelCounts(timeline = []) {
  return countBy(timeline.map((event) => event.feelingLabel));
}

export function polarityMix(timeline = []) {
  return countBy(timeline.map((event) => event.polarity));
}

export function intensityMix(timeline = []) {
  return countBy(timeline.map((event) => event.intensity));
}

function firstWith(timeline = [], predicate = () => false) {
  return timeline.find(predicate) || null;
}

function bestBy(timeline = [], score = () => 0) {
  return [...timeline].sort((a, b) => score(b) - score(a))[0] || null;
}

export function findFirstAliveTurn(timeline = []) {
  return firstWith(timeline, (event) => event.feelingLabel === 'alive' || event.lifePulse >= 60);
}

export function findFirstFlatTurn(timeline = []) {
  return firstWith(timeline, (event) => ['flat', 'dead-end'].includes(event.feelingLabel) || event.lifePulse <= 30);
}

export function findBestMoment(timeline = []) {
  return bestBy(timeline, (event) => event.lifePulse + (['payoff', 'recovery', 'surprise', 'alive'].includes(event.feelingLabel) ? 20 : 0) + event.agencyScore * 0.25);
}

export function findWorstMoment(timeline = []) {
  return bestBy(timeline, (event) => event.frictionScore + (['dead-end', 'confusing', 'panic', 'friction', 'flat'].includes(event.feelingLabel) ? 25 : 0) + (100 - event.lifePulse) * 0.2);
}

export function findMostConfusingMoment(timeline = []) {
  return bestBy(timeline, (event) => (event.feelingLabel === 'confusing' ? 80 : 0) + event.invalidAttempts * 8 + asArray(event.errors).length * 15);
}

export function findStrongestAgencyMoment(timeline = []) {
  return bestBy(timeline, (event) => event.agencyScore + (event.lifePulse * 0.2));
}

export function findStrongestFrictionMoment(timeline = []) {
  return bestBy(timeline, (event) => event.frictionScore + (event.feelingLabel === 'friction' ? 30 : 0));
}

export function findRecoveryMoment(timeline = []) {
  return bestBy(timeline.filter((event) => ['recovery', 'hopeful'].includes(event.feelingLabel) || event.diff?.statDelta > 0), (event) => event.lifePulse + Math.max(0, event.diff?.statDelta || 0) * 5);
}

export function findPayoffMoment(timeline = []) {
  return bestBy(timeline.filter((event) => ['payoff', 'surprise'].includes(event.feelingLabel) || event.diff?.artifactDelta > 0), (event) => event.lifePulse + Math.max(0, event.diff?.artifactDelta || 0) * 20);
}

function momentSummary(event = null) {
  if (!event) return null;
  return compact({
    turn: event.turn,
    runIndex: event.runIndex,
    label: event.feelingLabel,
    action: event.action,
    lifePulse: event.lifePulse,
    agencyScore: event.agencyScore,
    frictionScore: event.frictionScore,
    reason: event.reason,
    controlFeelNote: event.controlFeelNote,
    citation: event.citation,
  });
}

export function detectArcShape(timeline = []) {
  if (timeline.length < 2) return 'uncertain';
  const pulses = timeline.map((event) => event.lifePulse);
  const average = pulses.reduce((sum, value) => sum + value, 0) / pulses.length;
  const variance = pulses.reduce((sum, value) => sum + Math.abs(value - average), 0) / pulses.length;
  const start = pulses.slice(0, Math.max(1, Math.ceil(pulses.length / 3))).reduce((sum, value) => sum + value, 0) / Math.max(1, Math.ceil(pulses.length / 3));
  const end = pulses.slice(-Math.max(1, Math.ceil(pulses.length / 3))).reduce((sum, value) => sum + value, 0) / Math.max(1, Math.ceil(pulses.length / 3));
  const labels = timeline.map((event) => event.feelingLabel);
  if (average < 35 && variance < 10) return 'flatline';
  if (labels.filter((label) => ['panic', 'dead-end', 'friction'].includes(label)).length >= Math.ceil(timeline.length / 2) && !labels.some((label) => ['recovery', 'hopeful'].includes(label))) return 'panic-loop';
  if (labels.some((label) => ['panic', 'friction', 'dead-end'].includes(label)) && labels.findIndex((label) => ['recovery', 'hopeful', 'payoff'].includes(label)) > labels.findIndex((label) => ['panic', 'friction', 'dead-end'].includes(label))) return 'recovery';
  if (labels.slice(0, Math.ceil(timeline.length / 2)).includes('payoff') && labels.slice(Math.ceil(timeline.length / 2)).filter((label) => ['flat', 'dead-end'].includes(label)).length >= 1) return 'payoff-then-drift';
  if (variance > 22) return 'spiky';
  if (end - start >= 10) return 'rising';
  if (start - end >= 10) return 'falling';
  return 'uncertain';
}

export function computeArcScore(timeline = []) {
  if (timeline.length === 0) return 0;
  const averagePulse = timeline.reduce((sum, event) => sum + event.lifePulse, 0) / timeline.length;
  const averageAgency = timeline.reduce((sum, event) => sum + event.agencyScore, 0) / timeline.length;
  const averageFriction = timeline.reduce((sum, event) => sum + event.frictionScore, 0) / timeline.length;
  const firstAliveIndex = timeline.findIndex((event) => event.feelingLabel === 'alive' || event.lifePulse >= 60);
  const payoffCount = timeline.filter((event) => ['payoff', 'surprise'].includes(event.feelingLabel)).length;
  const recoveryCount = timeline.filter((event) => ['recovery', 'hopeful'].includes(event.feelingLabel)).length;
  const flatCount = timeline.filter((event) => ['flat', 'dead-end'].includes(event.feelingLabel)).length;
  const confusionCount = timeline.filter((event) => ['confusing', 'friction'].includes(event.feelingLabel)).length;
  let score = averagePulse * 0.55 + averageAgency * 0.25 + (100 - averageFriction) * 0.2;
  if (firstAliveIndex >= 0) score += Math.max(0, 10 - firstAliveIndex * 2);
  else score -= 12;
  score += Math.min(12, payoffCount * 5 + recoveryCount * 3);
  score -= Math.min(18, flatCount * 4 + confusionCount * 3);
  return Math.round(clamp(score));
}

export function recommendFeelingImprovement(arc = {}) {
  const shape = arc.arcShape;
  const counts = arc.labelCounts || {};
  if (arc.turnCount !== undefined && number(arc.turnCount, 0) === 0) return { type: 'capture-turn-data', title: 'Capture exact turn evidence before judging input feel', command: `npm run scenario:run -- --id=${arc.scenarioId || 'benchmark'}`, reason: 'The source report did not include a turn timeline.' };
  if (shape === 'flatline') return { type: 'flatline', title: 'Create visible state change earlier', command: `npm run tutor:scenario -- --id=${arc.scenarioId || 'benchmark'}`, reason: 'The emotional arc has low pulse and low variance.' };
  if (counts.confusing || counts.friction) return { type: 'friction', title: 'Remove invalid or unclear input traps', command: 'npm run setup:doctor', reason: 'Confusion or friction is dominating the felt timeline.' };
  if (shape === 'panic-loop') return { type: 'panic-loop', title: 'Add a recovery valve after pressure spikes', command: `npm run autopilot:scenario -- --id=${arc.scenarioId || 'benchmark'} --mode=single-pass`, reason: 'Panic repeats without recovery.' };
  if (shape === 'payoff-then-drift') return { type: 'payoff-then-drift', title: 'Add follow-up consequence after payoff', command: `npm run autopilot:scenario -- --id=${arc.scenarioId || 'benchmark'} --mode=single-pass`, reason: 'Payoff appears, then later turns go flat.' };
  if (arc.firstAliveTurn === null || arc.firstAliveTurn === undefined || number(arc.firstAliveTurn, 99) > 2) return { type: 'late-alive', title: 'Move meaningful choice earlier', command: `npm run tutor:scenario -- --id=${arc.scenarioId || 'benchmark'}`, reason: 'The first alive moment arrives late or not at all.' };
  if (counts['setup-doubt']) return { type: 'setup-doubt', title: 'Repair setup fidelity', command: 'npm run setup:doctor', reason: 'Unsupported setup is reducing confidence in the felt arc.' };
  return { type: 'preserve', title: 'Preserve the current strongest moment and test one focused variation', command: `npm run feel:scenario -- --id=${arc.scenarioId || 'benchmark'} --markdown`, reason: 'The arc has usable signals and no single dominant failure.' };
}

export function buildArcSummary(timeline = [], { scenarioId = '' } = {}) {
  const firstAlive = findFirstAliveTurn(timeline);
  const firstFlat = findFirstFlatTurn(timeline);
  const summary = {
    scenarioId,
    turnCount: timeline.length,
    labelCounts: labelCounts(timeline),
    polarityMix: polarityMix(timeline),
    intensityMix: intensityMix(timeline),
    firstAliveTurn: firstAlive?.turn ?? null,
    firstFlatTurn: firstFlat?.turn ?? null,
    bestMoment: momentSummary(findBestMoment(timeline)),
    worstMoment: momentSummary(findWorstMoment(timeline)),
    mostConfusingMoment: momentSummary(findMostConfusingMoment(timeline)),
    strongestAgencyMoment: momentSummary(findStrongestAgencyMoment(timeline)),
    strongestFrictionMoment: momentSummary(findStrongestFrictionMoment(timeline)),
    recoveryMoment: momentSummary(findRecoveryMoment(timeline)),
    payoffMoment: momentSummary(findPayoffMoment(timeline)),
    arcShape: detectArcShape(timeline),
    arcScore: computeArcScore(timeline),
  };
  summary.recommendedImprovement = recommendFeelingImprovement(summary);
  return summary;
}

export function buildFeelingReport(sourceReport = {}, { sourcePath = '', generatedAt = nowIso() } = {}) {
  const meta = sourceMeta(sourceReport, sourcePath);
  const timeline = buildFeelingTimeline(sourceReport, { sourcePath });
  const scenario = findScenario(loadScenarioStore(), meta.scenarioId);
  const warnings = [];
  if (timeline.length === 0) warnings.push('No turn data found in source report.');
  if (timeline.filter((event) => event.confidence < 0.5).length > timeline.length / 2 && timeline.length > 0) warnings.push('More than half of feeling events have low confidence.');
  if (sourceReport.setupLevel === 'metadata' || asArray(sourceReport.setupApplication?.skipped).length > 0) warnings.push('Unsupported or skipped setup may reduce confidence.');
  const arc = buildArcSummary(timeline, { scenarioId: meta.scenarioId });
  return {
    schemaVersion: 1,
    blackBoxVersion: FEELING_BLACK_BOX_VERSION,
    generatedAt,
    scenarioId: meta.scenarioId,
    name: scenario?.name || sourceReport.scenarioDefinition?.name || meta.scenarioId,
    designQuestion: scenario?.designQuestion || sourceReport.scenarioDefinition?.designQuestion,
    sourceReport: meta,
    turnCount: timeline.length,
    playerCount: meta.playerCount,
    timeline,
    arc,
    recommendedImprovement: arc.recommendedImprovement,
    citations: [compact({ sourcePath: meta.sourcePath, scenarioId: meta.scenarioId, generatedAt: meta.generatedAt, type: 'simulatorReport' })],
    warnings,
  };
}

function listJsonReports(target) {
  if (!existsSync(target)) return [];
  const results = [];
  const stack = [target];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = resolve(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && extname(entry.name).toLowerCase() === '.json' && /latest-report\.json$/.test(entry.name)) results.push(full);
    }
  }
  return results;
}

export function buildFeelingIndex({ reports = null } = {}) {
  const candidates = reports || unique([
    resolve(root, 'reports', 'simulator', 'latest-report.json'),
    resolve(root, 'reports', 'simulator', 'autopilot', 'latest-report.json'),
    ...listJsonReports(scenarioReportRoot),
  ]).filter((path) => existsSync(path));
  const entries = candidates.map((path) => {
    const source = readJson(path, null);
    if (!source) return null;
    const report = buildFeelingReport(source, { sourcePath: path });
    return compact({
      scenarioId: report.scenarioId,
      name: report.name,
      generatedAt: report.generatedAt,
      sourcePath: normalizePath(path),
      arcScore: report.arc.arcScore,
      arcShape: report.arc.arcShape,
      firstAliveTurn: report.arc.firstAliveTurn,
      firstFlatTurn: report.arc.firstFlatTurn,
      bestMomentLabel: report.arc.bestMoment?.label,
      worstMomentLabel: report.arc.worstMoment?.label,
      recommendation: report.recommendedImprovement,
    });
  }).filter(Boolean);
  const byScenario = new Map();
  for (const entry of entries) {
    const existing = byScenario.get(entry.scenarioId);
    const existingTime = timestamp(existing?.generatedAt);
    const entryTime = timestamp(entry.generatedAt);
    const entryIsScenarioLatest = /reports\/simulator\/scenarios\/[^/]+\/latest-report\.json$/.test(entry.sourcePath || '');
    const existingIsScenarioLatest = /reports\/simulator\/scenarios\/[^/]+\/latest-report\.json$/.test(existing?.sourcePath || '');
    const entryIsScenarioReport = /reports\/simulator\/scenarios\//.test(entry.sourcePath || '');
    const existingIsScenarioReport = /reports\/simulator\/scenarios\//.test(existing?.sourcePath || '');
    if (
      !existing
      || (entryIsScenarioLatest && !existingIsScenarioLatest)
      || (!existingIsScenarioLatest && entryTime > existingTime)
      || (!existingIsScenarioLatest && entryTime === existingTime && entryIsScenarioReport && !existingIsScenarioReport)
    ) {
      byScenario.set(entry.scenarioId, entry);
    }
  }
  const scenarios = [...byScenario.values()].sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
  return {
    schemaVersion: 1,
    blackBoxVersion: FEELING_BLACK_BOX_VERSION,
    generatedAt: nowIso(),
    scenarioCount: scenarios.length,
    scenarios,
  };
}

export function markdownForFeelingReport(report = {}) {
  const rows = asArray(report.timeline).map((event) => (
    `| ${event.turn} | ${event.action || ''} | ${event.feelingLabel} | ${event.lifePulse} | ${event.agencyScore} | ${event.frictionScore} | ${event.controlFeelNote || ''} |`
  )).join('\n') || '| none | | | | | | |';
  const citations = asArray(report.citations).map((citation) => `- ${citation.sourcePath || 'unknown'} (${citation.type || 'simulatorReport'} / ${citation.scenarioId || report.scenarioId})`).join('\n') || '- No citations.';
  return `# Player Feeling Black Box

Generated: ${report.generatedAt || 'unknown'}

Scenario: ${report.scenarioId || 'unknown'}

Arc score: ${report.arc?.arcScore ?? 'n/a'}

Arc shape: ${report.arc?.arcShape || 'unknown'}

First alive turn: ${report.arc?.firstAliveTurn ?? 'none'}

First flat turn: ${report.arc?.firstFlatTurn ?? 'none'}

## Best Moment

${report.arc?.bestMoment ? `Turn ${report.arc.bestMoment.turn}: ${report.arc.bestMoment.label} - ${report.arc.bestMoment.reason}` : 'No best moment detected.'}

## Worst Moment

${report.arc?.worstMoment ? `Turn ${report.arc.worstMoment.turn}: ${report.arc.worstMoment.label} - ${report.arc.worstMoment.reason}` : 'No worst moment detected.'}

## Strongest Agency

${report.arc?.strongestAgencyMoment ? `Turn ${report.arc.strongestAgencyMoment.turn}: ${report.arc.strongestAgencyMoment.controlFeelNote}` : 'No agency moment detected.'}

## Strongest Friction

${report.arc?.strongestFrictionMoment ? `Turn ${report.arc.strongestFrictionMoment.turn}: ${report.arc.strongestFrictionMoment.controlFeelNote}` : 'No friction moment detected.'}

## Recommendation

${report.recommendedImprovement?.title || 'No recommendation generated.'}

\`${report.recommendedImprovement?.command || 'npm run feel:doctor'}\`

## Turn Timeline

| Turn | Action | Feeling | Pulse | Agency | Friction | Control feel |
| ---: | --- | --- | ---: | ---: | ---: | --- |
${rows}

## Citations

${citations}
`;
}

export function writeFeelingReport(report, { markdown = true } = {}) {
  const global = feelingPaths();
  const scenario = feelingPaths(report.scenarioId);
  writeJson(global.latest, report);
  writeJson(global.publicLatest, report);
  writeJson(scenario.latest, report);
  writeJson(scenario.publicLatest, report);
  if (markdown) {
    mkdirSync(dirname(global.latestMarkdown), { recursive: true });
    writeFileSync(global.latestMarkdown, markdownForFeelingReport(report));
    mkdirSync(dirname(scenario.latestMarkdown), { recursive: true });
    writeFileSync(scenario.latestMarkdown, markdownForFeelingReport(report));
  }
  return { global, scenario };
}

export function writeFeelingIndex(index) {
  const paths = feelingPaths();
  writeJson(paths.index, index);
  writeJson(paths.publicIndex, index);
  return paths;
}

export function feelingDoctor({ scenarioId = null, file = null, staleDays = 14 } = {}) {
  const findings = [];
  const loaded = loadFeelingSourceReport({ file, scenarioId });
  const report = loaded.report;
  if (!report) {
    findings.push({ severity: 'warning', type: 'missing-source-report', message: 'No simulator report was found for Player Feeling Black Box.', command: scenarioId ? `npm run scenario:run -- --id=${slugify(scenarioId)}` : 'npm run sim:golden' });
    return {
      schemaVersion: 1,
      blackBoxVersion: FEELING_BLACK_BOX_VERSION,
      generatedAt: nowIso(),
      ok: true,
      warningCount: findings.length,
      infoCount: 0,
      findings,
    };
  }
  const feeling = buildFeelingReport(report, { sourcePath: loaded.sourcePath });
  if (feeling.timeline.length === 0) findings.push({ severity: 'warning', type: 'missing-turn-data', message: 'Source report has no turn timeline.' });
  const partialCount = feeling.timeline.filter((event) => !event.before?.players || !event.after?.players).length;
  if (partialCount > 0) findings.push({ severity: 'info', type: 'partial-turn-state', message: `${partialCount} feeling event(s) lack full before/after player state.` });
  if (feeling.warnings.some((warning) => /setup/i.test(warning))) findings.push({ severity: 'info', type: 'setup-confidence', message: 'Unsupported setup may reduce feeling confidence.' });
  const paths = feelingPaths(feeling.scenarioId);
  if (!existsSync(paths.publicLatest)) findings.push({ severity: 'info', type: 'missing-public-report', message: `${feeling.scenarioId} has no public feeling report.`, command: `npm run feel:scenario -- --id=${feeling.scenarioId}` });
  const latest = readJson(paths.latest, null);
  if (latest?.generatedAt && Date.now() - timestamp(latest.generatedAt) > staleDays * 24 * 60 * 60 * 1000) findings.push({ severity: 'info', type: 'stale-report', message: `${feeling.scenarioId} feeling report is older than ${staleDays} days.` });
  return {
    schemaVersion: 1,
    blackBoxVersion: FEELING_BLACK_BOX_VERSION,
    generatedAt: nowIso(),
    ok: true,
    warningCount: findings.filter((finding) => finding.severity === 'warning').length,
    infoCount: findings.filter((finding) => finding.severity === 'info').length,
    findings,
  };
}
