import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectCurriculum,
  buildScenarioTutorLesson,
  commandsForLesson,
  completeLesson,
  detectPrimaryWeakness,
  lessonGraduationCheck,
  markdownForProjectCurriculum,
  markdownForScenarioLesson,
  rankScenarioLessons,
  successCriteriaForLesson,
  tutorDoctor,
} from './scenario-self-driving-tutor-utils.mjs';

const scenario = {
  id: 'escape-pressure-4p',
  name: 'Escape Pressure 4P',
  importance: 'core',
  designQuestion: 'Does escape pressure create interesting cooperation?',
  tags: ['escape', 'cooperation'],
  initialState: {
    assumptions: [
      { key: 'playerStats', description: 'two exhausted players', support: 'notYetSupported' },
    ],
  },
};

function memory() {
  return {
    generatedAt: '2026-05-15T00:00:00.000Z',
    scenarios: [{ scenarioId: 'escape-pressure-4p', name: 'Escape Pressure 4P', designQuestion: scenario.designQuestion, importance: 'core' }],
    recommendations: [
      {
        priority: 'medium',
        type: 'iteration',
        title: 'Run Autopilot against pacing',
        command: 'npm run autopilot:scenario -- --id=escape-pressure-4p --mode=single-pass',
        reason: 'Pacing is weak.',
      },
    ],
    events: [],
  };
}

function timeMachine(overrides = {}) {
  return {
    scenarioId: 'escape-pressure-4p',
    name: 'Escape Pressure 4P',
    generatedAt: '2026-05-15T00:20:00.000Z',
    trend: 'improving',
    timelineCount: 3,
    latest: {
      id: 'oracle-b',
      generatedAt: '2026-05-15T00:15:00.000Z',
      sourceType: 'oracleReport',
      title: 'Oracle pass',
      health: { score: 68 },
      oracle: { weightedScore: 70, confidence: 0.68, verdict: 'pass', weakestMetric: 'pacing', weakestScore: 48, gatePassed: true },
      setup: { fidelity: 0.74, blockedFields: [] },
      citation: { id: 'oracle-b', type: 'oracleReport', scenarioId: 'escape-pressure-4p', sourcePath: 'reports/oracle-b.json' },
    },
    bestKnown: { health: { score: 72 }, generatedAt: '2026-05-15T00:15:00.000Z' },
    lastGood: { health: { score: 66 }, generatedAt: '2026-05-15T00:10:00.000Z' },
    timeline: [
      { id: 'sim-a', sourceType: 'simulatorReport', generatedAt: '2026-05-15T00:10:00.000Z', health: { score: 62 }, title: 'Simulator' },
      { id: 'oracle-b', sourceType: 'oracleReport', generatedAt: '2026-05-15T00:15:00.000Z', health: { score: 68 }, title: 'Oracle', citation: { id: 'oracle-b', type: 'oracleReport', scenarioId: 'escape-pressure-4p', sourcePath: 'reports/oracle-b.json' } },
    ],
    citations: [{ id: 'oracle-b', type: 'oracleReport', scenarioId: 'escape-pressure-4p', sourcePath: 'reports/oracle-b.json' }],
    ...overrides,
  };
}

function labEntry(overrides = {}) {
  return {
    scenarioId: 'escape-pressure-4p',
    currentBelief: 'Escape Pressure is playable with caveats.',
    latestLearning: 'Pacing is the weak point.',
    playtestReadiness: { status: 'ready-with-caveats', reason: 'Playable but pacing is weak.' },
    unresolvedAssumptions: [],
    citations: [{ id: 'lab', type: 'labEntry', scenarioId: 'escape-pressure-4p', sourcePath: 'reports/lab.json' }],
    ...overrides,
  };
}

function evidence() {
  return {
    memory: memory(),
    store: { scenarios: [scenario] },
    timeMachineIndex: { scenarios: [{ scenarioId: 'escape-pressure-4p' }] },
    labIndex: { scenarios: [{ scenarioId: 'escape-pressure-4p' }] },
  };
}

test('detects setup blockers before weaker metrics', () => {
  const blocked = timeMachine({
    latest: {
      ...timeMachine().latest,
      setup: { fidelity: 0.2, blockedFields: ['playerStats'] },
    },
  });
  const weakness = detectPrimaryWeakness({ scenario, timeMachine: blocked, labEntry: labEntry(), memory: memory() });
  assert.equal(weakness.primary.type, 'setup');
  assert.equal(weakness.primary.priority, 'critical');
});

