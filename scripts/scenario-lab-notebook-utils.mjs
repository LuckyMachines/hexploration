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
  loadTimeMachineMemory,
} from './scenario-time-machine-utils.mjs';
import {
  findScenario,
  loadScenarioStore,
  readJson,
  root,
  slugify,
  writeJson,
} from './scenario-utils.mjs';

export const LAB_NOTEBOOK_VERSION = '1.0.0';
export const labNotebookReportRoot = resolve(root, 'reports', 'simulator', 'lab-notebook');
export const publicLabNotebookRoot = resolve(root, 'app', 'public', 'simulator', 'lab-notebook');
export const ENTRY_TYPES = ['auto-summary', 'user-decision', 'daily-brief', 'playtest-gate', 'assumption-review', 'regression-note'];
export const DECISION_TYPES = ['keep', 'revise', 'reject', 'playtest', 'promote', 'block', 'revisit'];
export const READINESS_STATUSES = ['ready', 'ready-with-caveats', 'needs-engine-evidence', 'blocked-by-setup', 'regressed', 'insufficient-history'];

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

function scenarioIdentity(scenario = {}, scenarioId = '') {
  const id = slugify(scenario.scenarioId || scenario.id || scenarioId);
  return {
    scenarioId: id,
    name: scenario.name || scenario.title || id,
    designQuestion: scenario.designQuestion || scenario.description || '',
  };
}

function latestByGeneratedAt(items = []) {
  return [...items].sort((a, b) => timestamp(b.generatedAt || b.timestamp) - timestamp(a.generatedAt || a.timestamp))[0] || null;
}

function sourceTypesIn(report = {}) {
  return new Set(asArray(report.timeline).map((point) => point.sourceType));
}

function latestDecision(decisions = []) {
  return latestByGeneratedAt(decisions.map((decision) => ({ ...decision, generatedAt: decision.timestamp })));
}

function assumptionKey(item = {}) {
  return [item.key || item.type || item.title || item.question, item.source || item.scenarioId || ''].join('|').toLowerCase();
}

export function labScenarioPaths(scenarioId) {
  const id = slugify(scenarioId);
  return {
    dir: resolve(labNotebookReportRoot, id),
    latestEntry: resolve(labNotebookReportRoot, id, 'latest-entry.json'),
    latestMarkdown: resolve(labNotebookReportRoot, id, 'latest-entry.md'),
    entries: resolve(labNotebookReportRoot, id, 'entries.json'),
    decisions: resolve(labNotebookReportRoot, id, 'decisions.json'),
    publicLatestEntry: resolve(publicLabNotebookRoot, id, 'latest-entry.json'),
  };
}

export function labIndexPaths() {
  return {
    index: resolve(labNotebookReportRoot, 'index.json'),
    publicIndex: resolve(publicLabNotebookRoot, 'index.json'),
  };
}

export function labDailyPaths(date = null) {
  const day = date || nowIso().slice(0, 10);
  return {
    json: resolve(labNotebookReportRoot, 'daily', `${day}.json`),
    markdown: resolve(labNotebookReportRoot, 'daily', `${day}.md`),
    latest: resolve(labNotebookReportRoot, 'daily', 'latest-brief.json'),
    publicLatest: resolve(publicLabNotebookRoot, 'daily', 'latest-brief.json'),
  };
}

export function loadLabState(scenarioId) {
  const paths = labScenarioPaths(scenarioId);
  return {
    entries: readJson(paths.entries, []),
    decisions: readJson(paths.decisions, []),
    latestEntry: readJson(paths.latestEntry, null),
  };
}

export function loadLabMemory({ refreshMemory = false, includeRaw = true } = {}) {
  if (!refreshMemory && existsSync(latestMemoryPath)) {
    const latest = readLatestMemory({ includeRaw });
    if (latest?.events?.length || !includeRaw) return latest;
  }
  try {
    return loadTimeMachineMemory({ refreshMemory, includeRaw });
  } catch {
    return buildMemory({ includeRaw });
  }
}

