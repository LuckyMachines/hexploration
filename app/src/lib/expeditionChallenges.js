import { LIVE_PLAY_URL } from './internalTools';
import { memoryStats } from './expeditionMemory';

function livePlayPath() {
  return LIVE_PLAY_URL;
}

function scoreTarget(memory = {}) {
  return Math.max(100, Number(memory.score || memory.challengeScore || 0) + 25);
}

export function deriveNextChallenge(memory = {}, latestOverride = null) {
  const stats = memoryStats(memory);
  const latest = latestOverride || stats.latest;
  if (!latest) {
    return {
      id: 'first-memory',
      title: 'Create the first memory',
      target: 'Finish any expedition and lock in a benchmark.',
      reason: 'A second run needs a first record to beat.',
      reward: 'First Memory badge path',
      path: livePlayPath(),
      metric: 'completion',
      targetValue: 1,
    };
  }
  if (latest.outcome !== 'escaped') {
    return {
      id: `bring-home-${latest.id}`,
      title: 'Bring the warning home',
      target: latest.artifacts > 0 ? `Escape with at least ${latest.artifacts} recovered value.` : 'Escape with at least one survivor.',
      reason: latest.insight || 'The last memory is a warning, not a victory.',
      reward: 'Escaped',
      path: livePlayPath(latest),
      metric: latest.artifacts > 0 ? 'escaped-artifacts' : 'survivors',
      targetValue: Math.max(1, latest.artifacts || latest.survivors || 1),
    };
  }
  if (latest.escapeCostLevel !== 'clean') {
    return {
      id: `cleaner-${latest.id}`,
      title: 'Lower the departure cost',
      target: `Beat ${latest.escapeCostLabel || 'the last cost'} and escape below pressure ${Math.max(35, latest.finalPressure - 10)}.`,
      reason: 'The last run got out, but the cost was still the story.',
      reward: 'Clean Departure',
      path: livePlayPath(latest),
      metric: 'pressure-under',
      targetValue: Math.max(35, latest.finalPressure - 10),
    };
  }
  if ((latest.artifacts || 0) <= 0) {
    return {
      id: `value-${latest.id}`,
      title: 'Carry value out',
      target: 'Escape with at least one artifact or recovered value.',
      reason: 'The route was clean, but the record needs a prize.',
      reward: 'Artifact Lift',
      path: livePlayPath(latest),
      metric: 'artifacts',
      targetValue: 1,
    };
  }
  if ((latest.finalPressure || 0) < 65 && stats.bestScore <= latest.score + 10) {
    return {
      id: `greed-${latest.id}`,
      title: 'Push one turn deeper',
      target: `Beat score ${scoreTarget(latest)} without losing a clean departure.`,
      reason: 'The latest memory is stable enough to become a greed benchmark.',
      reward: 'Best Score',
      path: livePlayPath(latest),
      metric: 'score',
      targetValue: scoreTarget(latest),
    };
  }
  return {
    id: `beat-score-${latest.id}`,
    title: 'Beat this expedition',
    target: `Score ${scoreTarget(stats.best || latest)} or bring home more than ${stats.valueBest?.artifacts || latest.artifacts || 0} value.`,
    reason: 'The memory log now has a benchmark worth chasing.',
    reward: 'New Personal Best',
    path: livePlayPath(latest),
    metric: 'score-or-value',
    targetValue: scoreTarget(stats.best || latest),
  };
}

export function challengeSummary(challenge = {}) {
  return `${challenge.title}: ${challenge.target}`;
}
