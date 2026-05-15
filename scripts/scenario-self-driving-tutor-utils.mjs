import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import {
  answerMemoryQuery,
  buildMemory,
  latestMemoryPath,
  readLatestMemory,
} from './playable-design-memory-utils.mjs';
import {
  buildScenarioTimeMachine,
  buildTimeMachineIndex,
} from './scenario-time-machine-utils.mjs';
import {
  buildLabIndex,
  labIndexPaths,
  labScenarioPaths,
  loadLabMemory,
} from './scenario-lab-notebook-utils.mjs';
import {
  findScenario,
  loadScenarioStore,
  readJson,
  root,
  slugify,
  writeJson,
} from './scenario-utils.mjs';

export const TUTOR_VERSION = '1.0.0';
export const tutorReportRoot = resolve(root, 'reports', 'simulator', 'tutor');
export const publicTutorRoot = resolve(root, 'app', 'public', 'simulator', 'tutor');
export const LESSON_STATUSES = ['ready', 'blocked', 'needs-evidence', 'in-progress', 'passed', 'failed', 'regressed', 'graduated'];
export const LESSON_PRIORITIES = ['critical', 'high', 'medium', 'low'];
export const LESSON_CATEGORIES = [
  'setup-fidelity',
  'missing-engine-evidence',
  'weak-player-agency',
  'weak-readability',
  'weak-tension',
  'weak-recovery',
  'weak-pacing',
  'weak-replayability',
  'weak-outcome-legibility',
  'multiplayer-cooperation',
  'artifact-payoff',
  'escape-pressure',
  'regression-recovery',
  'playtest-readiness',
];

const METRIC_LESSONS = {
  agency: { category: 'weak-player-agency', title: 'Improve meaningful player decisions', target: 'agency' },
  readability: { category: 'weak-readability', title: 'Make player state and choices easier to read', target: 'readability' },
  tension: { category: 'weak-tension', title: 'Shape the pressure curve', target: 'tension' },
  recovery: { category: 'weak-recovery', title: 'Strengthen comeback and recovery turns', target: 'recovery' },
  pacing: { category: 'weak-pacing', title: 'Reduce dead turns and pacing drag', target: 'pacing' },
  replayability: { category: 'weak-replayability', title: 'Create more varied repeat outcomes', target: 'replayability' },
  outcomeLegibility: { category: 'weak-outcome-legibility', title: 'Make outcomes easier to understand', target: 'outcomeLegibility' },
  systemIntegration: { category: 'playtest-readiness', title: 'Connect systems into a clearer loop', target: 'systemIntegration' },
  emotionalTexture: { category: 'playtest-readiness', title: 'Create more memorable player moments', target: 'emotionalTexture' },
  surprise: { category: 'artifact-payoff', title: 'Improve discovery and surprise payoff', target: 'surprise' },
};

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function timestamp(value) {
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hashId(parts = []) {
  return createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 16);
}

function latestByTime(items = [], field = 'generatedAt') {
  return [...items].sort((a, b) => timestamp(b[field]) - timestamp(a[field]))[0] || null;
}

function citationKey(citation = {}) {
  return [citation.id, citation.sourcePath, citation.type, citation.scenarioId].filter(Boolean).join('|');
}