export function evidenceSummaryForScenario({ timeMachine = {}, memory = null, scenarioId = '' } = {}) {
  const latest = timeMachine.latest || null;
  const sources = sourceTypesIn(timeMachine);
  const memoryQuery = timeMachine.memoryQuery || (memory ? answerMemoryQuery(memory, `what should we try next for ${scenarioId}?`, { limit: 4 }) : null);
  return compact({
    trend: timeMachine.trend || 'insufficient-evidence',
    stale: timeMachine.stale,
    timelineCount: timeMachine.timelineCount ?? asArray(timeMachine.timeline).length,
    latestHealth: latest?.health?.score,
    bestHealth: timeMachine.bestKnown?.health?.score,
    lastGoodHealth: timeMachine.lastGood?.health?.score,
    latestSourceType: latest?.sourceType,
    latestGeneratedAt: latest?.generatedAt,
    setupFidelity: latest?.setup?.fidelity,
    blockedSetupFields: asArray(latest?.setup?.blockedFields),
    oracleScore: latest?.oracle?.weightedScore,
    oracleVerdict: latest?.oracle?.verdict,
    oracleConfidence: latest?.oracle?.confidence,
    weakestMetric: latest?.oracle?.weakestMetric || timeMachine.latest?.simulator?.topIssue,
    hasSimulatorEvidence: sources.has('simulatorReport'),
    hasOracleEvidence: sources.has('oracleReport'),
    recommendation: timeMachine.recommendation || memoryQuery?.recommendedNextAction || null,
    citationCount: asArray(timeMachine.citations).length + asArray(memoryQuery?.citations).length,
  });
}

export function latestLearningFromEvidence({ timeMachine = {}, evidence = null } = {}) {
  const summary = evidence || evidenceSummaryForScenario({ timeMachine });
  const trend = summary.trend || 'insufficient-evidence';
  if ((summary.blockedSetupFields || []).length > 0 || number(summary.setupFidelity, 1) < 0.4) {
    return `The latest evidence is constrained by setup fidelity; blocked fields are ${(summary.blockedSetupFields || []).join(', ') || 'setup fidelity below threshold'}.`;
  }
  if (!summary.hasSimulatorEvidence || !summary.hasOracleEvidence) {
    return 'The scenario still needs a paired simulator and Oracle pass before the notebook can make a strong gameplay claim.';
  }
  if (trend === 'improving') {
    return `The scenario is improving; latest health is ${summary.latestHealth ?? 'unknown'} and best known health is ${summary.bestHealth ?? 'unknown'}.`;
  }
  if (trend === 'regressing') {
    return `The latest run regressed; latest health is ${summary.latestHealth ?? 'unknown'} versus last good ${summary.lastGoodHealth ?? 'unknown'}.`;
  }
  if (trend === 'stable') {
    return `The scenario is stable around health ${summary.latestHealth ?? 'unknown'}; the next useful work is ${summary.recommendation?.title || 'fresh evidence capture'}.`;
  }
  if (trend === 'blocked') return 'The scenario is blocked by evidence quality or failed gates and should not be treated as tuned yet.';
  return 'The scenario has too little evidence history for a reliable design conclusion.';
}

export function unresolvedAssumptionsFromEvidence({ scenario = {}, memory = null, timeMachine = {}, evidence = null } = {}) {
  const summary = evidence || evidenceSummaryForScenario({ timeMachine, memory, scenarioId: scenario.scenarioId || scenario.id });
  const assumptions = [];
  for (const item of asArray(scenario.initialState?.assumptions)) {
    if (item.support !== 'exact' && item.mode !== 'exact') {
      assumptions.push({
        key: item.key || item.description,
        title: item.description || item.key,
        source: 'scenario-initial-state',
        severity: item.support === 'notYetSupported' ? 'high' : 'medium',
      });
    }
  }
  for (const field of asArray(summary.blockedSetupFields)) {
    assumptions.push({
      key: field,
      title: `${field} setup is still not exact enough for strong conclusions.`,
      source: 'time-machine-setup',
      severity: 'high',
    });
  }
  if (summary.hasSimulatorEvidence === false) {
    assumptions.push({
      key: 'missing-simulator',
      title: 'The exact-engine simulator has not produced scenario evidence yet.',
      source: 'time-machine',
      severity: 'high',
    });
  }
  if (summary.hasOracleEvidence === false) {
    assumptions.push({
      key: 'missing-oracle',
      title: 'The Gameplay Oracle has not scored this scenario yet.',
      source: 'time-machine',
      severity: 'high',
    });
  }
  if (summary.oracleConfidence !== undefined && number(summary.oracleConfidence, 1) < 0.6) {
    assumptions.push({
      key: 'low-oracle-confidence',
      title: `Oracle confidence is ${Math.round(number(summary.oracleConfidence) * 100)}%.`,
      source: 'oracle',
      severity: 'medium',
    });
  }
  for (const question of asArray(memory?.openQuestions).filter((item) => item.scenarioId === summary.scenarioId || item.scenarioId === scenario.id || item.scenarioId === scenario.scenarioId).slice(0, 4)) {
    assumptions.push({
      key: question.type || question.question,
      title: question.question,
      source: 'playable-design-memory',
      severity: question.type === 'setup-blocked' || question.type === 'missing-oracle' ? 'high' : 'medium',
      command: question.command,
    });
  }
  const deduped = new Map();
  for (const item of assumptions) {
    const key = assumptionKey(item);
    if (!deduped.has(key)) deduped.set(key, item);
  }
  return [...deduped.values()].slice(0, 10);
}

