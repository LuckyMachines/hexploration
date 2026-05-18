import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyBrief,
  buildLabIndex,
  createDecision,
  evidenceSummaryForScenario,
  generateAutoSummaryEntry,
  labDoctor,
  latestLearningFromEvidence,
  markdownForDailyBrief,
  markdownForLabEntry,
  playtestReadiness,
  unresolvedAssumptionsFromEvidence,
  validateDecisionInput,
  beliefFromEvidence,
} from './scenario-lab-notebook-utils.mjs';

const scenario = {
  id: 'escape-pressure-4p',
  name: 'Escape Pressure 4P',
  designQuestion: 'Does escape pressure create cooperation?',
  initialState: {
    assumptions: [
      { key: 'playerStats', description: 'two exhausted players', support: 'notYetSupported' },
      { key: 'landingRevealed', description: 'landing relevance is visible', support: 'observedOnly' },
    ],
  },
};

function memory() {
  return {
    generatedAt: '2026-05-15T01:00:00.000Z',
    scenarios: [
      { scenarioId: 'escape-pressure-4p', name: 'Escape Pressure 4P', designQuestion: scenario.designQuestion },
    ],
    openQuestions: [
      {
        type: 'low-confidence',
        scenarioId: 'escape-pressure-4p',
        question: 'Which telemetry would raise confidence for escape pressure?',
        command: 'npm run oracle:scenario -- --id=escape-pressure-4p',
      },
    ],
    recommendations: [
      {
        priority: 'medium',
        type: 'iteration',
        title: 'Run Autopilot against pacing for escape-pressure-4p',
        command: 'npm run autopilot:scenario -- --id=escape-pressure-4p --mode=single-pass',
        reason: 'Pacing is the latest weak dimension.',
      },
    ],
    events: [
      {
        id: 'oracle-b',
        type: 'oracleReport',
        scenarioId: 'escape-pressure-4p',
        generatedAt: '2026-05-15T00:20:00.000Z',
        title: 'Oracle pass',
        summary: 'Oracle score 74.',
        metrics: { weightedScore: 74, confidence: 0.72, weakestMetric: 'pacing', gatePassed: true },
        tags: ['escape'],
        systems: ['pacing'],
        evidence: { verdict: 'pass' },
        sourcePath: 'reports/oracle-b.json',
        authority: 5,
      },
    ],
  };
}

function timeMachine(overrides = {}) {
  return {
    schemaVersion: 1,
    scenarioId: 'escape-pressure-4p',
    name: 'Escape Pressure 4P',
    generatedAt: '2026-05-15T01:10:00.000Z',
    trend: 'improving',
    stale: false,
    timelineCount: 3,
    latest: {
      id: 'oracle-b',
      generatedAt: '2026-05-15T00:20:00.000Z',
      sourceType: 'oracleReport',
      title: 'Oracle pass',
      summary: 'Oracle score 74.',
      health: { score: 74, reasons: ['Oracle score 74'] },
      oracle: { weightedScore: 74, confidence: 0.72, verdict: 'pass', weakestMetric: 'pacing', gatePassed: true },
      setup: { fidelity: 0.8, blockedFields: [] },
      citation: { id: 'oracle-b', type: 'oracleReport', scenarioId: 'escape-pressure-4p', sourcePath: 'reports/oracle-b.json' },
    },
    bestKnown: { id: 'oracle-b', health: { score: 74 }, generatedAt: '2026-05-15T00:20:00.000Z' },
    lastGood: { id: 'oracle-b', health: { score: 74 }, generatedAt: '2026-05-15T00:20:00.000Z' },
    recommendation: {
      priority: 'medium',
      type: 'iteration',
      title: 'Improve pacing',
      command: 'npm run autopilot:scenario -- --id=escape-pressure-4p --mode=single-pass',
      reason: 'Pacing is the weakest metric.',
      citations: [{ id: 'oracle-b', type: 'oracleReport', scenarioId: 'escape-pressure-4p', sourcePath: 'reports/oracle-b.json' }],
    },
    citations: [{ id: 'oracle-b', type: 'oracleReport', scenarioId: 'escape-pressure-4p', sourcePath: 'reports/oracle-b.json' }],
    timeline: [
      { id: 'scenario', generatedAt: '2026-05-14T00:00:00.000Z', sourceType: 'scenarioDefinition', health: { score: 45 }, title: 'Escape Pressure 4P' },
      { id: 'sim-a', generatedAt: '2026-05-15T00:10:00.000Z', sourceType: 'simulatorReport', health: { score: 61 }, title: 'Simulator run' },
      { id: 'oracle-b', generatedAt: '2026-05-15T00:20:00.000Z', sourceType: 'oracleReport', health: { score: 74 }, title: 'Oracle pass' },
    ],
    ...overrides,
  };
}