test('detects missing evidence lessons', () => {
  const missing = timeMachine({ timeline: [], latest: null, timelineCount: 0 });
  const weakness = detectPrimaryWeakness({ scenario, timeMachine: missing, labEntry: null, memory: memory() });
  assert.equal(weakness.primary.type, 'setup');
  assert.ok(weakness.secondary.some((item) => item.type === 'missing-evidence'));
  const missingOnly = detectPrimaryWeakness({ scenario: { ...scenario, initialState: { assumptions: [] } }, timeMachine: missing, labEntry: null, memory: memory() });
  assert.equal(missingOnly.primary.type, 'missing-evidence');
});

test('detects regression lessons', () => {
  const regressed = timeMachine({ trend: 'regressing' });
  const weakness = detectPrimaryWeakness({ scenario: { ...scenario, initialState: { assumptions: [] } }, timeMachine: regressed, labEntry: labEntry(), memory: memory() });
  assert.equal(weakness.primary.type, 'regression');
});

test('detects weak metric lessons and commands', () => {
  const weakness = detectPrimaryWeakness({ scenario: { ...scenario, initialState: { assumptions: [] } }, timeMachine: timeMachine(), labEntry: labEntry(), memory: memory() });
  assert.equal(weakness.primary.type, 'weak-metric');
  assert.equal(weakness.primary.metric, 'pacing');
  const commands = commandsForLesson({ scenarioId: 'escape-pressure-4p', weakness: weakness.primary, timeMachine: timeMachine() });
  assert.match(commands.primary, /autopilot:scenario/);
  assert.match(commands.verification, /time-machine:scenario/);
});

test('generates measurable success criteria', () => {
  const weakMetric = { type: 'weak-metric', metric: 'pacing' };
  const criteria = successCriteriaForLesson({ weakness: weakMetric, timeMachine: timeMachine(), labEntry: labEntry() });
  assert.ok(criteria.some((item) => item.metric === 'oracleWeightedScore'));
  assert.ok(criteria.some((item) => item.metric === 'pacing'));
});

test('builds a full scenario lesson', () => {
  const lesson = buildScenarioTutorLesson({
    scenarioId: 'escape-pressure-4p',
    evidence: evidence(),
    memory: memory(),
    timeMachine: timeMachine(),
    labEntry: labEntry(),
    generatedAt: '2026-05-15T01:00:00.000Z',
  });
  assert.equal(lesson.scenarioId, 'escape-pressure-4p');
  assert.ok(lesson.steps.length >= 5);
  assert.ok(lesson.successCriteria.length > 0);
  assert.ok(markdownForScenarioLesson(lesson).includes('Scenario Self-Driving Tutor Lesson'));
});

test('ranks critical lessons above ready lessons', () => {
  const ranked = rankScenarioLessons([
    { scenarioId: 'a', priority: 'medium', status: 'ready', category: 'weak-pacing' },
    { scenarioId: 'b', priority: 'critical', status: 'blocked', category: 'setup-fidelity' },
  ]);
  assert.equal(ranked[0].scenarioId, 'b');
});

test('builds project curriculum and markdown', () => {
  const curriculum = buildProjectCurriculum({ evidence: evidence(), memory: memory(), generatedAt: '2026-05-15T01:00:00.000Z' });
  assert.equal(curriculum.scenarioCount, 1);
  assert.ok(curriculum.highestPriorityLesson);
  assert.ok(curriculum.nextCommands.length > 0);
  assert.ok(markdownForProjectCurriculum(curriculum).includes('Scenario Self-Driving Tutor Curriculum'));
});

test('checks graduation and completion records', () => {
  const lesson = buildScenarioTutorLesson({
    scenarioId: 'escape-pressure-4p',
    evidence: evidence(),
    memory: memory(),
    timeMachine: timeMachine(),
    labEntry: labEntry({ playtestReadiness: { status: 'ready', reason: 'Strong enough.' } }),
  });
  const graduation = lessonGraduationCheck({ lesson: { ...lesson, primaryWeakness: { type: 'weak-metric' } }, timeMachine: timeMachine(), labEntry: labEntry({ playtestReadiness: { status: 'ready' } }) });
  assert.equal(graduation.passed, true);
  const record = completeLesson({
    scenarioId: 'escape-pressure-4p',
    lessonId: lesson.id,
    status: 'passed',
    reason: 'Evidence improved.',
    dryRun: true,
  });
  assert.equal(record.status, 'passed');
});

test('doctor returns warning-based findings', () => {
  const report = tutorDoctor({ evidence: evidence() });
  assert.equal(report.ok, true);
  assert.ok(Array.isArray(report.findings));
});