export function playtestReadiness({ timeMachine = {}, evidence = null, unresolvedAssumptions = [] } = {}) {
  const summary = evidence || evidenceSummaryForScenario({ timeMachine });
  const severeAssumptions = unresolvedAssumptions.filter((item) => item.severity === 'high').length;
  const latest = timeMachine.latest || {};
  if (summary.trend === 'regressing') {
    return {
      status: 'regressed',
      reason: 'Latest evidence regressed from previous or last-good evidence.',
    };
  }
  if ((summary.blockedSetupFields || []).length > 0 || number(summary.setupFidelity, 1) < 0.4 || summary.trend === 'blocked') {
    return {
      status: 'blocked-by-setup',
      reason: 'Setup fidelity or failed gates prevent a trustworthy playtest call.',
    };
  }
  if (!summary.hasSimulatorEvidence || !summary.hasOracleEvidence) {
    return {
      status: 'needs-engine-evidence',
      reason: 'A paired simulator and Oracle pass is required.',
    };
  }
  if (number(summary.timelineCount) < 2) {
    return {
      status: 'insufficient-history',
      reason: 'The scenario needs at least two timeline points before trend claims are useful.',
    };
  }
  const health = number(summary.latestHealth, 0);
  const confidence = number(summary.oracleConfidence, 0.5);
  const verdict = summary.oracleVerdict || latest.autopilot?.finalVerdict || '';
  if (health >= 70 && confidence >= 0.65 && ['pass', 'strong-pass', 'healthy', 'target-met', 'improved'].includes(verdict) && severeAssumptions === 0) {
    return {
      status: 'ready',
      reason: 'Latest evidence is strong, passing, and has no severe unresolved assumption.',
    };
  }
  if (health >= 60 || ['pass', 'strong-pass', 'improved'].includes(verdict)) {
    return {
      status: 'ready-with-caveats',
      reason: severeAssumptions > 0 ? 'Evidence is playable, but severe assumptions still need review.' : 'Evidence is playable, but confidence or health is not yet strong.',
    };
  }
  return {
    status: 'needs-engine-evidence',
    reason: 'Current health is below the playtest threshold.',
  };
}

export function beliefFromEvidence({ scenario = {}, timeMachine = {}, evidence = null, readiness = null } = {}) {
  const summary = evidence || evidenceSummaryForScenario({ timeMachine, scenarioId: scenario.scenarioId || scenario.id });
  const name = scenario.name || scenario.scenarioId || scenario.id || 'Scenario';
  const state = readiness?.status || playtestReadiness({ timeMachine, evidence: summary }).status;
  if (state === 'regressed') return `${name} is not ready to trust; latest evidence regressed and needs comparison against last-good evidence.`;
  if (state === 'blocked-by-setup') return `${name} cannot be judged honestly until setup fidelity improves.`;
  if (state === 'needs-engine-evidence') return `${name} needs fresh exact-engine and Oracle evidence before we make a design decision.`;
  if (state === 'insufficient-history') return `${name} has a first signal, but not enough history for a durable belief.`;
  if (state === 'ready') return `${name} looks ready for a live playtest based on current simulator and Oracle evidence.`;
  return `${name} is probably playable with caveats; the next run should focus on ${summary.weakestMetric || 'the weakest evidence dimension'}.`;
}