test('summarizes evidence from a time machine report', () => {
  const summary = evidenceSummaryForScenario({ timeMachine: timeMachine(), memory: memory(), scenarioId: 'escape-pressure-4p' });
  assert.equal(summary.trend, 'improving');
  assert.equal(summary.latestHealth, 74);
  assert.equal(summary.hasSimulatorEvidence, true);
  assert.equal(summary.hasOracleEvidence, true);
  assert.equal(summary.weakestMetric, 'pacing');
});

test('creates latest learning and readiness from strong evidence', () => {
  const summary = evidenceSummaryForScenario({ timeMachine: timeMachine() });
  assert.match(latestLearningFromEvidence({ timeMachine: timeMachine(), evidence: summary }), /improving/);
  const readiness = playtestReadiness({ timeMachine: timeMachine(), evidence: summary, unresolvedAssumptions: [] });
  assert.equal(readiness.status, 'ready');
});

test('detects setup blockers and unresolved assumptions', () => {
  const blocked = timeMachine({
    trend: 'blocked',
    latest: {
      ...timeMachine().latest,
      setup: { fidelity: 0.25, blockedFields: ['landingZone'] },
      oracle: { weightedScore: 52, confidence: 0.5, verdict: 'mixed', weakestMetric: 'readability', gatePassed: false },
    },
  });
  const evidence = evidenceSummaryForScenario({ timeMachine: blocked, memory: memory(), scenarioId: 'escape-pressure-4p' });
  const unresolved = unresolvedAssumptionsFromEvidence({ scenario, memory: memory(), timeMachine: blocked, evidence });
  const readiness = playtestReadiness({ timeMachine: blocked, evidence, unresolvedAssumptions: unresolved });
  assert.equal(readiness.status, 'blocked-by-setup');
  assert.ok(unresolved.some((item) => item.key === 'landingZone'));
  assert.ok(unresolved.some((item) => item.key === 'playerStats'));
});

test('generates beliefs for regressed and caveated states', () => {
  const regressed = timeMachine({ trend: 'regressing' });
  assert.match(beliefFromEvidence({ scenario, timeMachine: regressed, evidence: evidenceSummaryForScenario({ timeMachine: regressed }), readiness: { status: 'regressed' } }), /regressed/);
  assert.match(beliefFromEvidence({ scenario, timeMachine: timeMachine(), evidence: evidenceSummaryForScenario({ timeMachine: timeMachine() }), readiness: { status: 'ready-with-caveats' } }), /playable with caveats/);
});

test('generates a full auto-summary entry with citations and next action', () => {
  const entry = generateAutoSummaryEntry({
    scenarioId: 'escape-pressure-4p',
    memory: memory(),
    timeMachine: timeMachine(),
    priorState: { latestEntry: { beliefAfter: 'Prior belief.' }, decisions: [] },
    generatedAt: '2026-05-15T02:00:00.000Z',
  });
  assert.equal(entry.entryType, 'auto-summary');
  assert.equal(entry.beliefBefore, 'Prior belief.');
  assert.equal(entry.playtestReadiness.status, 'ready');
  assert.equal(entry.nextAction.command, 'npm run autopilot:scenario -- --id=escape-pressure-4p --mode=single-pass');
  assert.ok(entry.citations.length > 0);
  assert.ok(markdownForLabEntry(entry).includes('Scenario Lab Notebook'));
});

test('validates and creates decisions', () => {
  assert.equal(validateDecisionInput({ scenarioId: 'escape-pressure-4p', decisionType: 'keep', reason: 'Evidence is solid.' }).ok, true);
  assert.equal(validateDecisionInput({ scenarioId: 'escape-pressure-4p', decisionType: 'maybe', reason: '' }).ok, false);
  const decision = createDecision({
    scenarioId: 'escape-pressure-4p',
    decisionType: 'playtest',
    reason: 'Evidence is ready enough for a table read.',
    generatedAt: '2026-05-15T02:10:00.000Z',
  });
  assert.equal(decision.decisionType, 'playtest');
  assert.equal(decision.reversible, true);
});

test('builds index and daily brief shapes', () => {
  const index = buildLabIndex({ memory: memory(), timeMachineIndex: { scenarios: [{ scenarioId: 'escape-pressure-4p' }] } });
  assert.ok(index.scenarioCount >= 1);
  const brief = buildDailyBrief({ date: '2026-05-15', index });
  assert.equal(brief.date, '2026-05-15');
  assert.ok(markdownForDailyBrief(brief).includes('Scenario Lab Notebook Daily Brief'));
});

test('doctor reports missing entries without hard failure', () => {
  const report = labDoctor({ memory: memory() });
  assert.equal(report.ok, true);
  assert.ok(Array.isArray(report.findings));
  assert.ok(report.findings.some((finding) => finding.type === 'missing-entry' || finding.type === 'missing-decision'));
});
