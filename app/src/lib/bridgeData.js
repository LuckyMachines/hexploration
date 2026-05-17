export const BRIDGE_VERDICT_LABELS = {
  'featured-ready': 'Featured ready',
  'playable-with-caveats': 'Playable with caveats',
  'needs-fun-work': 'Needs more fun',
  'blocked-by-setup': 'Setup blocked',
  regressing: 'Regressing',
  'missing-evidence': 'Missing evidence',
};

export function readinessTone(verdict) {
  if (verdict === 'featured-ready') return 'green';
  if (verdict === 'playable-with-caveats') return 'gold';
  if (verdict === 'needs-fun-work' || verdict === 'missing-evidence') return 'blue';
  return 'red';
}

export function publicVerdictLabel(verdict) {
  return BRIDGE_VERDICT_LABELS[verdict] || 'Evidence pending';
}

async function fetchJson(path) {
  if (typeof fetch !== 'function') return null;
  try {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchBridgeReport() {
  return fetchJson('/bridge/latest-report.json');
}

export async function fetchScenarioReadiness(scenarioId) {
  if (!scenarioId) return null;
  return fetchJson(`/bridge/${encodeURIComponent(scenarioId)}/readiness.json`);
}

export function selectFeaturedScenario(report) {
  if (!report) return null;
  return report.featuredScenario
    || (report.scenarios || []).find((scenario) => scenario.gateVerdict === 'featured-ready')
    || (report.scenarios || []).find((scenario) => scenario.gateVerdict === 'playable-with-caveats')
    || null;
}

export function selectChallengeScenario(report) {
  if (!report) return null;
  return report.challengeScenario || selectFeaturedScenario(report);
}

export function readinessForScenario(report, scenarioId) {
  if (!report || !scenarioId) return null;
  return (report.scenarios || []).find((scenario) => scenario.scenarioId === scenarioId) || null;
}

export function scenarioRouteFromBridge(readiness, fallback = '/play') {
  if (!readiness?.scenarioId) return fallback;
  return readiness.publicRoute || `/play?scenario=${encodeURIComponent(readiness.scenarioId)}`;
}

export function challengeRouteFromBridge(readiness, fallback = '/challenge') {
  if (!readiness?.scenarioId) return fallback;
  return readiness.challengeRoute || `/challenge?scenario=${encodeURIComponent(readiness.scenarioId)}&seed=${encodeURIComponent(readiness.challengeSeed || 'bridge-challenge')}`;
}

export function bridgeDevlogEntries(report) {
  return (report?.scenarios || []).map((scenario) => ({
    id: `${scenario.scenarioId}-bridge-note`,
    title: `${scenario.name}: ${publicVerdictLabel(scenario.gateVerdict)}`,
    body: `${scenario.readinessScore ?? 0}/100 readiness. ${(scenario.blockers || [])[0]?.message || (scenario.warnings || [])[0]?.message || (scenario.reasons || [])[0] || 'Evidence is ready to review.'}`,
    next: scenario.nextFix?.title || 'Refresh bridge evidence',
    command: scenario.nextFix?.command || 'npm run bridge:build',
  }));
}

export function mergeReadinessIntoProgress(progress = [], report = null) {
  return progress.map((item) => {
    const readiness = readinessForScenario(report, item.scenarioId);
    return {
      ...item,
      bridgeReadiness: readiness,
      latestArcScore: item.latestArcScore ?? readiness?.evidence?.feeling?.arcScore,
      latestArcShape: item.latestArcShape ?? readiness?.evidence?.feeling?.arcShape,
      trend: readiness?.evidence?.timeMachine?.trend || item.trend,
      nextExperiment: readiness?.nextFix?.title || item.nextExperiment,
    };
  });
}
