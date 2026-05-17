import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGrowthReport,
  markdownForGrowthReport,
} from './growth-report-utils.mjs';

test('builds growth metrics and next experiment from events', () => {
  const report = buildGrowthReport({
    events: [
      { type: 'run_started', scenarioId: 'solo-artifact-hunt' },
      { type: 'run_completed', scenarioId: 'solo-artifact-hunt', arcScore: 70 },
      { type: 'share_card_generated', scenarioId: 'solo-artifact-hunt' },
      { type: 'replay_opened', scenarioId: 'solo-artifact-hunt' },
      { type: 'scenario_created', scenarioId: 'custom' },
    ],
    feelingIndex: {
      scenarios: [
        { scenarioId: 'escape-pressure-4p', arcScore: 32, arcShape: 'flatline', recommendation: { command: 'npm run feel:scenario -- --id=escape-pressure-4p' } },
      ],
    },
  });
  assert.equal(report.metrics.runStarts, 1);
  assert.equal(report.metrics.runCompletions, 1);
  assert.equal(report.metrics.shareEvents, 1);
  assert.equal(report.topScenarios[0].shareEvents, 1);
  assert.equal(report.topScenarios[0].replayOpens, 1);
  assert.equal(report.nextExperiment.type, 'feeling');
  assert.match(markdownForGrowthReport(report), /Growth Report/);
});

test('falls back to capture recommendation when evidence is empty', () => {
  const report = buildGrowthReport({});
  assert.equal(report.nextExperiment.type, 'capture');
  assert.equal(report.metrics.runStarts, 0);
});
