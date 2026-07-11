import {
  badgesForMemory,
  canonicalEntry,
  deriveMemoryInsight,
  scoreExpeditionMemory,
} from './expeditionMemory';
import { replayPathForRun, summarizeGrowthRun } from './growthLoop';

function nowIso() {
  return new Date().toISOString();
}

export function memoryFromGrowthRun(run = {}) {
  const summary = run.summary || summarizeGrowthRun(run);
  const base = {
    source: 'public-run',
    sourceId: run.id,
    scenarioId: summary.scenarioId || run.scenario?.id,
    scenarioName: summary.scenarioName || run.scenario?.name,
    seed: summary.seed || run.seed,
    title: summary.runTitle || `${summary.scenarioName} Memory`,
    outcome: summary.outcome || run.outcome,
    arcScore: summary.arcScore,
    challengeScore: summary.challengeScore,
    arcLabel: summary.strongestArc?.label || summary.arcShape,
    arcShape: summary.arcShape,
    finalPressure: summary.departPressure,
    escapeCostLevel: summary.escapeCostPreview?.level,
    escapeCostLabel: summary.escapeCostPreview?.label || summary.escapeCostPreview?.reportLabel,
    artifacts: summary.artifacts,
    artifactNames: summary.artifactNames,
    turns: summary.turns,
    survivors: summary.savedPlayers || (run.outcome === 'escaped' ? run.scenario?.players || 1 : 0),
    crew: run.scenario?.players || 1,
    bestMoment: summary.bestAftermath || summary.bestMoment || null,
    bestMomentLabel: summary.bestAftermath?.title || summary.bestMoment?.momentTitle || summary.bestMoment?.feelingLabel || null,
    fingerprint: summary.fingerprint || null,
    replayPath: replayPathForRun(run),
    badges: summary.badges,
    timestamp: run.completedAt || nowIso(),
  };
  const score = scoreExpeditionMemory(base);
  const entry = canonicalEntry({ ...base, score, badges: badgesForMemory({ ...base, score }) });
  return { ...entry, insight: deriveMemoryInsight(entry) };
}
