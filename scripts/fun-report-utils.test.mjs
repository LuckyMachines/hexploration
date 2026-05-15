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
