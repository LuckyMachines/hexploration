import { existsSync } from 'fs';
import { resolve } from 'path';
import { readJson, root, writeJson } from './scenario-utils.mjs';

export const FUN_REPORT_VERSION = '1.0.0';
export const funReportRoot = resolve(root, 'reports', 'fun');
export const publicFunRoot = resolve(root, 'app', 'public', 'fun');

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function funReportPaths() {
  return {
    latest: resolve(funReportRoot, 'latest-report.json'),
    publicLatest: resolve(publicFunRoot, 'latest-report.json'),
  };
}

export function loadFunEvidence({ eventsFile = null } = {}) {
  return {
    events: eventsFile && existsSync(resolve(root, eventsFile)) ? readJson(resolve(root, eventsFile), []) : [],
    feelingIndex: readJson(resolve(root, 'reports', 'simulator', 'feeling-black-box', 'index.json'), null),
    growthReport: readJson(resolve(root, 'reports', 'growth', 'latest-report.json'), null),
    timeMachineIndex: readJson(resolve(root, 'reports', 'simulator', 'time-machine', 'index.json'), null),
  };
}

export function qualityFromFeelingScenario(scenario = {}) {
  const arcScore = number(scenario.arcScore);
  const firstAlive = scenario.firstAliveTurn;
  const firstFlat = scenario.firstFlatTurn;
  const payoff = ['payoff', 'surprise'].includes(scenario.bestMomentLabel);
  const pressure = ['panic', 'friction', 'dead-end'].includes(scenario.worstMomentLabel);
  const gates = {
    firstAlive: firstAlive !== undefined && firstAlive !== null && number(firstAlive, 99) <= 2,
    payoff: payoff || arcScore >= 65,
    pressure: pressure || arcScore < 55,
    recovery: scenario.recommendation?.type !== 'panic-loop',
    flatStreak: firstFlat === undefined || firstFlat === null || number(firstFlat, 99) > 1,
    shareWorthy: arcScore >= 60 || payoff,
  };
  const passed = Object.values(gates).filter(Boolean).length;
  return {
    scenarioId: scenario.scenarioId,
    arcScore,
    arcShape: scenario.arcShape,
    firstAliveTurn: firstAlive ?? null,
    firstFlatTurn: firstFlat ?? null,
    gates,
    funVerdict: passed >= 5 ? 'share-worthy' : passed >= 4 ? 'nearly-there' : passed >= 2 ? 'needs-spark' : 'flat',
    releaseBlockers: Object.entries(gates).filter(([, pass]) => !pass).map(([gate]) => gate),
    recommendation: scenario.recommendation || null,
  };
}

export function buildFunReport({ events = [], feelingIndex = null, growthReport = null, timeMachineIndex = null, generatedAt = nowIso() } = {}) {
  const scenarioQualities = asArray(feelingIndex?.scenarios).map(qualityFromFeelingScenario);
  const shareEvents = events.filter((event) => ['share_card_generated', 'share_clicked'].includes(event.type));
  const completedEvents = events.filter((event) => event.type === 'run_completed');
  const releaseBlockers = [
    ...scenarioQualities.flatMap((item) => item.releaseBlockers.map((gate) => ({ scenarioId: item.scenarioId, gate }))).slice(0, 12),
    ...asArray(timeMachineIndex?.scenarios).filter((item) => item.trend === 'regressing').map((item) => ({ scenarioId: item.scenarioId, gate: 'regressing' })),
  ];
  const strongest = [...scenarioQualities].sort((a, b) => b.arcScore - a.arcScore)[0] || null;
  const weakest = [...scenarioQualities].sort((a, b) => a.arcScore - b.arcScore)[0] || null;
  const nextFix = weakest?.recommendation
    ? {
      title: weakest.recommendation.title,
      command: weakest.recommendation.command,
      reason: weakest.recommendation.reason,
    }
    : growthReport?.nextExperiment || {
      title: 'Capture a public fun run',
      command: 'Open /play, complete a run, generate a share card, then run npm run fun:report.',
      reason: 'No fun evidence exists yet.',
    };
  return {
    schemaVersion: 1,
    funReportVersion: FUN_REPORT_VERSION,
    generatedAt,
    projectFunVerdict: releaseBlockers.length === 0 && (shareEvents.length > 0 || strongest?.arcScore >= 65) ? 'feature-ready' : releaseBlockers.length <= 2 ? 'nearly-ready' : 'needs-fun-work',
    metrics: {
      completedRuns: completedEvents.length,
      shareEvents: shareEvents.length,
      feelingScenarios: scenarioQualities.length,
      releaseBlockerCount: releaseBlockers.length,
    },
    scenarioQualities,
    strongestFunScenario: strongest,
    weakestFunScenario: weakest,
    releaseBlockers,
    nextFunFix: nextFix,
  };
}

export function markdownForFunReport(report = {}) {
  const scenarios = asArray(report.scenarioQualities).map((item) => `- ${item.scenarioId}: ${item.funVerdict}, arc ${item.arcScore}, blockers ${item.releaseBlockers.join(', ') || 'none'}`).join('\n') || '- No scenario fun evidence yet.';
  return `# Fun Report

Generated: ${report.generatedAt || 'unknown'}

Project verdict: ${report.projectFunVerdict || 'unknown'}

## Metrics

- Completed runs: ${report.metrics?.completedRuns ?? 0}
- Share events: ${report.metrics?.shareEvents ?? 0}
- Feeling scenarios: ${report.metrics?.feelingScenarios ?? 0}
- Release blockers: ${report.metrics?.releaseBlockerCount ?? 0}

## Scenario Gates

${scenarios}

## Next Fun Fix

${report.nextFunFix?.title || 'No fun fix generated.'}

\`${report.nextFunFix?.command || 'npm run fun:report'}\`

${report.nextFunFix?.reason || ''}
`;
}

export function writeFunReport(report) {
  const paths = funReportPaths();
  writeJson(paths.latest, report);
  writeJson(paths.publicLatest, report);
  return paths;
}