function dedupeCitations(citations = [], limit = 12) {
  const seen = new Set();
  return citations.filter((citation) => {
    if (!citation) return false;
    const key = citationKey(citation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function scenarioImportance(scenario = {}) {
  if (scenario.importance === 'core') return 20;
  if (asArray(scenario.tags).some((tag) => ['escape', 'artifact', 'cooperation', 'survival'].includes(tag))) return 12;
  return 5;
}

function priorityWeight(priority = 'low') {
  return { critical: 1000, high: 700, medium: 400, low: 100 }[priority] || 0;
}

function statusWeight(status = 'ready') {
  return { blocked: 70, 'needs-evidence': 65, regressed: 90, ready: 40, 'in-progress': 30, failed: 55, passed: 5, graduated: 0 }[status] || 0;
}

function latestLabEntryForScenario(scenarioId) {
  const paths = labScenarioPaths(scenarioId);
  return readJson(paths.latestEntry, null);
}

function labIndexOrBuild(memory = null) {
  const paths = labIndexPaths();
  return readJson(paths.index, null) || buildLabIndex({ memory });
}

export function tutorPaths(scenarioId = null) {
  if (!scenarioId) {
    return {
      latestCurriculum: resolve(tutorReportRoot, 'latest-curriculum.json'),
      latestMarkdown: resolve(tutorReportRoot, 'latest-curriculum.md'),
      publicLatestCurriculum: resolve(publicTutorRoot, 'latest-curriculum.json'),
    };
  }
  const id = slugify(scenarioId);
  return {
    dir: resolve(tutorReportRoot, id),
    latestLesson: resolve(tutorReportRoot, id, 'latest-lesson.json'),
    latestMarkdown: resolve(tutorReportRoot, id, 'latest-lesson.md'),
    history: resolve(tutorReportRoot, id, 'lesson-history.json'),
    publicLatestLesson: resolve(publicTutorRoot, id, 'latest-lesson.json'),
  };
}

export function loadTutorMemory({ refreshMemory = false, includeRaw = true } = {}) {
  if (!refreshMemory && existsSync(latestMemoryPath)) {
    const latest = readLatestMemory({ includeRaw });
    if (latest?.events?.length || !includeRaw) return latest;
  }
  return loadLabMemory({ refreshMemory, includeRaw }) || buildMemory({ includeRaw });
}

export function loadTutorEvidence({ refreshMemory = false, includeRaw = true } = {}) {
  const memory = loadTutorMemory({ refreshMemory, includeRaw });
  const store = loadScenarioStore();
  const timeMachineIndex = buildTimeMachineIndex({ memory });
  const labIndex = labIndexOrBuild(memory);
  return {
    generatedAt: nowIso(),
    memory,
    store,
    timeMachineIndex,
    labIndex,
  };
}

function scenarioIdsForTutor({ store = loadScenarioStore(), memory = null, labIndex = null, timeMachineIndex = null } = {}) {
  const authored = new Set(asArray(store.scenarios).filter((scenario) => scenario.archived !== true).map((scenario) => slugify(scenario.id)));
  return unique([
    ...authored,
    ...asArray(labIndex?.scenarios).filter((scenario) => authored.has(slugify(scenario.scenarioId))).map((scenario) => scenario.scenarioId),
    ...asArray(timeMachineIndex?.scenarios).filter((scenario) => authored.has(slugify(scenario.scenarioId))).map((scenario) => scenario.scenarioId),
    ...asArray(memory?.scenarios).filter((scenario) => authored.has(slugify(scenario.scenarioId))).map((scenario) => scenario.scenarioId),
  ]).map(slugify).sort();
}

function sourceTypes(timeMachine = {}) {
  return new Set(asArray(timeMachine.timeline).map((point) => point.sourceType));
}

function setupBlockedFields({ scenario = {}, timeMachine = {}, labEntry = null } = {}) {
  const latest = timeMachine.latest || {};
  return unique([
    ...asArray(latest.setup?.blockedFields),
    ...asArray(labEntry?.unresolvedAssumptions)
      .filter((item) => !String(item.key || '').startsWith('missing-'))
      .filter((item) => /setup|field|landing|artifact|stat/i.test(`${item.key || ''} ${item.title || ''}`))
      .map((item) => item.key || item.title),
    ...asArray(scenario.initialState?.assumptions).filter((item) => item.support === 'notYetSupported' || item.mode === 'notYetSupported').map((item) => item.key),
  ]);
}

export function detectPrimaryWeakness({ scenario = {}, timeMachine = {}, labEntry = null, memory = null } = {}) {
  const latest = timeMachine.latest || {};
  const sources = sourceTypes(timeMachine);
  const setupFields = setupBlockedFields({ scenario, timeMachine, labEntry });
  const setupFidelity = latest.setup?.fidelity;
  const weaknesses = [];
  if (timeMachine.trend === 'regressing') {
    weaknesses.push({
      category: 'regression-recovery',
      type: 'regression',
      priority: 'critical',
      title: 'Recover from the latest regression',
      why: 'The newest evidence moved backward from prior or last-good evidence.',
      metric: 'health',
    });
  }
  if (setupFields.length > 0 || number(setupFidelity, 1) < 0.4 || labEntry?.playtestReadiness?.status === 'blocked-by-setup') {
    weaknesses.push({
      category: 'setup-fidelity',
      type: 'setup',
      priority: 'critical',
      title: 'Repair setup fidelity before tuning gameplay',
      why: `Untrusted setup fields make the scenario conclusion weak: ${setupFields.join(', ') || 'setup fidelity below threshold'}.`,
      blockedFields: setupFields,
    });
  }
  if (!sources.has('simulatorReport') || !sources.has('oracleReport') || labEntry?.playtestReadiness?.status === 'needs-engine-evidence') {
    const missing = [
      !sources.has('simulatorReport') ? 'simulator' : null,
      !sources.has('oracleReport') ? 'oracle' : null,
    ].filter(Boolean);
    weaknesses.push({
      category: 'missing-engine-evidence',
      type: 'missing-evidence',
      priority: missing.length === 2 ? 'critical' : 'high',
      title: 'Capture paired engine and Oracle evidence',
      why: `The tutor cannot graduate this scenario until ${missing.join(' and ') || 'fresh'} evidence exists.`,
      missing,
    });
  }
  const weakestMetric = latest.oracle?.weakestMetric || labEntry?.evidenceSummary?.weakestMetric;
  if (weakestMetric) {
    const mapped = METRIC_LESSONS[weakestMetric] || { category: 'playtest-readiness', title: `Improve ${weakestMetric}`, target: weakestMetric };
    weaknesses.push({
      category: mapped.category,
      type: 'weak-metric',
      priority: number(latest.oracle?.weakestScore, 60) < 50 ? 'high' : 'medium',
      title: mapped.title,
      why: `The latest Oracle weakness is ${weakestMetric}.`,
      metric: weakestMetric,
      score: latest.oracle?.weakestScore,
    });
  }
  const topIssue = latest.simulator?.topIssue;
  if (topIssue && !weaknesses.some((item) => item.metric === topIssue)) {
    weaknesses.push({
      category: 'weak-pacing',
      type: 'simulator-fun',
      priority: 'medium',
      title: `Investigate simulator issue: ${topIssue}`,
      why: `The latest simulator top issue is ${topIssue}.`,
      metric: topIssue,
    });
  }
  const memoryRecommendation = asArray(memory?.recommendations).find((item) => String(item.command || item.reason || '').includes(scenario.id || scenario.scenarioId));
  if (memoryRecommendation) {
    weaknesses.push({
      category: memoryRecommendation.type === 'setup' ? 'setup-fidelity' : 'playtest-readiness',
      type: 'memory-recommendation',
      priority: memoryRecommendation.priority || 'medium',
      title: memoryRecommendation.title,
      why: memoryRecommendation.reason,
      recommendation: memoryRecommendation,
    });
  }
  if (weaknesses.length === 0) {
    weaknesses.push({
      category: 'playtest-readiness',
      type: 'playtest-readiness',
      priority: 'low',
      title: 'Confirm playtest readiness with a fresh comparison',
      why: 'No sharper weakness was detected, so the next lesson should verify that the current belief still holds.',
    });
  }
  const sorted = [...weaknesses].sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority));
  return {
    primary: sorted[0],
    secondary: sorted.slice(1, 5),
  };
}

export function commandsForLesson({ scenarioId, weakness = {}, timeMachine = {} } = {}) {
  const id = slugify(scenarioId);
  let primary = `npm run autopilot:scenario -- --id=${id} --mode=single-pass`;
  if (weakness.type === 'setup') primary = 'npm run setup:doctor';
  else if (weakness.type === 'missing-evidence') {
    const missing = asArray(weakness.missing);
    primary = missing.includes('simulator') && missing.includes('oracle')
      ? `npm run scenario:run -- --id=${id} && npm run oracle:scenario -- --id=${id}`
      : missing.includes('simulator')
        ? `npm run scenario:run -- --id=${id}`
        : `npm run oracle:scenario -- --id=${id}`;
  } else if (weakness.type === 'regression') {
    primary = `npm run time-machine:compare -- --id=${id} --against=last-good --markdown`;
  } else if (weakness.recommendation?.command) {
    primary = weakness.recommendation.command;
  } else if (timeMachine.recommendation?.command) {
    primary = timeMachine.recommendation.command;
  }
  return {
    primary,
    verification: `npm run scenario:run -- --id=${id} && npm run oracle:scenario -- --id=${id} && npm run time-machine:scenario -- --id=${id}`,
    notebook: `npm run lab:entry -- --id=${id}`,
    tutor: `npm run tutor:scenario -- --id=${id}`,
    completion: `npm run tutor:complete -- --id=${id} --lesson=<lesson-id> --status=passed --why="Evidence improved."`,
  };
}

export function successCriteriaForLesson({ weakness = {}, timeMachine = {}, labEntry = null } = {}) {
  const criteria = [];
  if (weakness.type === 'setup') {
    criteria.push({ metric: 'setupFidelity', op: '>=', value: 0.65, label: 'Setup fidelity reaches partial-or-better confidence.' });
    criteria.push({ metric: 'blockedSetupFields', op: '==', value: 0, label: 'No critical setup fields remain blocked for the scenario claim.' });
  } else if (weakness.type === 'missing-evidence') {
    criteria.push({ metric: 'hasSimulatorEvidence', op: '==', value: true, label: 'A scenario simulator report exists.' });
    criteria.push({ metric: 'hasOracleEvidence', op: '==', value: true, label: 'A scenario Oracle report exists.' });
  } else if (weakness.type === 'regression') {
    criteria.push({ metric: 'trend', op: 'in', value: ['stable', 'improving'], label: 'Time Machine trend is stable or improving.' });
    criteria.push({ metric: 'latestHealth', op: '>=', value: number(timeMachine.lastGood?.health?.score, 60), label: 'Latest health recovers to last-good health.' });
  } else {
    criteria.push({ metric: 'oracleWeightedScore', op: '>=', value: number(timeMachine.latest?.oracle?.weightedScore, 55) + 5, label: 'Oracle weighted score rises by at least 5.' });
    criteria.push({ metric: weakness.metric || 'weakestMetric', op: '>=', value: 60, label: `${weakness.metric || 'Weakest metric'} reaches 60 or better.` });
    criteria.push({ metric: 'readiness', op: 'in', value: ['ready', 'ready-with-caveats'], label: 'Lab Notebook readiness improves to playable.' });
  }
  if (labEntry?.playtestReadiness?.status && labEntry.playtestReadiness.status !== 'ready') {
    criteria.push({ metric: 'labReadiness', op: 'improves-from', value: labEntry.playtestReadiness.status, label: `Lab Notebook readiness improves from ${labEntry.playtestReadiness.status}.` });
  }
  return criteria;
}

export function lessonGraduationCheck({ lesson = {}, timeMachine = {}, labEntry = null } = {}) {
  const citations = dedupeCitations([
    ...asArray(lesson.citations),
    ...asArray(timeMachine.citations),
    ...asArray(labEntry?.citations),
  ]);
  if (citations.length === 0) {
    return { status: 'blocked', passed: false, reason: 'Graduation requires cited evidence.' };
  }
  if (lesson.status === 'needs-evidence' || lesson.primaryWeakness?.type === 'missing-evidence') {
    return { status: 'needs-evidence', passed: false, reason: 'Evidence capture must run before graduation.' };
  }
  if (lesson.primaryWeakness?.type === 'setup') {
    const fidelity = number(timeMachine.latest?.setup?.fidelity, 0);
    const blocked = asArray(timeMachine.latest?.setup?.blockedFields).length;
    return fidelity >= 0.65 && blocked === 0
      ? { status: 'graduated', passed: true, reason: 'Setup fidelity is sufficient and no blocked fields remain.' }
      : { status: 'blocked', passed: false, reason: 'Setup fidelity or blocked fields still prevent graduation.' };
  }
  if (lesson.primaryWeakness?.type === 'regression') {
    return ['stable', 'improving'].includes(timeMachine.trend)
      ? { status: 'graduated', passed: true, reason: 'Trend recovered from regression.' }
      : { status: 'regressed', passed: false, reason: 'Trend is still regressed or noisy.' };
  }
  const readiness = labEntry?.playtestReadiness?.status;
  if (['ready', 'ready-with-caveats'].includes(readiness) && number(timeMachine.latest?.health?.score, 0) >= 60) {
    return { status: 'graduated', passed: true, reason: 'Readiness and health are high enough for graduation.' };
  }
  return { status: 'ready', passed: false, reason: 'Lesson has evidence but has not met success criteria yet.' };
}

export function buildLessonSteps({ scenarioId, weakness = {}, commands = {}, criteria = [] } = {}) {
  const id = slugify(scenarioId);
  const intervention = weakness.type === 'setup'
    ? 'repair setup fidelity before making a tuning claim'
    : weakness.type === 'missing-evidence'
      ? 'capture missing evidence'
      : weakness.type === 'regression'
        ? 'compare the regression against last-good evidence'
        : `improve ${weakness.metric || weakness.category}`;
  return [
    { order: 1, title: 'Learning objective', detail: `Determine whether ${id} can improve by focusing on ${weakness.title || intervention}.` },
    { order: 2, title: 'Run primary lesson command', detail: commands.primary },
    { order: 3, title: 'Verify with exact-engine evidence', detail: commands.verification },
    { order: 4, title: 'Compare trend and belief', detail: `Run ${commands.notebook} and inspect whether Time Machine trend plus Lab Notebook readiness improved.` },
    { order: 5, title: 'Judge success criteria', detail: criteria.map((item) => item.label).join(' / ') || 'Use the tutor criteria.' },
    { order: 6, title: 'Record completion', detail: commands.completion },
  ];
}

function lessonStatusForWeakness(weakness = {}) {
  if (weakness.type === 'regression') return 'regressed';
  if (weakness.type === 'setup') return 'blocked';
  if (weakness.type === 'missing-evidence') return 'needs-evidence';
  return 'ready';
}

function lessonPriorityForWeakness(weakness = {}, scenario = {}) {
  if (weakness.priority === 'critical') return 'critical';
  if (scenario.importance === 'core' && weakness.priority === 'medium') return 'high';
  return weakness.priority || 'medium';
}

export function buildScenarioTutorLesson({ scenarioId, evidence = null, memory = null, timeMachine = null, labEntry = null, generatedAt = nowIso() } = {}) {
  if (!scenarioId) throw new Error('scenarioId is required.');
  const loadedEvidence = evidence || loadTutorEvidence();
  const loadedMemory = memory || loadedEvidence.memory || loadTutorMemory({ includeRaw: true });
  const store = loadedEvidence.store || loadScenarioStore();
  const id = slugify(scenarioId);
  const scenario = findScenario(store, id) || asArray(loadedMemory.scenarios).find((item) => item.scenarioId === id) || { id, scenarioId: id, name: id };
  const loadedTimeMachine = timeMachine || buildScenarioTimeMachine({ scenarioId: id, memory: loadedMemory, includeRaw: true });
  const loadedLabEntry = labEntry || latestLabEntryForScenario(id);
  const weakness = detectPrimaryWeakness({ scenario, timeMachine: loadedTimeMachine, labEntry: loadedLabEntry, memory: loadedMemory });
  const primaryWeakness = weakness.primary;
  const commands = commandsForLesson({ scenarioId: id, weakness: primaryWeakness, timeMachine: loadedTimeMachine });
  const successCriteria = successCriteriaForLesson({ weakness: primaryWeakness, timeMachine: loadedTimeMachine, labEntry: loadedLabEntry });
  const steps = buildLessonSteps({ scenarioId: id, weakness: primaryWeakness, commands, criteria: successCriteria });
  const citations = dedupeCitations([
    ...asArray(loadedTimeMachine.citations),
    ...asArray(loadedTimeMachine.latest?.citation ? [loadedTimeMachine.latest.citation] : []),
    ...asArray(loadedLabEntry?.citations),
    ...asArray(primaryWeakness.recommendation?.citations),
  ]);
  const lesson = {
    schemaVersion: 1,
    tutorVersion: TUTOR_VERSION,
    id: hashId([id, primaryWeakness.type, primaryWeakness.title, loadedTimeMachine.latest?.generatedAt || generatedAt]),
    generatedAt,
    scenarioId: id,
    name: scenario.name || id,
    designQuestion: scenario.designQuestion,
    status: lessonStatusForWeakness(primaryWeakness),
    priority: lessonPriorityForWeakness(primaryWeakness, scenario),
    category: primaryWeakness.category,
    currentBelief: loadedLabEntry?.currentBelief || loadedLabEntry?.beliefAfter || 'No Lab Notebook belief has been recorded yet.',
    latestLearning: loadedLabEntry?.latestLearning || loadedTimeMachine.summaries?.currentState || 'No recent learning summary exists yet.',
    primaryWeakness,
    secondaryWeaknesses: weakness.secondary,
    whyItMatters: primaryWeakness.why,
    blockers: [
      ...asArray(primaryWeakness.blockedFields).map((field) => ({ type: 'setup-field', field, message: `${field} blocks a strong claim.` })),
      ...asArray(loadedLabEntry?.unresolvedAssumptions).filter((item) => item.severity === 'high').slice(0, 5),
    ],
    commands,
    successCriteria,
    steps,
    evidence: compact({
      trend: loadedTimeMachine.trend,
      timelineCount: loadedTimeMachine.timelineCount,
      latestHealth: loadedTimeMachine.latest?.health?.score,
      bestHealth: loadedTimeMachine.bestKnown?.health?.score,
      lastGoodHealth: loadedTimeMachine.lastGood?.health?.score,
      oracleScore: loadedTimeMachine.latest?.oracle?.weightedScore,
      weakestMetric: loadedTimeMachine.latest?.oracle?.weakestMetric,
      setupFidelity: loadedTimeMachine.latest?.setup?.fidelity,
      labReadiness: loadedLabEntry?.playtestReadiness?.status,
    }),
    citations,
  };
  lesson.graduation = lessonGraduationCheck({ lesson, timeMachine: loadedTimeMachine, labEntry: loadedLabEntry });
  return lesson;
}

export function rankScenarioLessons(lessons = []) {
  return [...lessons].sort((a, b) => {
    const scoreA = priorityWeight(a.priority) + statusWeight(a.status) + (a.category === 'setup-fidelity' ? 80 : 0) + (a.category === 'missing-engine-evidence' ? 70 : 0);
    const scoreB = priorityWeight(b.priority) + statusWeight(b.status) + (b.category === 'setup-fidelity' ? 80 : 0) + (b.category === 'missing-engine-evidence' ? 70 : 0);
    return scoreB - scoreA || String(a.scenarioId).localeCompare(String(b.scenarioId));
  });
}

export function buildProjectCurriculum({ evidence = null, memory = null, generatedAt = nowIso() } = {}) {
  const loadedEvidence = evidence || loadTutorEvidence();
  const loadedMemory = memory || loadedEvidence.memory;
  const scenarioIds = scenarioIdsForTutor({
    store: loadedEvidence.store,
    memory: loadedMemory,
    labIndex: loadedEvidence.labIndex,
    timeMachineIndex: loadedEvidence.timeMachineIndex,
  });
  const lessons = scenarioIds.map((scenarioId) => buildScenarioTutorLesson({
    scenarioId,
    evidence: loadedEvidence,
    memory: loadedMemory,
    generatedAt,
  }));
  const ranked = rankScenarioLessons(lessons);
  const blockers = ranked.flatMap((lesson) => asArray(lesson.blockers).map((blocker) => ({ scenarioId: lesson.scenarioId, ...blocker }))).slice(0, 12);
  return {
    schemaVersion: 1,
    tutorVersion: TUTOR_VERSION,
    generatedAt,
    scenarioCount: ranked.length,
    highestPriorityLesson: ranked[0] || null,
    lessons: ranked,
    projectWideBlockers: blockers,
    nextCommands: unique(ranked.map((lesson) => lesson.commands?.primary)).slice(0, 3),
    graduationCandidates: ranked.filter((lesson) => lesson.graduation?.passed || ['ready', 'ready-with-caveats'].includes(lesson.evidence?.labReadiness)).slice(0, 5),
    regressionAlerts: ranked.filter((lesson) => lesson.status === 'regressed').slice(0, 5),
  };
}

export function markdownForScenarioLesson(lesson = {}) {
  const steps = asArray(lesson.steps).map((step) => `${step.order}. ${step.title}: ${step.detail}`).join('\n') || 'No steps generated.';
  const criteria = asArray(lesson.successCriteria).map((item) => `- ${item.label}`).join('\n') || '- No criteria generated.';
  const blockers = asArray(lesson.blockers).map((item) => `- ${item.message || item.title || item.field || item.key}`).join('\n') || '- No blockers recorded.';
  const citations = asArray(lesson.citations).map((citation) => `- ${citation.sourcePath || 'unknown'} (${citation.type || 'evidence'}${citation.scenarioId ? ` / ${citation.scenarioId}` : ''})`).join('\n') || '- No citations.';
  return `# Scenario Self-Driving Tutor Lesson

Generated: ${lesson.generatedAt || 'unknown'}

Scenario: ${lesson.scenarioId || 'unknown'}

Status: ${lesson.status || 'unknown'}

Priority: ${lesson.priority || 'unknown'}

Category: ${lesson.category || 'unknown'}

## Primary Weakness

${lesson.primaryWeakness?.title || 'No weakness detected.'}

${lesson.whyItMatters || lesson.primaryWeakness?.why || 'No rationale recorded.'}

## Current Belief

${lesson.currentBelief || 'No belief recorded.'}

## Steps

${steps}

## Commands

- Primary: \`${lesson.commands?.primary || 'npm run tutor:doctor'}\`
- Verification: \`${lesson.commands?.verification || 'npm run tutor:doctor'}\`
- Notebook: \`${lesson.commands?.notebook || 'npm run lab:doctor'}\`
- Tutor: \`${lesson.commands?.tutor || 'npm run tutor:build'}\`

## Success Criteria

${criteria}

## Blockers

${blockers}

## Graduation

${lesson.graduation?.status || 'unknown'}: ${lesson.graduation?.reason || 'No graduation check recorded.'}

## Citations

${citations}
`;
}

export function markdownForProjectCurriculum(curriculum = {}) {
  const lessons = asArray(curriculum.lessons).slice(0, 5).map((lesson, index) => `${index + 1}. ${lesson.scenarioId}: ${lesson.primaryWeakness?.title || lesson.category} - \`${lesson.commands?.primary || 'npm run tutor:doctor'}\``).join('\n') || 'No lessons generated.';
  const blockers = asArray(curriculum.projectWideBlockers).map((item) => `- ${item.scenarioId}: ${item.message || item.title || item.field || item.key}`).join('\n') || '- No project blockers recorded.';
  const candidates = asArray(curriculum.graduationCandidates).map((lesson) => `- ${lesson.scenarioId}: ${lesson.graduation?.reason || lesson.evidence?.labReadiness}`).join('\n') || '- No graduation candidates.';
  const commands = asArray(curriculum.nextCommands).map((command) => `- \`${command}\``).join('\n') || '- No commands generated.';
  const regressions = asArray(curriculum.regressionAlerts).map((lesson) => `- ${lesson.scenarioId}: ${lesson.primaryWeakness?.why}`).join('\n') || '- No regression alerts.';
  return `# Scenario Self-Driving Tutor Curriculum

Generated: ${curriculum.generatedAt || 'unknown'}

Scenarios: ${curriculum.scenarioCount || 0}

## Top Priority

${curriculum.highestPriorityLesson ? `${curriculum.highestPriorityLesson.scenarioId}: ${curriculum.highestPriorityLesson.primaryWeakness?.title}` : 'No top priority.'}

## Top Lessons

${lessons}

## Blockers

${blockers}

## Graduation Candidates

${candidates}

## Regression Alerts

${regressions}

## Next Commands

${commands}
`;
}

export function writeScenarioTutorLesson(lesson, { markdown = true } = {}) {
  const paths = tutorPaths(lesson.scenarioId);
  writeJson(paths.latestLesson, lesson);
  writeJson(paths.publicLatestLesson, lesson);
  if (markdown) {
    mkdirSync(dirname(paths.latestMarkdown), { recursive: true });
    writeFileSync(paths.latestMarkdown, markdownForScenarioLesson(lesson));
  }
  return paths;
}

export function writeProjectCurriculum(curriculum, { markdown = true, writeLessons = true } = {}) {
  const paths = tutorPaths();
  writeJson(paths.latestCurriculum, curriculum);
  writeJson(paths.publicLatestCurriculum, curriculum);
  if (markdown) {
    mkdirSync(dirname(paths.latestMarkdown), { recursive: true });
    writeFileSync(paths.latestMarkdown, markdownForProjectCurriculum(curriculum));
  }
  if (writeLessons) {
    for (const lesson of asArray(curriculum.lessons)) writeScenarioTutorLesson(lesson, { markdown });
  }
  return paths;
}

export function completeLesson({
  scenarioId,
  lessonId,
  status,
  reason,
  followUpCommand = null,
  citations = [],
  generatedAt = nowIso(),
  dryRun = false,
} = {}) {
  const id = slugify(scenarioId);
  if (!id) throw new Error('scenarioId is required.');
  if (!lessonId) throw new Error('lessonId is required.');
  if (!['passed', 'failed', 'blocked', 'revisit', 'graduated'].includes(status)) throw new Error('status must be passed, failed, blocked, revisit, or graduated.');
  if (!String(reason || '').trim()) throw new Error('reason is required.');
  const record = compact({
    schemaVersion: 1,
    tutorVersion: TUTOR_VERSION,
    id: hashId([id, lessonId, status, reason, generatedAt]),
    scenarioId: id,
    lessonId,
    status,
    reason: String(reason).trim(),
    timestamp: generatedAt,
    followUpCommand,
    citations: asArray(citations).slice(0, 8),
  });
  if (!dryRun) {
    const paths = tutorPaths(id);
    const history = readJson(paths.history, []);
    writeJson(paths.history, [record, ...asArray(history).filter((item) => item.id !== record.id)].slice(0, 100));
  }
  return record;
}

export function tutorDoctor({ evidence = null, staleDays = 14 } = {}) {
  const loadedEvidence = evidence || loadTutorEvidence();
  const curriculum = buildProjectCurriculum({ evidence: loadedEvidence });
  const findings = [];
  if (!existsSync(latestMemoryPath)) findings.push({ severity: 'warning', type: 'missing-memory', message: 'No latest Playable Design Memory snapshot exists.', command: 'npm run memory:build' });
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  for (const lesson of asArray(curriculum.lessons)) {
    const paths = tutorPaths(lesson.scenarioId);
    const report = readJson(paths.latestLesson, null);
    const labEntry = latestLabEntryForScenario(lesson.scenarioId);
    if (!report) findings.push({ severity: 'warning', type: 'missing-lesson', scenarioId: lesson.scenarioId, message: `No tutor lesson has been written for ${lesson.scenarioId}.`, command: `npm run tutor:scenario -- --id=${lesson.scenarioId}` });
    if (report?.generatedAt && Date.now() - timestamp(report.generatedAt) > staleMs) findings.push({ severity: 'info', type: 'stale-lesson', scenarioId: lesson.scenarioId, message: `${lesson.scenarioId} tutor lesson is older than ${staleDays} days.`, command: `npm run tutor:scenario -- --id=${lesson.scenarioId}` });
    if (!labEntry) findings.push({ severity: 'warning', type: 'missing-lab-entry', scenarioId: lesson.scenarioId, message: `${lesson.scenarioId} has no Lab Notebook entry.`, command: `npm run lab:entry -- --id=${lesson.scenarioId}` });
    if (asArray(lesson.successCriteria).length === 0) findings.push({ severity: 'warning', type: 'missing-success-criteria', scenarioId: lesson.scenarioId, message: `${lesson.scenarioId} lesson has no success criteria.` });
    if (!lesson.commands?.verification) findings.push({ severity: 'warning', type: 'missing-verification-command', scenarioId: lesson.scenarioId, message: `${lesson.scenarioId} lesson has no verification command.` });
    if (lesson.graduation?.passed && asArray(lesson.citations).length === 0) findings.push({ severity: 'warning', type: 'uncited-graduation', scenarioId: lesson.scenarioId, message: `${lesson.scenarioId} claims graduation without citations.` });
  }
  return {
    schemaVersion: 1,
    tutorVersion: TUTOR_VERSION,
    generatedAt: nowIso(),
    ok: !findings.some((finding) => finding.severity === 'error'),
    warningCount: findings.filter((finding) => finding.severity === 'warning').length,
    infoCount: findings.filter((finding) => finding.severity === 'info').length,
    findings,
  };
}