export function citationsForEntry({ timeMachine = {}, memoryQuery = null, limit = 12 } = {}) {
  const citations = [
    ...asArray(timeMachine.citations),
    ...asArray(timeMachine.recommendation?.citations),
    ...asArray(memoryQuery?.citations),
    ...asArray(timeMachine.timeline).slice(-4).map((point) => point.citation).filter(Boolean),
  ];
  const seen = new Set();
  return citations.filter((citation) => {
    const key = [citation?.sourcePath, citation?.id, citation?.type].join('|');
    if (!citation || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

export function generateAutoSummaryEntry({
  scenarioId,
  memory = null,
  timeMachine = null,
  priorState = null,
  generatedAt = nowIso(),
  refreshMemory = false,
} = {}) {
  if (!scenarioId) throw new Error('scenarioId is required.');
  const id = slugify(scenarioId);
  const loadedMemory = memory || loadLabMemory({ refreshMemory, includeRaw: true });
  const store = loadScenarioStore();
  const memoryScenario = asArray(loadedMemory.scenarios).find((item) => item.scenarioId === id);
  const scenario = findScenario(store, id) || memoryScenario || { id, name: id };
  const loadedTimeMachine = timeMachine || buildScenarioTimeMachine({ scenarioId: id, memory: loadedMemory, includeRaw: true });
  const evidence = evidenceSummaryForScenario({ timeMachine: loadedTimeMachine, memory: loadedMemory, scenarioId: id });
  evidence.scenarioId = id;
  const memoryQuery = loadedTimeMachine.memoryQuery || answerMemoryQuery(loadedMemory, `what should we try next for ${id}?`, { limit: 4 });
  const unresolvedAssumptions = unresolvedAssumptionsFromEvidence({ scenario, memory: loadedMemory, timeMachine: loadedTimeMachine, evidence });
  const readiness = playtestReadiness({ timeMachine: loadedTimeMachine, evidence, unresolvedAssumptions });
  const latestLearning = latestLearningFromEvidence({ timeMachine: loadedTimeMachine, evidence });
  const beliefBefore = priorState?.latestEntry?.beliefAfter || priorState?.latestEntry?.currentBelief || 'No prior notebook belief recorded.';
  const beliefAfter = beliefFromEvidence({ scenario: scenarioIdentity(scenario, id), timeMachine: loadedTimeMachine, evidence, readiness });
  const recommendation = evidence.recommendation || memoryQuery?.recommendedNextAction || {
    title: `Capture simulator and Oracle evidence for ${id}`,
    command: `npm run scenario:run -- --id=${id} && npm run oracle:scenario -- --id=${id}`,
    reason: 'No sharper recommendation was available.',
  };
  return compact({
    schemaVersion: 1,
    notebookVersion: LAB_NOTEBOOK_VERSION,
    id: hashId([id, 'auto-summary', generatedAt, evidence.latestGeneratedAt || evidence.trend]),
    generatedAt,
    scenarioId: id,
    name: scenario.name || memoryScenario?.name || id,
    designQuestion: scenario.designQuestion || memoryScenario?.designQuestion,
    entryType: 'auto-summary',
    source: 'scenario-lab-notebook',
    title: `Lab notebook: ${scenario.name || id}`,
    latestLearning,
    narrativeSummary: `${latestLearning} Current belief: ${beliefAfter}`,
    evidenceSummary: evidence,
    beliefBefore,
    beliefAfter,
    currentBelief: beliefAfter,
    decision: latestDecision(priorState?.decisions || null),
    confidence: readiness.status === 'ready' ? 'high' : readiness.status === 'ready-with-caveats' ? 'medium' : 'low',
    playtestReadiness: readiness,
    unresolvedAssumptions,
    nextAction: {
      title: recommendation.title || 'Refresh scenario evidence',
      command: recommendation.command || `npm run lab:entry -- --id=${id} --refresh-memory`,
      reason: recommendation.reason || 'Notebook evidence needs another pass.',
    },
    citations: citationsForEntry({ timeMachine: loadedTimeMachine, memoryQuery }),
    timelineReferences: asArray(loadedTimeMachine.timeline).slice(-6).map((point) => compact({
      id: point.id,
      generatedAt: point.generatedAt,
      sourceType: point.sourceType,
      health: point.health?.score,
      title: point.title,
      citation: point.citation,
    })),
  });
}

export function markdownForLabEntry(entry = {}) {
  const assumptions = asArray(entry.unresolvedAssumptions).map((item) => `- ${item.severity || 'medium'}: ${item.title || item.key}${item.command ? ` - \`${item.command}\`` : ''}`).join('\n') || '- None recorded.';
  const citations = asArray(entry.citations).map((citation) => `- ${citation.sourcePath || 'unknown'} (${citation.type || 'evidence'}${citation.scenarioId ? ` / ${citation.scenarioId}` : ''})`).join('\n') || '- No citations.';
  const references = asArray(entry.timelineReferences).map((point) => `| ${point.generatedAt || ''} | ${point.sourceType || ''} | ${point.health ?? ''} | ${point.title || ''} |`).join('\n') || '| none | | | |';
  return `# Scenario Lab Notebook

Generated: ${entry.generatedAt || 'unknown'}

Scenario: ${entry.scenarioId || 'unknown'}

Entry type: ${entry.entryType || 'unknown'}

Readiness: ${entry.playtestReadiness?.status || 'unknown'}

Confidence: ${entry.confidence || 'unknown'}

## Latest Learning

${entry.latestLearning || 'No latest learning recorded.'}

## Current Belief

${entry.currentBelief || entry.beliefAfter || 'No belief recorded.'}

## Belief Before

${entry.beliefBefore || 'No prior belief recorded.'}

## Evidence Summary

- Trend: ${entry.evidenceSummary?.trend || 'unknown'}
- Timeline points: ${entry.evidenceSummary?.timelineCount ?? 'unknown'}
- Latest health: ${entry.evidenceSummary?.latestHealth ?? 'n/a'}
- Best health: ${entry.evidenceSummary?.bestHealth ?? 'n/a'}
- Setup fidelity: ${entry.evidenceSummary?.setupFidelity !== undefined ? Math.round(entry.evidenceSummary.setupFidelity * 100) + '%' : 'n/a'}
- Oracle: ${entry.evidenceSummary?.oracleScore ?? 'n/a'} / ${entry.evidenceSummary?.oracleVerdict || 'unknown'}

## Latest Decision

${entry.decision ? `${entry.decision.decisionType}: ${entry.decision.reason}` : 'No decision recorded.'}

## Unresolved Assumptions

${assumptions}

## Next Action

${entry.nextAction?.title || 'No next action.'}

\`${entry.nextAction?.command || 'npm run lab:doctor'}\`

## Timeline References

| Generated | Source | Health | Title |
| --- | --- | ---: | --- |
${references}

## Citations

${citations}
`;
}

export function writeLabEntry(entry, { markdown = true } = {}) {
  const paths = labScenarioPaths(entry.scenarioId);
  const state = loadLabState(entry.scenarioId);
  const byId = new Map(asArray(state.entries).map((item) => [item.id, item]));
  byId.set(entry.id, entry);
  const entries = [...byId.values()].sort((a, b) => timestamp(b.generatedAt) - timestamp(a.generatedAt));
  writeJson(paths.latestEntry, entry);
  writeJson(paths.publicLatestEntry, entry);
  writeJson(paths.entries, entries);
  if (markdown) {
    mkdirSync(dirname(paths.latestMarkdown), { recursive: true });
    writeFileSync(paths.latestMarkdown, markdownForLabEntry(entry));
  }
  return paths;
}

export function validateDecisionInput({ scenarioId, decisionType, reason } = {}) {
  const errors = [];
  if (!scenarioId) errors.push('scenarioId is required.');
  if (!DECISION_TYPES.includes(decisionType)) errors.push(`decisionType must be one of: ${DECISION_TYPES.join(', ')}.`);
  if (!String(reason || '').trim()) errors.push('reason is required.');
  return {
    ok: errors.length === 0,
    errors,
  };
}

export function createDecision({
  scenarioId,
  decisionType,
  reason,
  status = 'recorded',
  reversible = true,
  followUpCommand = null,
  confidence = 'medium',
  citations = [],
  generatedAt = nowIso(),
} = {}) {
  const id = slugify(scenarioId);
  const validation = validateDecisionInput({ scenarioId: id, decisionType, reason });
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  return compact({
    schemaVersion: 1,
    notebookVersion: LAB_NOTEBOOK_VERSION,
    id: hashId([id, decisionType, reason, generatedAt]),
    timestamp: generatedAt,
    scenarioId: id,
    decisionType,
    status,
    reason: String(reason).trim(),
    reversible: reversible !== false,
    followUpCommand,
    confidence,
    citations: asArray(citations).slice(0, 8),
  });
}

export function entryForDecision({ decision, priorState = null, generatedAt = null } = {}) {
  const state = priorState || loadLabState(decision.scenarioId);
  const latestEntry = state.latestEntry || {};
  return compact({
    schemaVersion: 1,
    notebookVersion: LAB_NOTEBOOK_VERSION,
    id: hashId([decision.id, 'user-decision']),
    generatedAt: generatedAt || decision.timestamp,
    scenarioId: decision.scenarioId,
    name: latestEntry.name || decision.scenarioId,
    designQuestion: latestEntry.designQuestion,
    entryType: 'user-decision',
    source: 'scenario-lab-notebook',
    title: `Decision: ${decision.decisionType} ${decision.scenarioId}`,
    latestLearning: `Recorded decision ${decision.decisionType}: ${decision.reason}`,
    narrativeSummary: `Decision recorded for ${decision.scenarioId}: ${decision.reason}`,
    evidenceSummary: latestEntry.evidenceSummary || {},
    beliefBefore: latestEntry.currentBelief || latestEntry.beliefAfter || 'No prior notebook belief recorded.',
    beliefAfter: latestEntry.currentBelief || latestEntry.beliefAfter || `Decision ${decision.decisionType} recorded; evidence should be refreshed next.`,
    currentBelief: latestEntry.currentBelief || latestEntry.beliefAfter || `Decision ${decision.decisionType} recorded; evidence should be refreshed next.`,
    decision,
    confidence: decision.confidence,
    playtestReadiness: latestEntry.playtestReadiness || { status: 'insufficient-history', reason: 'Decision was recorded without a fresh auto-summary entry.' },
    unresolvedAssumptions: latestEntry.unresolvedAssumptions || [],
    nextAction: decision.followUpCommand
      ? { title: 'Run decision follow-up', command: decision.followUpCommand, reason: 'Decision supplied a follow-up command.' }
      : latestEntry.nextAction,
    citations: unique([...asArray(decision.citations), ...asArray(latestEntry.citations)].map((citation) => JSON.stringify(citation))).map((item) => JSON.parse(item)).slice(0, 10),
    timelineReferences: latestEntry.timelineReferences || [],
  });
}

export function writeLabDecision(decision, { markdown = true } = {}) {
  const paths = labScenarioPaths(decision.scenarioId);
  const state = loadLabState(decision.scenarioId);
  const decisions = [decision, ...asArray(state.decisions).filter((item) => item.id !== decision.id)]
    .sort((a, b) => timestamp(b.timestamp) - timestamp(a.timestamp));
  writeJson(paths.decisions, decisions);
  const entry = entryForDecision({ decision, priorState: { ...state, decisions } });
  writeLabEntry(entry, { markdown });
  return { paths, decision, entry };
}

export function scenarioIdsForLab({ memory = null, index = null, store = loadScenarioStore() } = {}) {
  const authored = new Set(asArray(store.scenarios).filter((scenario) => scenario.archived !== true).map((scenario) => slugify(scenario.id)));
  const meaningfulMemoryScenarios = asArray(memory?.scenarios)
    .filter((scenario) => authored.has(slugify(scenario.scenarioId)) || scenario.designQuestion || scenario.importance === 'core')
    .map((scenario) => scenario.scenarioId);
  const indexed = asArray(index?.scenarios)
    .filter((scenario) => authored.has(slugify(scenario.scenarioId)))
    .map((scenario) => scenario.scenarioId);
  return unique([
    ...authored,
    ...meaningfulMemoryScenarios,
    ...indexed,
  ]).map(slugify).sort();
}

export function buildLabIndex({ memory = null, timeMachineIndex = null } = {}) {
  const loadedMemory = memory || loadLabMemory({ includeRaw: true });
  const index = timeMachineIndex || buildTimeMachineIndex({ memory: loadedMemory });
  const store = loadScenarioStore();
  const scenarios = scenarioIdsForLab({ memory: loadedMemory, index, store }).map((scenarioId) => {
    const scenario = findScenario(store, scenarioId) || asArray(loadedMemory.scenarios).find((item) => item.scenarioId === scenarioId) || { id: scenarioId, name: scenarioId };
    const state = loadLabState(scenarioId);
    const decision = latestDecision(state.decisions);
    const latest = state.latestEntry;
    return compact({
      scenarioId,
      name: scenario.name || scenarioId,
      designQuestion: scenario.designQuestion,
      hasEntry: Boolean(latest),
      latestEntryId: latest?.id,
      latestGeneratedAt: latest?.generatedAt,
      latestLearning: latest?.latestLearning,
      currentBelief: latest?.currentBelief || latest?.beliefAfter,
      readiness: latest?.playtestReadiness,
      latestDecision: decision,
      unresolvedCount: asArray(latest?.unresolvedAssumptions).length,
      nextAction: latest?.nextAction || asArray(index.scenarios).find((item) => item.scenarioId === scenarioId)?.recommendation,
    });
  });
  return {
    schemaVersion: 1,
    notebookVersion: LAB_NOTEBOOK_VERSION,
    generatedAt: nowIso(),
    scenarioCount: scenarios.length,
    readyCount: scenarios.filter((scenario) => scenario.readiness?.status === 'ready').length,
    caveatCount: scenarios.filter((scenario) => scenario.readiness?.status === 'ready-with-caveats').length,
    blockedCount: scenarios.filter((scenario) => ['blocked-by-setup', 'regressed', 'needs-engine-evidence'].includes(scenario.readiness?.status)).length,
    scenarios,
  };
}

export function writeLabIndex(index) {
  const paths = labIndexPaths();
  writeJson(paths.index, index);
  writeJson(paths.publicIndex, index);
  return paths;
}

export function buildDailyBrief({ date = nowIso().slice(0, 10), index = null } = {}) {
  const loadedIndex = index || buildLabIndex();
  const touched = asArray(loadedIndex.scenarios).map((scenario) => ({
    scenario,
    state: loadLabState(scenario.scenarioId),
  }));
  const entries = touched.flatMap(({ state }) => asArray(state.entries)).filter((entry) => String(entry.generatedAt || '').startsWith(date));
  const decisions = touched.flatMap(({ state }) => asArray(state.decisions)).filter((decision) => String(decision.timestamp || '').startsWith(date));
  const readinessCounts = asArray(loadedIndex.scenarios).reduce((counts, scenario) => {
    const status = scenario.readiness?.status || 'missing';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  const nextCommands = unique(asArray(loadedIndex.scenarios).map((scenario) => scenario.nextAction?.command)).slice(0, 8);
  return {
    schemaVersion: 1,
    notebookVersion: LAB_NOTEBOOK_VERSION,
    generatedAt: nowIso(),
    date,
    entryCount: entries.length,
    decisionCount: decisions.length,
    readinessCounts,
    touchedScenarios: unique([...entries.map((entry) => entry.scenarioId), ...decisions.map((decision) => decision.scenarioId)]),
    entries: entries.slice(0, 20).map((entry) => compact({
      id: entry.id,
      scenarioId: entry.scenarioId,
      generatedAt: entry.generatedAt,
      title: entry.title,
      latestLearning: entry.latestLearning,
      readiness: entry.playtestReadiness,
      nextAction: entry.nextAction,
    })),
    decisions: decisions.slice(0, 20),
    nextCommands,
  };
}

export function markdownForDailyBrief(brief = {}) {
  const entries = asArray(brief.entries).map((entry) => `- ${entry.scenarioId}: ${entry.latestLearning || entry.title}`).join('\n') || '- No entries generated today.';
  const decisions = asArray(brief.decisions).map((decision) => `- ${decision.scenarioId}: ${decision.decisionType} - ${decision.reason}`).join('\n') || '- No decisions recorded today.';
  const readiness = Object.entries(brief.readinessCounts || {}).map(([status, count]) => `- ${status}: ${count}`).join('\n') || '- No readiness counts.';
  const commands = asArray(brief.nextCommands).map((command) => `- \`${command}\``).join('\n') || '- No commands recommended.';
  return `# Scenario Lab Notebook Daily Brief

Date: ${brief.date || 'unknown'}

Generated: ${brief.generatedAt || 'unknown'}

Entries: ${brief.entryCount || 0}

Decisions: ${brief.decisionCount || 0}

## Entries

${entries}

## Decisions

${decisions}

## Readiness

${readiness}

## Next Commands

${commands}
`;
}

export function writeDailyBrief(brief, { markdown = true } = {}) {
  const paths = labDailyPaths(brief.date);
  writeJson(paths.json, brief);
  writeJson(paths.latest, brief);
  writeJson(paths.publicLatest, brief);
  if (markdown) {
    mkdirSync(dirname(paths.markdown), { recursive: true });
    writeFileSync(paths.markdown, markdownForDailyBrief(brief));
  }
  return paths;
}

export function labDoctor({ memory = null, staleDays = 14 } = {}) {
  const loadedMemory = memory || loadLabMemory({ includeRaw: true });
  const index = buildLabIndex({ memory: loadedMemory });
  const findings = [];
  if (!existsSync(latestMemoryPath)) {
    findings.push({ severity: 'warning', type: 'missing-memory', message: 'No latest Playable Design Memory snapshot exists.', command: 'npm run memory:build' });
  }
  const staleMs = staleDays * 24 * 60 * 60 * 1000;
  for (const scenario of index.scenarios) {
    if (!scenario.hasEntry) {
      findings.push({ severity: 'warning', type: 'missing-entry', scenarioId: scenario.scenarioId, message: `No lab notebook entry exists for ${scenario.scenarioId}.`, command: `npm run lab:entry -- --id=${scenario.scenarioId}` });
      continue;
    }
    if (scenario.latestGeneratedAt && Date.now() - timestamp(scenario.latestGeneratedAt) > staleMs) {
      findings.push({ severity: 'info', type: 'stale-entry', scenarioId: scenario.scenarioId, message: `${scenario.scenarioId} notebook entry is older than ${staleDays} days.`, command: `npm run lab:entry -- --id=${scenario.scenarioId} --refresh-memory` });
    }
    if (!scenario.latestDecision) {
      findings.push({ severity: 'info', type: 'missing-decision', scenarioId: scenario.scenarioId, message: `${scenario.scenarioId} has no recorded human decision.`, command: `npm run lab:decision -- --id=${scenario.scenarioId} --decision=revisit --why="Needs a current design decision." --dry-run` });
    }
    if (!scenario.nextAction?.command) {
      findings.push({ severity: 'warning', type: 'missing-next-command', scenarioId: scenario.scenarioId, message: `${scenario.scenarioId} has no next command in the notebook.` });
    }
    if (scenario.readiness?.status === 'blocked-by-setup') {
      findings.push({ severity: 'warning', type: 'blocked-by-setup', scenarioId: scenario.scenarioId, message: `${scenario.scenarioId} is blocked by setup fidelity.`, command: 'npm run setup:doctor' });
    }
    if (scenario.readiness?.status === 'regressed') {
      findings.push({ severity: 'warning', type: 'regressed', scenarioId: scenario.scenarioId, message: `${scenario.scenarioId} latest notebook evidence regressed.`, command: `npm run time-machine:compare -- --id=${scenario.scenarioId} --against=last-good --markdown` });
    }
  }
  return {
    schemaVersion: 1,
    notebookVersion: LAB_NOTEBOOK_VERSION,
    generatedAt: nowIso(),
    ok: !findings.some((finding) => finding.severity === 'error'),
    warningCount: findings.filter((finding) => finding.severity === 'warning').length,
    infoCount: findings.filter((finding) => finding.severity === 'info').length,
    findings,
  };
}
