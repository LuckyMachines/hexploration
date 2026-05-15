import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjacentComparisons,
  bestKnownPoint,
  buildScenarioTimeMachine,
  buildScenarioTimeline,
  buildTimeMachineIndex,
  compareScenarioTimeMachine,
  dedupeTimelinePoints,
  healthForPoint,
  inferCauses,
  lastGoodPoint,
  markdownForTimeMachine,
  recommendationForTimeline,
  setupFidelityFromEvent,
  timeMachineDoctor,
  timelinePointFromEvent,
  timelineTrend,
} from './scenario-time-machine-utils.mjs';

function memory() {
  const events = [
    {
      id: 'scenario',
      type: 'scenarioDefinition',
      scenarioId: 'escape-pressure-4p',
      generatedAt: '2026-05-14T00:00:00.000Z',
      title: 'Escape Pressure 4P',
      summary: 'Does escape pressure create cooperation?',
      metrics: {},
      tags: ['escape', 'cooperation'],
      systems: ['setup'],
      evidence: {},
      sourcePath: 'simulator.scenarios.json',
      authority: 2,
    },
    {
      id: 'setup-a',
      type: 'setupReport',
      scenarioId: 'escape-pressure-4p',
      generatedAt: '2026-05-15T00:00:00.000Z',
      title: 'Setup metadata',
      summary: 'Setup reached metadata.',
      metrics: { setupLevel: 'metadata', applied: 0, skipped: 2, failed: 0 },
      tags: ['escape'],
      systems: ['landingZone'],
      evidence: { skipped: [{ field: 'landingZone', reason: 'blocked' }] },
      sourcePath: 'reports/setup.json',
      authority: 4,
    },
    {
      id: 'oracle-a',
      type: 'oracleReport',
      scenarioId: 'escape-pressure-4p',
      generatedAt: '2026-05-15T00:05:00.000Z',
      title: 'Oracle mixed',
      summary: 'Oracle score 55.',
      metrics: { weightedScore: 55, confidence: 0.5, weakestMetric: 'readability', gatePassed: false, setupLevel: 'metadata' },
      tags: ['escape', 'readability'],
      systems: ['first-meaningful-choice'],
      evidence: { verdict: 'mixed', gateFailures: ['setup blocked'], smallestNextExperiment: { title: 'Repair setup', verificationCommand: 'npm run setup:doctor' } },
      sourcePath: 'reports/oracle-a.json',
      authority: 5,
    },
    {
      id: 'autopilot-a',
      type: 'autopilotReport',
      scenarioId: 'escape-pressure-4p',
      generatedAt: '2026-05-15T00:08:00.000Z',
      title: 'Reduce setup dependence',
      summary: 'Autopilot planned setup repair.',
      metrics: { baselineScore: 55, finalScore: 60, scoreDelta: 5, accepted: true },
      tags: ['escape'],
      systems: ['scenario-setup'],
      evidence: { finalVerdict: 'improved', selectedChange: { title: 'Reduce setup dependence', changeType: 'scenario-setup' }, rejectedReasons: [] },
      sourcePath: 'reports/autopilot.json',
      authority: 4,
    },
    {
      id: 'oracle-b',
      type: 'oracleReport',
      scenarioId: 'escape-pressure-4p',
      generatedAt: '2026-05-15T00:20:00.000Z',
      title: 'Oracle pass',
      summary: 'Oracle score 74.',
      metrics: { weightedScore: 74, confidence: 0.72, weakestMetric: 'pacing', gatePassed: true, setupLevel: 'partial' },
      tags: ['escape', 'pacing'],
      systems: ['first-recovery'],
      evidence: { verdict: 'pass', gateFailures: [], smallestNextExperiment: { title: 'Improve pacing', verificationCommand: 'npm run autopilot:scenario -- --id=escape-pressure-4p' } },
      sourcePath: 'reports/oracle-b.json',
      authority: 5,
    },
  ];
  return {
    generatedAt: '2026-05-15T00:30:00.000Z',
    scenarios: [{ scenarioId: 'escape-pressure-4p', name: 'Escape Pressure 4P', designQuestion: 'Does escape pressure create cooperation?' }],
    events,
  };
}

