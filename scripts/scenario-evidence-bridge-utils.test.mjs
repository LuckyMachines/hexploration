import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBridgePublicPayload,
  buildBridgeReport,
  buildScenarioReadiness,
} from './scenario-evidence-bridge-utils.mjs';

function scenario(id = 'solo-artifact-hunt', extra = {}) {
  return {
    id,
    name: id,
    players: 1,
    turns: 6,
    tags: ['solo', 'artifact'],
    targetArcScore: 64,
    ...extra,
  };
}

function evidenceFor(rows = {}) {
  return {
    scenarioStore: { scenarios: [scenario('solo-artifact-hunt'), scenario('escape-pressure-4p', { tags: ['escape', 'cooperation', 'survival'] })] },
    feelingIndex: { scenarios: rows.feeling || [] },
    timeMachineIndex: { scenarios: rows.timeMachine || [] },
    labIndex: { scenarios: rows.lab || [] },
    funReport: { scenarioQualities: rows.fun || [] },
    growthReport: { topScenarios: rows.growth || [] },
    oracleIndex: { scenarios: rows.oracle || [] },
    setupIndex: { scenarios: rows.setup || [] },
  };
}

test('scores a strong scenario as featured ready', () => {
  const readiness = buildScenarioReadiness({
    scenario: scenario(),
    evidence: evidenceFor({
      feeling: [{ scenarioId: 'solo-artifact-hunt', arcScore: 82, arcShape: 'rising', firstAliveTurn: 1, bestMomentLabel: 'payoff', generatedAt: '2026-05-17T00:00:00.000Z' }],
      timeMachine: [{ scenarioId: 'solo-artifact-hunt', trend: 'improving', latestHealth: 80, timelineCount: 3 }],
      lab: [{ scenarioId: 'solo-artifact-hunt', readiness: { status: 'ready' }, unresolvedCount: 0 }],
      fun: [{ scenarioId: 'solo-artifact-hunt', funVerdict: 'share-worthy', arcScore: 82, firstAliveTurn: 1, gates: { recovery: true, shareWorthy: true }, shareWorthyMoment: { feelingLabel: 'payoff' } }],
      growth: [{ scenarioId: 'solo-artifact-hunt', completions: 2, shareEvents: 1 }],
    }),
    generatedAt: '2026-05-17T00:00:00.000Z',
  });
  assert.equal(readiness.gateVerdict, 'featured-ready');
  assert.equal(readiness.eligible, true);
  assert.ok(readiness.readinessScore >= 78);
});

test('blocks regressing scenarios', () => {
  const readiness = buildScenarioReadiness({
    scenario: scenario(),
    evidence: evidenceFor({
      feeling: [{ scenarioId: 'solo-artifact-hunt', arcScore: 90, firstAliveTurn: 1, bestMomentLabel: 'payoff' }],
      timeMachine: [{ scenarioId: 'solo-artifact-hunt', trend: 'regressing', timelineCount: 4 }],
    }),
  });
  assert.equal(readiness.gateVerdict, 'regressing');
  assert.equal(readiness.eligible, false);
  assert.ok(readiness.nextFix.command.includes('time-machine:compare'));
});

test('reports missing evidence without throwing', () => {
  const readiness = buildScenarioReadiness({ scenario: scenario(), evidence: evidenceFor() });
  assert.equal(readiness.gateVerdict, 'missing-evidence');
  assert.ok(readiness.nextFix.command.includes('scenario:run'));
});

test('builds public report payload with featured and challenge routes', () => {
  const report = buildBridgeReport({
    evidence: evidenceFor({
      feeling: [
        { scenarioId: 'solo-artifact-hunt', arcScore: 82, firstAliveTurn: 1, bestMomentLabel: 'payoff' },
        { scenarioId: 'escape-pressure-4p', arcScore: 80, firstAliveTurn: 1, bestMomentLabel: 'recovery' },
      ],
      timeMachine: [
        { scenarioId: 'solo-artifact-hunt', trend: 'stable', timelineCount: 2 },
        { scenarioId: 'escape-pressure-4p', trend: 'stable', timelineCount: 2 },
      ],
      lab: [
        { scenarioId: 'solo-artifact-hunt', readiness: { status: 'ready' } },
        { scenarioId: 'escape-pressure-4p', readiness: { status: 'ready' } },
      ],
      fun: [
        { scenarioId: 'solo-artifact-hunt', funVerdict: 'share-worthy', gates: { recovery: true, shareWorthy: true }, shareWorthyMoment: { feelingLabel: 'payoff' } },
        { scenarioId: 'escape-pressure-4p', funVerdict: 'share-worthy', gates: { recovery: true, shareWorthy: true }, shareWorthyMoment: { feelingLabel: 'recovery' } },
      ],
      growth: [
        { scenarioId: 'solo-artifact-hunt', completions: 1, shareEvents: 1 },
        { scenarioId: 'escape-pressure-4p', completions: 1, shareEvents: 1 },
      ],
    }),
    generatedAt: '2026-05-17T00:00:00.000Z',
  });
  const payload = buildBridgePublicPayload(report);
  assert.equal(payload.scenarios.length, 2);
  assert.ok(payload.featuredScenario.publicRoute.startsWith('/play?scenario='));
  assert.ok(payload.challengeScenario.challengeRoute.startsWith('/challenge?scenario='));
});
