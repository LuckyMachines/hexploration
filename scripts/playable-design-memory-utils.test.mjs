import test from 'node:test';
import assert from 'node:assert/strict';
import {
  answerMemoryQuery,
  buildExperiments,
  buildFindings,
  buildMemory,
  buildScenarioRollups,
  buildSetupLimits,
  buildThemeRollups,
  classifyMemorySource,
  dedupeMemoryEvents,
  markdownForMemory,
  markdownForQuery,
  memoryDoctor,
  normalizeMemorySource,
  parseMemoryQuery,
  rankMemoryEvents,
} from './playable-design-memory-utils.mjs';

const store = {
  scenarios: [
    {
      id: 'escape-pressure-4p',
      name: 'Escape Pressure 4P',
      designQuestion: 'Does escape pressure create cooperation?',
      tags: ['cooperation', 'escape', 'survival'],
      importance: 'core',
      archived: false,
    },
    {
      id: 'solo-artifact-hunt',
      name: 'Solo Artifact Hunt',
      designQuestion: 'Does artifact hunting pay off?',
      tags: ['solo', 'artifact', 'survival'],
      importance: 'core',
      archived: false,
    },
  ],
};

function oracle(score = 58) {
  return {
    oracleVersion: '1.0.0',
    generatedAt: '2026-05-15T00:00:00.000Z',
    scenarioId: 'escape-pressure-4p',
    oracleVerdict: 'mixed',
    weightedScore: score,
    confidence: 0.55,
    experienceScores: {
      agency: { score: 70 },
      readability: { score: 42 },
      tension: { score: 66 },
    },
    setup: { level: 'metadata', requiredSetupLevel: 'partial', criticalSkipped: 1 },
    setupSupportNeeded: [{ key: 'landingZone', support: 'contractBlocked' }],
    smallestNextExperiment: {
      title: 'Unlock blocked setup support first',
      verificationCommand: 'npm run setup:doctor',
      why: 'The design question depends on blocked setup.',
    },
    gate: { passed: false, failures: ['required partial setup ran as metadata'] },
  };
}

function simulator() {
  return {
    generatedAt: '2026-05-15T00:05:00.000Z',
    config: { scenario: 'escape-pressure-4p' },
    aggregate: { runs: 2, averages: { invalidAttempts: 1, zeroStatPlayers: 0, artifacts: 0.5, revealedZones: 2 }, warnings: [] },
    funDebugger: { averageLifeScore: 61, flatTurnRate: 0.12, aliveTurnRate: 0.82, topIssue: { key: 'readability', label: 'Readability drag' } },
    scenarioVerdict: { verdict: 'inconclusive', targets: [{ metric: 'helpActions', pass: false, label: 'Help action count' }], failureSignals: [] },
  };
}

function setup() {
  return {
    generatedAt: '2026-05-15T00:06:00.000Z',
    scenarioId: 'escape-pressure-4p',
    setupLevel: 'metadata',
    setupApplication: {
      applied: [],
      skipped: [{ field: 'landingZone', status: 'skipped', reason: 'Initial play zone is selected during setup' }],
      failed: [],
      warnings: ['landing zone is contractBlocked'],
      errors: [],
      support: [{ key: 'landingZone', critical: true, status: 'contractBlocked' }],
    },
  };
}

function autopilot(accepted = false) {
  return {
    autopilotVersion: '1.0.0',
    generatedAt: '2026-05-15T00:10:00.000Z',
    scenarioId: 'escape-pressure-4p',
    mode: 'iterate',
    finalVerdict: accepted ? 'improved' : 'rejected-regression',
    intent: { text: 'escape pressure should feel desperate but cooperative', qualities: ['cooperative', 'tense'] },
    selectedChange: { title: 'Add one setup prelude pressure beat', targetMetric: 'tension', verificationCommand: 'npm run autopilot -- --id=escape-pressure-4p --mode=iterate --apply' },
    baselineOracle: { weightedScore: 58, confidence: 0.55 },
    finalOracle: { weightedScore: accepted ? 64 : 55, confidence: 0.6 },
    comparison: { accepted, delta: { weightedScore: accepted ? 6 : -3, lifeScore: accepted ? 4 : -2, flatTurnRate: accepted ? -0.03 : 0.05 }, rejectedReasons: accepted ? [] : ['Oracle score regressed by 3.0'] },
    candidateChanges: [{ id: 'candidate' }],
  };
}

test('classifies and normalizes memory sources', () => {
  assert.equal(classifyMemorySource('reports/simulator/oracle/latest-oracle.json', oracle()), 'oracleReport');
  assert.equal(classifyMemorySource('reports/simulator/scenarios/escape/latest-report.json', simulator()), 'simulatorReport');
  const event = normalizeMemorySource({ path: 'reports/simulator/oracle/latest-oracle.json', source: oracle() });
  assert.equal(event.type, 'oracleReport');
  assert.equal(event.scenarioId, 'escape-pressure-4p');
  assert.equal(event.metrics.weakestMetric, 'readability');
  assert.ok(event.tags.includes('readability'));
});