test('turns memory events into timeline points with health', () => {
  const point = timelinePointFromEvent(memory().events[2]);
  assert.equal(point.sourceType, 'oracleReport');
  assert.equal(point.oracle.weightedScore, 55);
  assert.ok(point.health.score < 55);
  assert.ok(point.health.reasons.length > 0);
});

test('scores setup fidelity conservatively', () => {
  const fidelity = setupFidelityFromEvent(memory().events[1]);
  assert.ok(fidelity > 0);
  assert.ok(fidelity < 0.5);
});

test('dedupes and sorts timeline points', () => {
  const point = timelinePointFromEvent(memory().events[2]);
  const duplicate = { ...point, id: 'different' };
  const deduped = dedupeTimelinePoints([duplicate, point]);
  assert.equal(deduped.length, 1);
});

test('builds scenario timeline and adjacent comparisons', () => {
  const timeline = buildScenarioTimeline(memory(), 'escape-pressure-4p');
  assert.equal(timeline.length, 5);
  const comparisons = adjacentComparisons(timeline);
  assert.equal(comparisons.length, 4);
  assert.ok(comparisons.some((comparison) => comparison.delta.health > 0));
});

test('detects best known, last good, and trend', () => {
  const timeline = buildScenarioTimeline(memory(), 'escape-pressure-4p');
  assert.equal(bestKnownPoint(timeline).id, 'oracle-b');
  assert.equal(lastGoodPoint(timeline).id, 'oracle-b');
  assert.equal(timelineTrend(timeline), 'improving');
});

test('infers causes near movement', () => {
  const timeline = buildScenarioTimeline(memory(), 'escape-pressure-4p');
  const comparison = adjacentComparisons(timeline).at(-1);
  const causes = inferCauses(timeline, comparison);
  assert.ok(causes.length > 0);
  assert.ok(causes.every((cause) => cause.inference));
});

test('builds full scenario time machine report', () => {
  const report = buildScenarioTimeMachine({ scenarioId: 'escape-pressure-4p', memory: memory(), includeRaw: true });
  assert.equal(report.scenarioId, 'escape-pressure-4p');
  assert.equal(report.trend, 'improving');
  assert.ok(report.bestKnown);
  assert.ok(report.comparisons.latestVsPrevious);
  assert.ok(markdownForTimeMachine(report).includes('Scenario Time Machine'));
});

test('compares scenario against best and last-good modes', () => {
  const best = compareScenarioTimeMachine({ scenarioId: 'escape-pressure-4p', against: 'best', memory: memory() });
  const lastGood = compareScenarioTimeMachine({ scenarioId: 'escape-pressure-4p', against: 'last-good', memory: memory() });
  assert.equal(best.scenarioId, 'escape-pressure-4p');
  assert.equal(lastGood.scenarioId, 'escape-pressure-4p');
});

test('generates recommendations for blocked and weak timelines', () => {
  const timeline = buildScenarioTimeline(memory(), 'escape-pressure-4p');
  const recommendation = recommendationForTimeline({ scenarioId: 'escape-pressure-4p', timeline, trend: 'stable', memory: memory() });
  assert.ok(recommendation.title);
  assert.ok(recommendation.command);
});

test('builds index and doctor report', () => {
  const index = buildTimeMachineIndex({ memory: memory() });
  assert.equal(index.scenarioCount, 1);
  const doctor = timeMachineDoctor({ memory: memory() });
  assert.equal(doctor.ok, true);
  assert.ok(Array.isArray(doctor.findings));
});

test('health handles simulator penalties', () => {
  const health = healthForPoint({ simulator: { lifeScore: 80, flatTurnRate: 0.8, invalidAttempts: 3, zeroStatPlayers: 1 } });
  assert.ok(health.score < 80);
});
