import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export const GRADE_ORDER = ['F', 'D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];

const GRADE_POINTS = Object.fromEntries(GRADE_ORDER.map((grade, index) => [grade, index]));
const TIMESTAMP_FIELDS = ['generatedAt', 'reviewedAt', 'updatedAt', 'recordedAt', 'completedAt', 'createdAt', 'timestamp'];
const RISK_POINTS = { low: 0, medium: 1, high: 2 };

export function parseControlPlaneInvocation(values = []) {
  const args = [...values];
  if (['help', '--help', '-h'].includes(args[0])) return { command: 'help', args: args.slice(1) };
  const command = args[0] && !args[0].startsWith('--') ? args.shift() : 'apply';
  return { command, args };
}

export function shouldPersistPortfolio(args = []) {
  return !args.includes('--no-verify');
}

export function normalizePath(value = '') {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

export function pathsOutsideDeclared(touchedPaths = [], declarations = []) {
  const normalizedDeclarations = declarations.map(normalizePath);
  return touchedPaths.map(normalizePath).filter((path) => !normalizedDeclarations.some((declaration) => (
    declaration.endsWith('/') ? path.startsWith(declaration) : path === declaration
  )));
}

export function gradeToPoints(grade = 'F') {
  return GRADE_POINTS[grade] ?? 0;
}

export function pointsToGrade(points = 0) {
  const index = Math.max(0, Math.min(GRADE_ORDER.length - 1, Math.round(Number(points) || 0)));
  return GRADE_ORDER[index];
}

export function capGrade(grade, ceiling) {
  return pointsToGrade(Math.min(gradeToPoints(grade), gradeToPoints(ceiling)));
}

export function parseGitStatus(text = '') {
  const entries = String(text).includes('\0') ? String(text).split('\0') : String(text).split(/\r?\n/);
  const paths = [];
  for (const rawEntry of entries) {
    if (!rawEntry || rawEntry.length < 3) continue;
    let path = rawEntry.slice(3).trim();
    if (!path) continue;
    if (path.includes(' -> ')) path = path.split(' -> ').at(-1);
    path = path.replace(/^"|"$/g, '');
    paths.push(normalizePath(path));
  }
  return [...new Set(paths)];
}

export function validateConfig(config = {}) {
  const errors = [];
  if (!/^\d+\.\d+\.\d+$/.test(config.version || '')) errors.push('version must be semantic version text');
  if (!config.name) errors.push('name is required');
  if (!Number.isFinite(config.defaultStaleDays) || config.defaultStaleDays < 1) errors.push('defaultStaleDays must be positive');
  if (!Array.isArray(config.surfaces) || config.surfaces.length === 0) errors.push('at least one surface is required');
  if (!config.commands || typeof config.commands !== 'object') errors.push('commands must be an object');
  if (!Array.isArray(config.remediations)) errors.push('remediations must be an array');
  const ids = new Set();
  for (const surface of config.surfaces || []) {
    if (!surface.id) errors.push('every surface needs an id');
    if (ids.has(surface.id)) errors.push(`duplicate surface id: ${surface.id}`);
    ids.add(surface.id);
    if (!surface.owner) errors.push(`${surface.id || 'surface'} needs an owner`);
    if (!GRADE_POINTS.hasOwnProperty(surface.currentGrade)) errors.push(`${surface.id || 'surface'} has invalid grade`);
    if (surface.gradeSource && (!surface.gradeSource.path || !surface.gradeSource.jsonPath)) errors.push(`${surface.id || 'surface'} gradeSource needs path and jsonPath`);
    if (!surface.objective || !surface.stricterABar) errors.push(`${surface.id || 'surface'} needs an objective and stricter A bar`);
    for (const pattern of surface.pathPatterns || []) {
      try { new RegExp(pattern); } catch { errors.push(`${surface.id} has invalid path pattern: ${pattern}`); }
    }
    for (const commandId of [...(surface.quickCommands || []), ...(surface.fullCommands || [])]) {
      if (!config.commands?.[commandId]) errors.push(`${surface.id} references unknown command: ${commandId}`);
    }
  }
  const states = new Set(config.promotionStates || []);
  for (const [from, targets] of Object.entries(config.allowedTransitions || {})) {
    if (!states.has(from)) errors.push(`transition source is not a promotion state: ${from}`);
    for (const target of targets || []) if (!states.has(target)) errors.push(`transition target is not a promotion state: ${target}`);
  }
  const remediationIds = new Set();
  for (const remediation of config.remediations || []) {
    if (!remediation.id) errors.push('every remediation needs an id');
    if (remediationIds.has(remediation.id)) errors.push(`duplicate remediation id: ${remediation.id}`);
    remediationIds.add(remediation.id);
    if (!remediation.label) errors.push(`${remediation.id || 'remediation'} needs a label`);
    if (!Array.isArray(remediation.surfaceIds) || remediation.surfaceIds.length === 0) errors.push(`${remediation.id} needs surfaceIds`);
    for (const surfaceId of remediation.surfaceIds || []) if (!ids.has(surfaceId)) errors.push(`${remediation.id} references unknown surface: ${surfaceId}`);
    if (!Array.isArray(remediation.actionTypes) || remediation.actionTypes.length === 0) errors.push(`${remediation.id} needs actionTypes`);
    if (!config.commands?.[remediation.commandId]) errors.push(`${remediation.id} references unknown repair command: ${remediation.commandId}`);
    for (const commandId of remediation.verifyCommandIds || []) {
      if (!config.commands?.[commandId]) errors.push(`${remediation.id} references unknown verification command: ${commandId}`);
    }
    if (!(remediation.risk in RISK_POINTS)) errors.push(`${remediation.id} has invalid risk: ${remediation.risk}`);
    if (typeof remediation.auto !== 'boolean') errors.push(`${remediation.id} must declare auto`);
    for (const path of remediation.writePaths || []) {
      const normalized = normalizePath(path);
      if (!normalized || /^[a-zA-Z]:|^\//.test(normalized) || normalized.split('/').includes('..')) errors.push(`${remediation.id} has unsafe write path: ${path}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function classifyChangedFiles(files = [], surfaces = []) {
  const normalized = [...new Set(files.map(normalizePath).filter(Boolean))];
  return surfaces.map((surface) => {
    const patterns = (surface.pathPatterns || []).map((pattern) => new RegExp(pattern, 'i'));
    const matchedFiles = normalized.filter((file) => patterns.some((pattern) => pattern.test(file)));
    return { id: surface.id, matchedFiles };
  }).filter((entry) => entry.matchedFiles.length > 0);
}

function newestTimestamp(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) newestTimestamp(item, found);
    return found;
  }
  for (const [key, child] of Object.entries(value)) {
    if (TIMESTAMP_FIELDS.includes(key) && typeof child === 'string') {
      const time = Date.parse(child);
      if (Number.isFinite(time)) found.push(time);
    }
    if (child && typeof child === 'object') newestTimestamp(child, found);
  }
  return found;
}

function recordCount(json = {}) {
  if (Array.isArray(json)) return json.length;
  for (const key of ['sessions', 'experiments', 'decisions', 'records', 'items']) {
    if (Array.isArray(json?.[key])) return json[key].length;
  }
  return 0;
}

export function evaluateEvidence(root, evidence = {}, now = new Date()) {
  const absolutePath = resolve(root, evidence.path || '');
  const base = { ...evidence, absolutePath, exists: existsSync(absolutePath), status: 'missing', ageDays: null, recordCount: null };
  if (!base.exists) return base;

  let modifiedAt = statSync(absolutePath).mtimeMs;
  if (absolutePath.toLowerCase().endsWith('.json')) {
    try {
      const json = JSON.parse(readFileSync(absolutePath, 'utf8'));
      const timestamps = newestTimestamp(json);
      if (timestamps.length > 0) modifiedAt = Math.max(...timestamps);
      base.recordCount = recordCount(json);
    } catch {
      return { ...base, status: 'invalid', error: 'invalid JSON evidence' };
    }
  }

  base.updatedAt = new Date(modifiedAt).toISOString();
  base.ageDays = Math.max(0, (now.getTime() - modifiedAt) / 86_400_000);
  if (Number.isFinite(evidence.minimumRecords) && (base.recordCount ?? 0) < evidence.minimumRecords) {
    base.status = 'insufficient';
    base.missingRecords = evidence.minimumRecords - (base.recordCount ?? 0);
  } else if (base.ageDays > (evidence.maxAgeDays ?? 14)) {
    base.status = 'stale';
  } else {
    base.status = 'current';
  }
  return base;
}

export function evaluateSurfaceEvidence(root, surface, now = new Date()) {
  return (surface.evidence || []).map((entry) => evaluateEvidence(root, entry, now));
}

export function selectCommands(config, surfaceIds = [], mode = 'quick') {
  const selected = [];
  const seen = new Set();
  const ids = new Set(surfaceIds);
  for (const surface of config.surfaces || []) {
    if (!ids.has(surface.id)) continue;
    const commandIds = mode === 'full' ? surface.fullCommands : surface.quickCommands;
    for (const id of commandIds || []) {
      if (seen.has(id)) continue;
      seen.add(id);
      selected.push({ id, ...config.commands[id], surfaceIds: [] });
    }
  }
  for (const command of selected) {
    command.surfaceIds = (config.surfaces || [])
      .filter((surface) => ids.has(surface.id) && (mode === 'full' ? surface.fullCommands : surface.quickCommands).includes(command.id))
      .map((surface) => surface.id);
  }
  return selected;
}

export function validatePromotionTransition(config, from, to) {
  if (!(config.promotionStates || []).includes(from)) return { ok: false, error: `unknown source state: ${from}` };
  if (!(config.promotionStates || []).includes(to)) return { ok: false, error: `unknown target state: ${to}` };
  if (!(config.allowedTransitions?.[from] || []).includes(to)) return { ok: false, error: `illegal promotion transition: ${from} -> ${to}` };
  return { ok: true };
}

export function actionFingerprint(action = {}) {
  return [action.surfaceId || 'unknown', action.type || 'unknown', action.evidence || action.title || 'unknown'].join(':');
}

function remediationMatches(action, remediation) {
  if (!(remediation.surfaceIds || []).includes(action.surfaceId)) return false;
  if (!(remediation.actionTypes || []).includes(action.type)) return false;
  if (remediation.evidencePaths?.length && !remediation.evidencePaths.includes(action.evidence)) return false;
  if (remediation.checkIds?.length && !remediation.checkIds.includes(action.evidence)) return false;
  return true;
}

function blockedReason(action) {
  if (action.type === 'insufficient' && action.surfaceId === 'player-validation') return 'requires genuine, consent-safe observation of representative players';
  if (action.type === 'grade-gap') return 'requires product or creative judgment before a deterministic repair can be registered';
  if (action.type === 'failed-check') return 'no approved deterministic repair is registered for this failing check';
  return 'no approved deterministic repair is registered for this action';
}

export function buildRemediationPlan(actions = [], config = {}, { attempted = [], maxRisk = 'low' } = {}) {
  const attemptedSet = new Set(attempted);
  const automatic = [];
  const blocked = [];
  for (const action of actions) {
    const fingerprint = actionFingerprint(action);
    const recipes = (config.remediations || []).filter((remediation) => remediationMatches(action, remediation));
    const eligibleRecipes = recipes.filter((candidate) => candidate.auto && RISK_POINTS[candidate.risk] <= (RISK_POINTS[maxRisk] ?? 0));
    const recipe = eligibleRecipes.find((candidate) => !attemptedSet.has(`${candidate.id}:${fingerprint}`));
    if (recipe) {
      automatic.push({ action, recipe, fingerprint, attemptKey: `${recipe.id}:${fingerprint}` });
      continue;
    }
    const unavailableRecipe = recipes[0];
    const attemptedRecipe = eligibleRecipes.find((candidate) => attemptedSet.has(`${candidate.id}:${fingerprint}`));
    blocked.push({
      action,
      fingerprint,
      autonomy: action.type === 'insufficient' && action.surfaceId === 'player-validation' ? 'human-required' : 'assisted',
      reason: attemptedRecipe
        ? 'automatic repair was already attempted in this run and did not resolve the action'
        : unavailableRecipe
        ? unavailableRecipe.auto
          ? `registered repair risk ${unavailableRecipe.risk} exceeds allowed risk ${maxRisk}`
          : 'registered repair requires explicit human approval'
        : blockedReason(action),
    });
  }
  const uniqueAutomatic = automatic.filter((entry, index, all) => all.findIndex((candidate) => candidate.recipe.id === entry.recipe.id) === index);
  return { automatic: uniqueAutomatic, blocked, next: uniqueAutomatic[0] || null };
}

export function markdownForApplyReport(report = {}) {
  const lines = [
    '# Improvement Apply Report',
    '',
    `Generated: ${report.generatedAt || 'unknown'}`,
    `Status: ${report.status || 'unknown'}`,
    `Mode: ${report.dryRun ? 'dry run' : 'apply'}`,
    `Repairs attempted: ${(report.attempts || []).length}`,
    '',
    '## Automatic Repairs',
    '',
  ];
  if (!(report.attempts || []).length) lines.push('- No eligible automatic repair was needed.');
  for (const attempt of report.attempts || []) {
    lines.push(`- ${String(attempt.status || 'unknown').toUpperCase()} ${attempt.recipeId}: ${attempt.label}`);
    if (attempt.command) lines.push(`  Command: \`${attempt.command}\``);
  }
  lines.push('', '## Needs Judgment', '');
  if (!(report.blocked || []).length) lines.push('- None.');
  for (const entry of report.blocked || []) {
    lines.push(`- [${entry.action.surfaceId}] ${entry.action.title}`);
    lines.push(`  ${entry.reason}`);
  }
  lines.push('', `Portfolio: ${report.portfolioPath || 'reports/improvement/latest-portfolio.md'}`);
  return `${lines.join('\n')}\n`;
}

export function validateQualityRecords(records = [], requiredFields = [], surfaceIds = []) {
  const errors = [];
  const knownSurfaces = new Set(surfaceIds);
  const ids = new Set();
  for (const [index, record] of records.entries()) {
    const label = record?.id || `record ${index + 1}`;
    if (record?.id && ids.has(record.id)) errors.push(`duplicate record id: ${record.id}`);
    if (record?.id) ids.add(record.id);
    for (const field of requiredFields) {
      if (!(field in (record || {})) || record[field] === null || record[field] === '') errors.push(`${label} is missing ${field}`);
    }
    if (knownSurfaces.size && !knownSurfaces.has(record?.surface)) errors.push(`${label} references unknown surface: ${record?.surface}`);
  }
  return { ok: errors.length === 0, errors };
}

export function evaluateReportRegistry(root, registry = {}, now = new Date()) {
  return (registry.reports || []).map((report) => {
    const absolutePath = resolve(root, report.path);
    const exists = existsSync(absolutePath);
    const ageDays = exists ? Math.max(0, (now.getTime() - statSync(absolutePath).mtimeMs) / 86_400_000) : null;
    const stale = exists && ageDays > (report.reviewCadenceDays || 14);
    const retirementCandidate = Boolean(report.supersededBy) || (!report.canonical && (stale || !exists));
    return { ...report, exists, ageDays, stale, retirementCandidate };
  });
}

export function checklistProgress(text = '') {
  const complete = (String(text).match(/^- \[[xX]\]/gm) || []).length;
  const incomplete = (String(text).match(/^- \[ \]/gm) || []).length;
  const total = complete + incomplete;
  return { complete, incomplete, total, rate: total ? complete / total : 0 };
}

function nextActionsForSurface(surface, evidence, checks, effectiveGrade = surface.currentGrade) {
  const actions = [];
  for (const check of checks.filter((entry) => entry.surfaceIds?.includes(surface.id) && !['pass', 'skipped'].includes(entry.status))) {
    actions.push({ priority: 100, type: 'failed-check', surfaceId: surface.id, title: `Fix ${check.label || check.id}`, command: check.retryCommand || check.commandText || null, evidence: check.id });
  }
  for (const item of evidence.filter((entry) => entry.required && ['missing', 'invalid', 'insufficient'].includes(entry.status))) {
    const title = item.status === 'insufficient'
      ? `Record ${item.missingRecords} more ${surface.label.toLowerCase()} evidence item${item.missingRecords === 1 ? '' : 's'}`
      : `Create required ${item.kind || 'quality'} evidence`;
    actions.push({ priority: surface.id === 'player-validation' ? 95 : 90, type: item.status, surfaceId: surface.id, title, evidence: item.path });
  }
  for (const item of evidence.filter((entry) => entry.required && entry.status === 'stale')) {
    actions.push({ priority: 70, type: 'stale-evidence', surfaceId: surface.id, title: `Refresh ${item.kind || 'quality'} evidence`, evidence: item.path });
  }
  if (gradeToPoints(effectiveGrade) < gradeToPoints('A')) {
    actions.push({ priority: 40 + Math.max(0, gradeToPoints('A') - gradeToPoints(effectiveGrade)), type: 'grade-gap', surfaceId: surface.id, title: `Close the ${effectiveGrade} to A gap for ${surface.label}`, detail: surface.stricterABar });
  }
  return actions;
}

function valueAtJsonPath(value, jsonPath = '') {
  return String(jsonPath).split('.').filter(Boolean).reduce((current, key) => current?.[key], value);
}

export function deriveSurfaceGrade(surface = {}, evidence = []) {
  const source = surface.gradeSource;
  if (!source?.path || !source.jsonPath) return { grade: surface.currentGrade, source: 'configured' };
  const item = evidence.find((entry) => normalizePath(entry.path) === normalizePath(source.path));
  if (!item?.exists || item.status === 'invalid') return { grade: surface.currentGrade, source: 'configured-fallback' };
  try {
    const json = JSON.parse(readFileSync(item.absolutePath, 'utf8'));
    const grade = valueAtJsonPath(json, source.jsonPath);
    return GRADE_POINTS.hasOwnProperty(grade)
      ? { grade, source: source.path }
      : { grade: surface.currentGrade, source: 'configured-fallback' };
  } catch {
    return { grade: surface.currentGrade, source: 'configured-fallback' };
  }
}

function compareGrade(current, previous) {
  const delta = gradeToPoints(current) - gradeToPoints(previous || current);
  return { previous: previous || null, current, delta, direction: delta > 0 ? 'improved' : delta < 0 ? 'regressed' : 'steady' };
}

export function buildPortfolio({
  config,
  changedFiles = [],
  evidenceBySurface = {},
  checkResults = [],
  promotionState = {},
  previous = null,
  reportInventory = [],
  checklistText = '',
  selectedSurfaceIds = [],
  now = new Date(),
  runtimeMs = 0,
} = {}) {
  const changed = classifyChangedFiles(changedFiles, config.surfaces || []);
  const changedIds = new Set(changed.map((entry) => entry.id));
  const measuredIds = new Set(selectedSurfaceIds.length ? selectedSurfaceIds : changed.map((entry) => entry.id));
  const actions = [];
  const surfaces = (config.surfaces || []).map((surface) => {
    const evidence = evidenceBySurface[surface.id] || [];
    const surfaceChecks = checkResults.filter((entry) => entry.surfaceIds?.includes(surface.id));
    const required = evidence.filter((entry) => entry.required);
    const derivedGrade = deriveSurfaceGrade(surface, evidence);
    let observedGrade = derivedGrade.grade;
    const hasFailure = surfaceChecks.some((entry) => ['fail', 'timed-out'].includes(entry.status));
    const hasMissing = required.some((entry) => ['missing', 'invalid', 'insufficient'].includes(entry.status));
    const hasStale = required.some((entry) => entry.status === 'stale');
    if (hasFailure || hasMissing) observedGrade = capGrade(observedGrade, 'C');
    else if (hasStale) observedGrade = capGrade(observedGrade, 'B');
    const ranChecks = surfaceChecks.length > 0;
    const confidence = hasFailure || hasMissing ? 'low' : hasStale || !ranChecks ? 'medium' : 'high';
    const surfaceActions = nextActionsForSurface(surface, evidence, checkResults, observedGrade);
    actions.push(...surfaceActions);
    return {
      id: surface.id,
      label: surface.label,
      owner: surface.owner,
      objective: surface.objective,
      stricterABar: surface.stricterABar,
      configuredGrade: surface.currentGrade,
      gradeSource: derivedGrade.source,
      observedGrade,
      confidence,
      changed: changedIds.has(surface.id),
      inScope: measuredIds.has(surface.id),
      changedFiles: changed.find((entry) => entry.id === surface.id)?.matchedFiles || [],
      promotionState: promotionState.surfaces?.[surface.id]?.state || 'idea',
      evidence,
      checks: surfaceChecks.map((entry) => ({ id: entry.id, status: entry.status, durationMs: entry.durationMs })),
      nextAction: surfaceActions.sort((a, b) => b.priority - a.priority)[0] || null,
    };
  });

  const totalWeight = (config.surfaces || []).reduce((sum, surface) => sum + (surface.weight || 1), 0) || 1;
  const weighted = surfaces.reduce((sum, surface) => {
    const weight = config.surfaces.find((item) => item.id === surface.id)?.weight || 1;
    return sum + gradeToPoints(surface.observedGrade) * weight;
  }, 0) / totalWeight;
  const aggregateGrade = pointsToGrade(weighted);
  const previousGrade = previous?.aggregate?.grade || null;
  const evidence = surfaces.flatMap((surface) => surface.evidence);
  const requiredEvidence = evidence.filter((entry) => entry.required);
  const currentEvidence = requiredEvidence.filter((entry) => entry.status === 'current');
  const failedChecks = checkResults.filter((entry) => ['fail', 'timed-out'].includes(entry.status));
  const measuredSurfaceCount = surfaces.filter((surface) => surface.inScope).length;
  const changedSurfaceCount = surfaces.filter((surface) => surface.changed).length;
  const changedWithEvidence = surfaces.filter((surface) => surface.changed && surface.evidence.some((item) => item.status === 'current')).length;
  const progress = checklistProgress(checklistText);
  const humanSurface = surfaces.find((surface) => surface.id === 'player-validation');
  const humanEvidence = humanSurface?.evidence.find((item) => item.kind === 'human-observation');
  const rankedActions = actions
    .sort((a, b) => b.priority - a.priority || a.surfaceId.localeCompare(b.surfaceId))
    .filter((action, index, all) => all.findIndex((item) => `${item.surfaceId}:${item.type}:${item.evidence || item.title}` === `${action.surfaceId}:${action.type}:${action.evidence || action.title}`) === index)
    .map(({ priority, ...action }) => action);

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    configVersion: config.version,
    status: failedChecks.length > 0 ? 'fail' : requiredEvidence.some((item) => ['missing', 'invalid', 'insufficient'].includes(item.status)) ? 'attention' : 'pass',
    aggregate: {
      grade: aggregateGrade,
      confidence: surfaces.some((surface) => surface.confidence === 'low') ? 'low' : surfaces.some((surface) => surface.confidence === 'medium') ? 'medium' : 'high',
      comparison: compareGrade(aggregateGrade, previousGrade),
    },
    changedFiles,
    surfaces,
    checks: checkResults,
    nextActions: rankedActions,
    nextAction: rankedActions[0] || null,
    metrics: {
      diagnosisTimeMs: runtimeMs,
      regressionRate: checkResults.length ? failedChecks.length / checkResults.length : 0,
      staleReportCount: reportInventory.filter((report) => report.stale).length,
      verificationCoverage: measuredSurfaceCount ? surfaces.filter((surface) => surface.inScope && surface.checks.length > 0).length / measuredSurfaceCount : 1,
      evidenceFreshnessRate: requiredEvidence.length ? currentEvidence.length / requiredEvidence.length : 1,
      changeToEvidenceRate: changedSurfaceCount ? changedWithEvidence / changedSurfaceCount : 1,
      recommendationCompletionRate: progress.rate,
      recommendationProgress: progress,
      humanPlaytests: humanEvidence?.recordCount || 0,
    },
    reportInventory,
  };
}

function percent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

export function compactPublicReport(report = {}) {
  return {
    schemaVersion: report.schemaVersion,
    generatedAt: report.generatedAt,
    status: report.status,
    aggregate: report.aggregate,
    surfaces: (report.surfaces || []).map((surface) => ({
      id: surface.id,
      label: surface.label,
      grade: surface.observedGrade,
      confidence: surface.confidence,
      promotionState: surface.promotionState,
      nextAction: surface.nextAction?.title || null,
    })),
    nextAction: report.nextAction,
    metrics: report.metrics,
  };
}

export function markdownForPortfolio(report = {}) {
  const lines = [
    '# Improvement Portfolio',
    '',
    `Generated: ${report.generatedAt || 'unknown'}`,
    `Status: ${report.status || 'unknown'}`,
    `Grade: ${report.aggregate?.grade || 'n/a'} (${report.aggregate?.confidence || 'unknown'} confidence)`,
    '',
    '## Quality Surfaces',
    '',
    '| Surface | Grade | Confidence | Promotion | Changed |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const surface of report.surfaces || []) {
    lines.push(`| ${surface.label} | ${surface.observedGrade} | ${surface.confidence} | ${surface.promotionState} | ${surface.changed ? 'yes' : 'no'} |`);
  }
  lines.push('', '## System Metrics', '');
  lines.push(`- Evidence freshness: ${percent(report.metrics?.evidenceFreshnessRate)}`);
  lines.push(`- Verification coverage: ${percent(report.metrics?.verificationCoverage)}`);
  lines.push(`- Change-to-evidence rate: ${percent(report.metrics?.changeToEvidenceRate)}`);
  lines.push(`- Recommendation completion: ${percent(report.metrics?.recommendationCompletionRate)}`);
  lines.push(`- Recent human playtests: ${report.metrics?.humanPlaytests || 0}`);
  lines.push(`- Stale registered reports: ${report.metrics?.staleReportCount || 0}`);
  lines.push('', '## Ranked Next Actions', '');
  if (!(report.nextActions || []).length) lines.push('- No quality gaps detected. Raise the A bar before the next iteration.');
  for (const [index, action] of (report.nextActions || []).slice(0, 12).entries()) {
    lines.push(`${index + 1}. [${action.surfaceId}] ${action.title}`);
    if (action.command) lines.push(`   Command: \`${action.command}\``);
  }
  return `${lines.join('\n')}\n`;
}
