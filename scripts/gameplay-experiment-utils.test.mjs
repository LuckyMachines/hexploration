import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePairedReports } from './gameplay-experiment-utils.mjs';

function report(delta = 0, seedPrefix = 'paired') {
  return {
    simulationContract: { evaluationHash: 'immutable-rubric-v1' },
    runs: Array.from({ length: 10 }, (_, index) => ({
      config: { strategy: 'balanced', runIndex: index + 1, seed: `${seedPrefix}:balanced:${index + 1}` },
      summary: {
        totalArtifacts: 1 + delta,
        revealedZonesGained: 2 + delta,
        meaningfulChoiceDensity: 0.6 + delta * 0.05,
        decisionEntropy: 0.7,
        consequenceVisibility: 0.8,
        invalidAttempts: 0,
        zeroStatPlayers: 0,
      },
      funDebugger: { averageLifeScore: 60 + delta * 5, flatTurnRate: 0.3 - delta * 0.1 },
    })),
  };
}

test('compares same-seed reports as paired evidence', () => {
  const result = comparePairedReports(report(0), report(1));
  assert.equal(result.passed, true);
  assert.equal(result.pairs, 10);
  assert.equal(result.metrics.lifeScore.meanDelta, 5);
});

test('rejects underpowered or mismatched comparisons', () => {
  const underpowered = { runs: report(0).runs.slice(0, 2) };
  const result = comparePairedReports(underpowered, { runs: report(1, 'other').runs.slice(0, 2) });
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((failure) => failure.includes('seed mismatch')));
  assert.ok(result.failures.some((failure) => failure.includes('paired replicates')));
});

test('uses a pre-registered primary metric to make a bounded decision', () => {
  const result = comparePairedReports(report(0), report(1), {
    primaryMetric: 'lifeScore',
    primaryDirection: 'increase',
    minimumEffect: 1,
  });
  assert.equal(result.primaryPassed, true);
  assert.equal(result.decision, 'accepted');
});

test('can measure a paired reduction in flat pacing', () => {
  const result = comparePairedReports(report(0), report(1), {
    primaryMetric: 'flatTurnRate',
    primaryDirection: 'decrease',
    minimumEffect: 0.05,
  });
  assert.ok(Math.abs(result.metrics.flatTurnRate.meanDelta + 0.1) < 1e-9);
  assert.equal(result.primaryPassed, true);
  assert.equal(result.decision, 'accepted');
});