test('dedupes events by stable evidence key', () => {
  const first = normalizeMemorySource({ path: 'reports/simulator/oracle/latest-oracle.json', source: oracle(58) });
  const second = { ...first, id: 'different-id' };
  assert.equal(dedupeMemoryEvents([first, second]).length, 1);
});

test('builds scenario and theme rollups', () => {
  const events = [
    normalizeMemorySource({ path: 'simulator.scenarios.json', source: store.scenarios[0], type: 'scenarioDefinition', scenario: store.scenarios[0] }),
    normalizeMemorySource({ path: 'reports/simulator/oracle/latest-oracle.json', source: oracle() }),
    normalizeMemorySource({ path: 'reports/simulator/scenarios/escape-pressure-4p/latest-report.json', source: simulator() }),
    normalizeMemorySource({ path: 'reports/simulator/scenarios/escape-pressure-4p/latest-setup-report.json', source: setup() }),
  ];
  const rollups = buildScenarioRollups(events, store);
  const escape = rollups.find((item) => item.scenarioId === 'escape-pressure-4p');
  assert.equal(escape.latestScore, 58);
  assert.equal(escape.weakestMetric, 'readability');
  assert.equal(escape.blockedSetupFields[0].key, 'landingZone');
  const themes = buildThemeRollups(events);
  assert.ok(themes.some((theme) => theme.theme === 'escape'));
});

test('extracts experiments, findings, and setup limits', () => {
  const events = [
    normalizeMemorySource({ path: 'a-oracle.json', source: oracle() }),
    normalizeMemorySource({ path: 'b-oracle.json', source: { ...oracle(), generatedAt: '2026-05-15T00:20:00.000Z', scenarioId: 'solo-artifact-hunt' } }),
    normalizeMemorySource({ path: 'setup.json', source: setup() }),
    normalizeMemorySource({ path: 'autopilot.json', source: autopilot(true) }),
  ];
  const rollups = buildScenarioRollups(events, store);
  const findings = buildFindings(events, rollups);
  assert.ok(findings.some((finding) => finding.type === 'recurring-weakness'));
  assert.ok(buildExperiments(events)[0].status === 'accepted');
  assert.equal(buildSetupLimits(events, rollups)[0].field, 'landingZone');
});

test('builds complete memory from injected events', () => {
  const sources = [
    normalizeMemorySource({ path: 'simulator.scenarios.json', source: store.scenarios[0], type: 'scenarioDefinition', scenario: store.scenarios[0] }),
    normalizeMemorySource({ path: 'oracle.json', source: oracle() }),
    normalizeMemorySource({ path: 'setup.json', source: setup() }),
    normalizeMemorySource({ path: 'autopilot.json', source: autopilot(false) }),
  ];
  const memory = buildMemory({ sources, store, includeRaw: true });
  assert.equal(memory.sourceCounts.oracleReport, 1);
  assert.ok(memory.findings.length > 0);
  assert.ok(memory.openQuestions.some((question) => question.scenarioId === 'solo-artifact-hunt'));
  assert.ok(markdownForMemory(memory).includes('Playable Design Memory'));
});

test('parses, ranks, and answers memory queries with citations', () => {
  const sources = [
    normalizeMemorySource({ path: 'oracle.json', source: oracle() }),
    normalizeMemorySource({ path: 'setup.json', source: setup() }),
    normalizeMemorySource({ path: 'autopilot.json', source: autopilot(false) }),
  ];
  const memory = buildMemory({ sources, store, includeRaw: true });
  const parsed = parseMemoryQuery('what blocks escape-pressure-4p setup?', memory);
  assert.ok(parsed.wantsBlockers);
  assert.ok(parsed.scenarioIds.includes('escape-pressure-4p'));
  assert.ok(rankMemoryEvents(memory.events, parsed).length > 0);
  const answer = answerMemoryQuery(memory, 'what blocks escape-pressure-4p setup?');
  assert.ok(answer.answer.includes('What we know'));
  assert.ok(answer.citations.length > 0);
  assert.ok(markdownForQuery(answer).includes('Playable Design Memory Query'));
});

test('doctor reports missing evidence without failing hard', () => {
  const memory = buildMemory({
    sources: [normalizeMemorySource({ path: 'simulator.scenarios.json', source: store.scenarios[0], type: 'scenarioDefinition', scenario: store.scenarios[0] })],
    store,
    includeRaw: true,
  });
  const report = memoryDoctor(memory);
  assert.equal(report.ok, true);
  assert.ok(report.warningCount > 0);
  assert.ok(report.findings.some((finding) => finding.type === 'missing-source'));
});
