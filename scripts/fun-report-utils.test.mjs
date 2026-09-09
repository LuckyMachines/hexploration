import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFunReport,
  markdownForFunReport,
  qualityFromFeelingScenario,
} from './fun-report-utils.mjs';

test('scores scenario fun gates from feeling evidence', () => {
  const quality = qualityFromFeelingScenario({
    scenarioId: 'solo-artifact-hunt',
    arcScore: 72,
    arcShape: 'rising',
    firstAliveTurn: 1,
    firstFlatTurn: null,
    bestMomentLabel: 'payoff',
    worstMomentLabel: 'panic',
  });
  assert.equal(quality.funVerdict, 'share-worthy');
  assert.equal(quality.releaseBlockers.length, 0);
});

test('applies tension and payoff gates only to scenarios that promise them', () => {
  const exploration = qualityFromFeelingScenario({
    scenarioId: 'opening', arcScore: 70, arcShape: 'rising', firstAliveTurn: 1,
  }, { tags: ['exploration'] });
  const escape = qualityFromFeelingScenario({
    scenarioId: 'escape', arcScore: 70, arcShape: 'rising', firstAliveTurn: 1,
    labelCounts: { tense: 1, recovery: 1 }, tensionProfile: { pressureCount: 1, recoveredAfterPressure: true },
  }, { tags: ['escape', 'survival'] });
  assert.equal(exploration.gates.pressure, true);
  assert.equal(exploration.gates.payoff, true);
  assert.equal(escape.gates.pressure, true);
  assert.equal(escape.gates.recovery, true);
});

test('does not mistake a high score for artifact payoff evidence', () => {
  const quality = qualityFromFeelingScenario({
    scenarioId: 'artifact', arcScore: 90, arcShape: 'rising', firstAliveTurn: 1,
  }, { tags: ['artifact'] });
  assert.equal(quality.gates.payoff, false);
  assert.ok(quality.releaseBlockers.includes('payoff'));
});

test('builds project fun report and markdown', () => {
  const report = buildFunReport({
    events: [{ type: 'run_completed' }, { type: 'share_card_generated' }],
    feelingIndex: {
      scenarios: [
        { scenarioId: 'weak', arcScore: 30, arcShape: 'flatline', recommendation: { title: 'Create payoff', command: 'npm run feel:scenario -- --id=weak', reason: 'flat' } },
        { scenarioId: 'strong', arcScore: 74, firstAliveTurn: 1, bestMomentLabel: 'payoff' },
      ],
    },
  });
  assert.equal(report.metrics.completedRuns, 1);
  assert.equal(report.nextFunFix.title, 'Create payoff');
  assert.match(markdownForFunReport(report), /Fun Report/);
});

test('keeps generated fixtures out of production release scoring', () => {
  const report = buildFunReport({
    feelingIndex: {
      scenarios: [
        { scenarioId: 'autopilot-test-flat', arcScore: 0, arcShape: 'flatline' },
        { scenarioId: 'solo-artifact-hunt', arcScore: 72, firstAliveTurn: 1, bestMomentLabel: 'payoff' },
      ],
    },
    scenarioStore: {
      scenarios: [{ id: 'solo-artifact-hunt', archived: false, productionEligible: true }],
    },
  });
  assert.deepEqual(report.scenarioQualities.map((item) => item.scenarioId), ['solo-artifact-hunt']);
  assert.equal(report.evidenceHygiene.excludedCount, 1);
});
