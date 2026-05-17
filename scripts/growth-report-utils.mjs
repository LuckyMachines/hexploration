import { existsSync } from 'fs';
import { resolve } from 'path';
import { readJson, root, writeJson } from './scenario-utils.mjs';

export const GROWTH_REPORT_VERSION = '1.0.0';
export const growthReportRoot = resolve(root, 'reports', 'growth');
export const publicGrowthRoot = resolve(root, 'app', 'public', 'growth');

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function countBy(items = [], keyFn = (item) => item) {
  return items.reduce((counts, item) => {
    const key = keyFn(item) || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pct(numerator, denominator) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) / 100 : 0;
}

export function growthReportPaths() {
  return {
    latest: resolve(growthReportRoot, 'latest-report.json'),
    publicLatest: resolve(publicGrowthRoot, 'latest-report.json'),
  };
}

export function loadGrowthEvidence({ eventsFile = null } = {}) {
  return {
    events: eventsFile && existsSync(resolve(root, eventsFile)) ? readJson(resolve(root, eventsFile), []) : [],
    feelingIndex: readJson(resolve(root, 'reports', 'simulator', 'feeling-black-box', 'index.json'), null),
    timeMachineIndex: readJson(resolve(root, 'reports', 'simulator', 'time-machine', 'index.json'), null),
    labIndex: readJson(resolve(root, 'reports', 'simulator', 'lab-notebook', 'index.json'), null),
  };
}

export function buildGrowthReport({ events = [], feelingIndex = null, timeMachineIndex = null, labIndex = null, generatedAt = nowIso() } = {}) {
  const starts = events.filter((event) => event.type === 'run_started');
  const completions = events.filter((event) => event.type === 'run_completed');
  const shares = events.filter((event) => event.type === 'share_card_generated' || event.type === 'share_clicked');
  const replays = events.filter((event) => event.type === 'replay_opened');
  const feedback = events.filter((event) => event.type === 'feedback_submitted');
  const created = events.filter((event) => event.type === 'scenario_created');
  const scenarioCounts = countBy([...starts, ...completions], (event) => event.scenarioId);
  const completionByScenario = countBy(completions, (event) => event.scenarioId);
  const shareByScenario = countBy(shares, (event) => event.scenarioId);
  const replayByScenario = countBy(replays, (event) => event.scenarioId);
  const topScenarios = Object.entries(scenarioCounts)
    .map(([scenarioId, count]) => ({
      scenarioId,
      startsOrEvidence: count,
      completions: completionByScenario[scenarioId] || 0,
      shareEvents: shareByScenario[scenarioId] || 0,
      replayOpens: replayByScenario[scenarioId] || 0,
      completionRate: pct(completionByScenario[scenarioId] || 0, starts.filter((event) => event.scenarioId === scenarioId).length),
      arcScore: feelingIndex?.scenarios?.find((item) => item.scenarioId === scenarioId)?.arcScore,
      trend: timeMachineIndex?.scenarios?.find((item) => item.scenarioId === scenarioId)?.trend,
      readiness: labIndex?.scenarios?.find((item) => item.scenarioId === scenarioId)?.readiness?.status,
    }))
    .sort((a, b) => b.completions - a.completions || b.startsOrEvidence - a.startsOrEvidence);
  const weakestFeeling = asArray(feelingIndex?.scenarios)
    .filter((item) => item.arcScore !== undefined)
    .sort((a, b) => number(a.arcScore) - number(b.arcScore))[0] || null;
  const regressing = asArray(timeMachineIndex?.scenarios).filter((item) => item.trend === 'regressing');
  const nextExperiment = weakestFeeling
    ? {
      type: 'feeling',
      title: `Improve shareability by fixing ${weakestFeeling.scenarioId} feel`,
      command: weakestFeeling.recommendation?.command || `npm run feel:scenario -- --id=${weakestFeeling.scenarioId}`,
      reason: `Lowest known feeling arc is ${weakestFeeling.arcShape || 'unknown'} at ${weakestFeeling.arcScore}.`,
    }
    : regressing[0]
      ? {
        type: 'regression',
        title: `Recover ${regressing[0].scenarioId} before featuring it`,
        command: `npm run time-machine:compare -- --id=${regressing[0].scenarioId} --against=last-good --markdown`,
        reason: 'A regressing scenario should not be promoted until the evidence stabilizes.',
      }
      : {
        type: 'capture',
        title: 'Capture the first public completed run',
        command: 'Open /play, complete a run, generate a share card, then run npm run growth:report.',
        reason: 'Growth reporting needs completed-run events or tuning evidence.',
      };
  return {
    schemaVersion: 1,
    growthReportVersion: GROWTH_REPORT_VERSION,
    generatedAt,
    northStarMetric: 'shared completed runs per week',
    metrics: {
      runStarts: starts.length,
      runCompletions: completions.length,
      completionRate: pct(completions.length, starts.length),
      shareEvents: shares.length,
      replayOpens: replays.length,
      feedbackSubmitted: feedback.length,
      scenarioCreated: created.length,
    },
    scenarioCounts,
    topScenarios,
    weakestFeeling,
    regressingScenarios: regressing,
    evidenceCounts: {
      feelingScenarios: asArray(feelingIndex?.scenarios).length,
      timeMachineScenarios: asArray(timeMachineIndex?.scenarios).length,
      labScenarios: asArray(labIndex?.scenarios).length,
    },
    nextExperiment,
  };
}

export function markdownForGrowthReport(report = {}) {
  const scenarios = asArray(report.topScenarios).map((item) => `- ${item.scenarioId}: completions ${item.completions}, starts/evidence ${item.startsOrEvidence}, arc ${item.arcScore ?? 'n/a'}, trend ${item.trend || 'n/a'}`).join('\n') || '- No scenario evidence yet.';
  return `# Growth Report

Generated: ${report.generatedAt || 'unknown'}

North star: ${report.northStarMetric}

## Metrics

- Run starts: ${report.metrics?.runStarts ?? 0}
- Run completions: ${report.metrics?.runCompletions ?? 0}
- Completion rate: ${report.metrics?.completionRate ?? 0}
- Share events: ${report.metrics?.shareEvents ?? 0}
- Replay opens: ${report.metrics?.replayOpens ?? 0}
- Feedback submitted: ${report.metrics?.feedbackSubmitted ?? 0}
- Scenarios created: ${report.metrics?.scenarioCreated ?? 0}

## Top Scenarios

${scenarios}

## Next Growth Experiment

${report.nextExperiment?.title || 'No experiment generated.'}

\`${report.nextExperiment?.command || 'npm run growth:report'}\`

${report.nextExperiment?.reason || ''}
`;
}

export function writeGrowthReport(report) {
  const paths = growthReportPaths();
  writeJson(paths.latest, report);
  writeJson(paths.publicLatest, report);
  return paths;
}
