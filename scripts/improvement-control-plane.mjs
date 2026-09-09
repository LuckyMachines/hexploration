#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  actionFingerprint,
  buildPortfolio,
  buildRemediationPlan,
  classifyChangedFiles,
  compactPublicReport,
  evaluateReportRegistry,
  evaluateSurfaceEvidence,
  markdownForPortfolio,
  markdownForApplyReport,
  parseGitStatus,
  pathsOutsideDeclared,
  selectCommands,
  validateConfig,
  validatePromotionTransition,
  validateQualityRecords,
} from './improvement-control-plane-utils.mjs';

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CONFIG_PATH = 'improvement/improvement-system.json';
const REPORT_REGISTRY_PATH = 'improvement/report-registry.json';
const PROMOTION_PATH = 'improvement/records/promotion-state.json';
const EXPERIMENTS_PATH = 'improvement/records/experiments.json';
const DECISIONS_PATH = 'improvement/records/decisions.json';
const PLAYTESTS_PATH = 'improvement/records/playtests.json';
const CHECKLIST_PATH = 'docs/improvement-system-checklist.md';
const LATEST_JSON_PATH = 'reports/improvement/latest-portfolio.json';
const LATEST_MD_PATH = 'reports/improvement/latest-portfolio.md';
const PUBLIC_PATH = 'app/public/improvement/latest-portfolio.json';
const HISTORY_PATH = 'reports/improvement/history.json';
const BASELINE_PATH = 'reports/improvement/baseline.json';
const APPLY_JSON_PATH = 'reports/improvement/latest-apply.json';
const APPLY_MD_PATH = 'reports/improvement/latest-apply.md';
const APPLY_LOCK_PATH = 'reports/improvement/apply.lock';

function readText(path, fallback = '') {
  const full = resolve(root, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : fallback;
}

function readJson(path, fallback = null) {
  const text = readText(path);
  if (!text) return fallback;
  return JSON.parse(text);
}

function writeText(path, text) {
  const full = resolve(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

function writeJson(path, value) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function flag(args, name, fallback = null) {
  const prefix = `--${name}=`;
  const direct = args.find((value) => value.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback;
}

function has(args, name) {
  return args.includes(`--${name}`);
}

function listFlag(args, name) {
  return String(flag(args, name, '')).split(',').map((value) => value.trim()).filter(Boolean);
}

function requiredFlag(args, name) {
  const value = flag(args, name);
  if (!value) throw new Error(`Missing required flag --${name}=...`);
  return value;
}

function changedFiles() {
  try {
    const output = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8', windowsHide: true });
    return parseGitStatus(output);
  } catch (error) {
    throw new Error(`Could not inspect changed files: ${error.message}`);
  }
}

function loadContext(now = new Date()) {
  const config = readJson(CONFIG_PATH);
  const registry = readJson(REPORT_REGISTRY_PATH, { reports: [] });
  const promotionState = readJson(PROMOTION_PATH, { surfaces: {} });
  const evidenceBySurface = Object.fromEntries((config?.surfaces || []).map((surface) => [surface.id, evaluateSurfaceEvidence(root, surface, now)]));
  return { config, registry, promotionState, evidenceBySurface };
}

function commandInvocation(command) {
  if (process.platform === 'win32' && ['npm', 'npx'].includes(command.command)) {
    return {
      executable: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `${command.command}.cmd`, ...(command.args || [])],
    };
  }
  return { executable: command.command, args: command.args || [] };
}

function tail(text = '', maxLines = 50) {
  return String(text).split(/\r?\n/).slice(-maxLines).join('\n').trim();
}

function commandText(command) {
  return [command.command, ...(command.args || [])].join(' ');
}

function executeCommand(command) {
  const started = Date.now();
  const invocation = commandInvocation(command);
  process.stdout.write(`\n[verify] ${command.label}\n`);
  process.stdout.write(`         ${commandText(command)}\n`);
  const result = spawnSync(invocation.executable, invocation.args, {
    cwd: resolve(root, command.cwd || '.'),
    encoding: 'utf8',
    timeout: command.timeoutMs || 120_000,
    windowsHide: true,
    shell: false,
    maxBuffer: 20 * 1024 * 1024,
  });
  const durationMs = Date.now() - started;
  const timedOut = result.error?.code === 'ETIMEDOUT';
  const status = timedOut ? 'timed-out' : result.status === 0 ? 'pass' : 'fail';
  const stdoutTail = tail(result.stdout);
  const stderrTail = tail(result.stderr);
  if (stdoutTail) process.stdout.write(`${stdoutTail}\n`);
  if (stderrTail) process.stderr.write(`${stderrTail}\n`);
  process.stdout.write(`[${status}] ${command.id} (${durationMs}ms)\n`);
  return {
    id: command.id,
    label: command.label,
    status,
    durationMs,
    commandText: commandText(command),
    retryCommand: commandText(command),
    surfaceIds: command.surfaceIds,
    exitCode: result.status,
    stdoutTail,
    stderrTail: stderrTail || result.error?.message || '',
  };
}

function surfaceScope(config, files, args) {
  if (has(args, 'all')) return config.surfaces.map((surface) => surface.id);
  const requested = listFlag(args, 'scope');
  if (requested.length) {
    const known = new Set(config.surfaces.map((surface) => surface.id));
    const unknown = requested.filter((id) => !known.has(id));
    if (unknown.length) throw new Error(`Unknown surface scope: ${unknown.join(', ')}`);
    return requested;
  }
  const detected = classifyChangedFiles(files, config.surfaces).map((entry) => entry.id);
  return detected.length ? detected : ['improvement-system'];
}

function printPlan(config, files, scope, mode) {
  const classifications = classifyChangedFiles(files, config.surfaces);
  const commands = selectCommands(config, scope, mode);
  console.log(`# Improvement plan (${mode})`);
  console.log(`Changed files: ${files.length}`);
  console.log(`Impacted surfaces: ${scope.join(', ')}`);
  for (const entry of classifications.filter((item) => scope.includes(item.id))) {
    console.log(`- ${entry.id}: ${entry.matchedFiles.length} changed file(s)`);
  }
  console.log('Verification:');
  if (!commands.length) console.log('- none');
  for (const command of commands) console.log(`- ${command.id}: ${commandText(command)}`);
  return { classifications, commands };
}

function previousPortfolio() {
  return readJson(BASELINE_PATH, readJson(LATEST_JSON_PATH, null));
}

function appendHistory(report) {
  const history = readJson(HISTORY_PATH, { schemaVersion: 1, snapshots: [] });
  const snapshot = {
    generatedAt: report.generatedAt,
    status: report.status,
    aggregate: report.aggregate,
    metrics: report.metrics,
    surfaces: report.surfaces.map((surface) => ({ id: surface.id, grade: surface.observedGrade, confidence: surface.confidence, promotionState: surface.promotionState })),
    nextAction: report.nextAction,
  };
  history.snapshots = [...(history.snapshots || []), snapshot].slice(-100);
  writeJson(HISTORY_PATH, history);
}

function persistPortfolio(report) {
  writeJson(LATEST_JSON_PATH, report);
  writeText(LATEST_MD_PATH, markdownForPortfolio(report));
  writeJson(PUBLIC_PATH, compactPublicReport(report));
  appendHistory(report);
}

function runPortfolio(args, { deferExit = false } = {}) {
  const started = Date.now();
  const files = changedFiles();
  const { config, registry, promotionState } = loadContext(new Date());
  const valid = validateConfig(config);
  if (!valid.ok) throw new Error(`Invalid improvement config:\n- ${valid.errors.join('\n- ')}`);
  const mode = has(args, 'full') || has(args, 'hard') ? 'full' : 'quick';
  const scope = surfaceScope(config, files, args);
  const { commands } = printPlan(config, files, scope, mode);
  const checkResults = [];
  if (!has(args, 'no-verify')) {
    for (const command of commands) {
      const result = executeCommand(command);
      checkResults.push(result);
      if (result.status !== 'pass' && !has(args, 'continue-on-fail')) break;
    }
  }
  const now = new Date();
  const evidenceBySurface = Object.fromEntries(config.surfaces.map((surface) => [surface.id, evaluateSurfaceEvidence(root, surface, now)]));
  const reportInventory = evaluateReportRegistry(root, registry, now);
  const report = buildPortfolio({
    config,
    changedFiles: files,
    evidenceBySurface,
    checkResults,
    promotionState,
    previous: previousPortfolio(),
    reportInventory,
    checklistText: readText(CHECKLIST_PATH),
    selectedSurfaceIds: scope,
    now,
    runtimeMs: Date.now() - started,
  });
  const scopedNextAction = report.nextActions.find((action) => scope.includes(action.surfaceId)) || null;
  report.execution = { mode, scope, nextAction: scopedNextAction };
  persistPortfolio(report);
  console.log(`\nPortfolio: ${resolve(root, LATEST_MD_PATH)}`);
  console.log(`Grade: ${report.aggregate.grade} (${report.aggregate.confidence} confidence)`);
  console.log(`Next: ${scopedNextAction?.title || 'raise the quality bar'}`);
  if (!deferExit && checkResults.some((entry) => entry.status !== 'pass')) process.exitCode = 1;
  return report;
}

function applyArgs(args, { dryRun = false } = {}) {
  const omitted = new Set(['--dry-run', '--strict']);
  const clean = args.filter((value) => !omitted.has(value) && !value.startsWith('--max-repairs=') && !value.startsWith('--allow-risk='));
  if (!clean.includes('--continue-on-fail')) clean.push('--continue-on-fail');
  if (dryRun && !clean.includes('--no-verify')) clean.push('--no-verify');
  return clean;
}

function acquireApplyLock() {
  const full = resolve(root, APPLY_LOCK_PATH);
  mkdirSync(dirname(full), { recursive: true });
  try {
    const descriptor = openSync(full, 'wx');
    writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
    closeSync(descriptor);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Another improvement apply loop owns ${full}`);
    throw error;
  }
  return () => {
    if (existsSync(full)) unlinkSync(full);
  };
}

function configuredCommand(config, commandId, surfaceIds = []) {
  const command = config.commands?.[commandId];
  if (!command) throw new Error(`Unknown configured command: ${commandId}`);
  return { id: commandId, ...command, surfaceIds };
}

function fingerprintFiles(paths = []) {
  return Object.fromEntries(paths.map((path) => {
    const full = resolve(root, path);
    if (!existsSync(full) || !statSync(full).isFile()) return [path, null];
    return [path, createHash('sha256').update(readFileSync(full)).digest('hex')];
  }));
}

function touchedFiles(beforeFiles, beforeFingerprints, afterFiles) {
  const candidates = [...new Set([...beforeFiles, ...afterFiles])];
  const afterFingerprints = fingerprintFiles(candidates);
  return candidates.filter((path) => !(path in beforeFingerprints) || beforeFingerprints[path] !== afterFingerprints[path]);
}

function persistApplyReport(report) {
  writeJson(APPLY_JSON_PATH, report);
  writeText(APPLY_MD_PATH, markdownForApplyReport(report));
}

function scopedActions(portfolio) {
  const scopedIds = new Set((portfolio.surfaces || []).filter((surface) => surface.inScope).map((surface) => surface.id));
  return (portfolio.nextActions || []).filter((action) => scopedIds.has(action.surfaceId));
}

function applyImprovements(args) {
  const releaseLock = acquireApplyLock();
  try {
    const dryRun = has(args, 'dry-run');
    const maxRepairs = Math.max(1, Math.min(20, Number(flag(args, 'max-repairs', '3')) || 3));
    const maxRisk = flag(args, 'allow-risk', 'low');
    if (!['low', 'medium', 'high'].includes(maxRisk)) throw new Error('--allow-risk must be low, medium, or high');
    const runArgs = applyArgs(args);
    const diagnosisArgs = runArgs.includes('--no-verify') ? runArgs : [...runArgs, '--no-verify'];
    let portfolio = runPortfolio(diagnosisArgs, { deferExit: true });
    const config = readJson(CONFIG_PATH);
    const attempts = [];
    const attempted = [];
    let verified = false;
    let policyViolation = false;

    for (let iteration = 0; iteration < maxRepairs; iteration += 1) {
      const plan = buildRemediationPlan(scopedActions(portfolio), config, { attempted, maxRisk });
      if (!plan.next) break;
      const { action, recipe, attemptKey, fingerprint } = plan.next;
      attempted.push(attemptKey);
      const command = configuredCommand(config, recipe.commandId, recipe.surfaceIds);
      if (dryRun) {
        attempts.push({
          iteration: iteration + 1,
          recipeId: recipe.id,
          label: recipe.label,
          status: 'planned',
          command: commandText(command),
          action,
          writePaths: recipe.writePaths,
          verifyCommandIds: recipe.verifyCommandIds,
        });
        continue;
      }

      console.log(`\n[repair] ${recipe.label}`);
      const beforeFiles = changedFiles();
      const beforeFingerprints = fingerprintFiles(beforeFiles);
      const repairResult = executeCommand({ ...command, id: `repair.${recipe.id}` });
      const afterFiles = changedFiles();
      const touched = touchedFiles(beforeFiles, beforeFingerprints, afterFiles);
      const undeclaredWrites = pathsOutsideDeclared(touched, recipe.writePaths);
      if (undeclaredWrites.length) {
        policyViolation = true;
        portfolio = runPortfolio(diagnosisArgs, { deferExit: true });
        attempts.push({
          iteration: iteration + 1,
          recipeId: recipe.id,
          label: recipe.label,
          status: 'policy-violation',
          command: commandText(command),
          action,
          repairResult,
          declaredWritePaths: recipe.writePaths,
          touchedFiles: touched,
          undeclaredWrites,
        });
        break;
      }
      portfolio = runPortfolio(runArgs, { deferExit: true });
      verified = true;
      const unresolved = portfolio.nextActions.some((candidate) => actionFingerprint(candidate) === fingerprint);
      const verification = portfolio.checks.filter((check) => recipe.verifyCommandIds.includes(check.id));
      const verificationPassed = recipe.verifyCommandIds.every((id) => verification.some((check) => check.id === id && check.status === 'pass'));
      const status = repairResult.status !== 'pass' ? 'failed' : !unresolved && verificationPassed ? 'resolved' : 'ineffective';
      attempts.push({
        iteration: iteration + 1,
        recipeId: recipe.id,
        label: recipe.label,
        status,
        command: commandText(command),
        action,
        repairResult,
        verification: verification.map((check) => ({ id: check.id, status: check.status })),
        declaredWritePaths: recipe.writePaths,
        touchedFiles: touched,
      });
    }

    if (!dryRun && !verified && !policyViolation) {
      portfolio = runPortfolio(runArgs, { deferExit: true });
      verified = true;
    }

    const finalPlan = buildRemediationPlan(scopedActions(portfolio), config, { attempted, maxRisk });
    const failed = attempts.some((attempt) => ['failed', 'ineffective', 'policy-violation'].includes(attempt.status));
    const status = dryRun
      ? 'planned'
      : failed
        ? 'attention'
        : finalPlan.blocked.length
          ? attempts.length ? 'partially-applied' : 'blocked'
          : attempts.length ? 'applied' : 'stable';
    const applyReport = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      status,
      dryRun,
      maxRisk,
      maxRepairs,
      verificationRun: verified,
      attempts,
      blocked: finalPlan.blocked,
      remainingAutomatic: finalPlan.automatic.map((entry) => ({ action: entry.action, recipeId: entry.recipe.id })),
      portfolioPath: LATEST_MD_PATH,
      portfolio: {
        status: portfolio.status,
        grade: portfolio.aggregate.grade,
        confidence: portfolio.aggregate.confidence,
        nextAction: portfolio.execution?.nextAction || portfolio.nextAction,
      },
    };
    persistApplyReport(applyReport);
    console.log(`\nApply report: ${resolve(root, APPLY_MD_PATH)}`);
    if (status === 'blocked') console.log(`Blocked safely: ${finalPlan.blocked[0]?.reason || 'human judgment is required'}`);
    else console.log(`Apply status: ${status}`);
    if (failed || (has(args, 'strict') && finalPlan.blocked.length)) process.exitCode = 1;
    return applyReport;
  } finally {
    releaseLock();
  }
}

function doctor(args) {
  const now = new Date();
  const errors = [];
  const warnings = [];
  let context;
  try { context = loadContext(now); } catch (error) { errors.push(error.message); }
  if (context) {
    const validity = validateConfig(context.config);
    errors.push(...validity.errors);
    const ids = new Set(context.config.surfaces.map((surface) => surface.id));
    for (const id of ids) if (!context.promotionState.surfaces?.[id]) errors.push(`promotion state missing surface: ${id}`);
    for (const [id, entry] of Object.entries(context.promotionState.surfaces || {})) {
      if (!ids.has(id)) warnings.push(`promotion state has unknown surface: ${id}`);
      if (!context.config.promotionStates.includes(entry.state)) errors.push(`${id} has unknown promotion state: ${entry.state}`);
    }
    for (const surface of context.config.surfaces) {
      for (const evidence of context.evidenceBySurface[surface.id]) {
        if (evidence.required && evidence.status !== 'current') warnings.push(`${surface.id}: ${evidence.path} is ${evidence.status}`);
      }
    }
    for (const report of evaluateReportRegistry(root, context.registry, now)) {
      if (!report.exists && report.canonical && report.id !== 'improvement-portfolio') warnings.push(`canonical report is missing: ${report.path}`);
      if (report.stale) warnings.push(`registered report is stale: ${report.path}`);
      if (report.retirementCandidate) warnings.push(`report needs retirement review: ${report.id}`);
    }
  }
  for (const [path, key] of [[EXPERIMENTS_PATH, 'experiments'], [DECISIONS_PATH, 'decisions'], [PLAYTESTS_PATH, 'sessions']]) {
    try {
      const record = readJson(path);
      if (!record || !Array.isArray(record[key])) errors.push(`${path} must contain an array named ${key}`);
      else if (context) {
        const validity = validateQualityRecords(record[key], context.config.qualityRecordFields, context.config.surfaces.map((surface) => surface.id));
        errors.push(...validity.errors.map((error) => `${path}: ${error}`));
      }
    } catch (error) { errors.push(`${path}: ${error.message}`); }
  }
  console.log('# Improvement doctor');
  console.log(`Status: ${errors.length ? 'fail' : warnings.length ? 'attention' : 'pass'}`);
  if (errors.length) console.log(`Errors:\n- ${errors.join('\n- ')}`);
  if (warnings.length) console.log(`Warnings:\n- ${warnings.join('\n- ')}`);
  if (!errors.length && !warnings.length) console.log('All quality contracts and current evidence are healthy.');
  if (errors.length || (has(args, 'warnings-as-errors') && warnings.length)) process.exitCode = 1;
  return { errors, warnings };
}

function addRecord(path, collection, record) {
  const store = readJson(path, { schemaVersion: 1, [collection]: [] });
  if ((store[collection] || []).some((item) => item.id === record.id)) throw new Error(`Duplicate ${collection} id: ${record.id}`);
  store[collection] = [...(store[collection] || []), record];
  store.updatedAt = new Date().toISOString();
  writeJson(path, store);
  console.log(`Recorded ${record.id} in ${resolve(root, path)}`);
}

function recordExperiment(args) {
  const now = new Date().toISOString();
  const hypothesis = requiredFlag(args, 'hypothesis');
  addRecord(EXPERIMENTS_PATH, 'experiments', {
    id: requiredFlag(args, 'id'),
    surface: requiredFlag(args, 'surface'),
    objective: flag(args, 'objective', `Test whether ${hypothesis}`),
    hypothesis,
    baseline: flag(args, 'baseline', 'not-recorded'),
    metric: requiredFlag(args, 'metric'),
    target: requiredFlag(args, 'target'),
    evidence: [],
    grade: 'pending',
    confidence: 'low',
    decision: 'pending',
    owner: requiredFlag(args, 'owner'),
    nextExperiment: flag(args, 'next-experiment', 'decide after evidence'),
    status: 'planned',
    createdAt: now,
  });
}

function recordDecision(args) {
  const decision = requiredFlag(args, 'decision');
  addRecord(DECISIONS_PATH, 'decisions', {
    id: requiredFlag(args, 'id'),
    surface: requiredFlag(args, 'surface'),
    objective: flag(args, 'objective', 'Convert evidence into an explicit quality decision.'),
    hypothesis: flag(args, 'hypothesis', 'The cited evidence is sufficient to make this decision.'),
    baseline: flag(args, 'baseline', 'undecided'),
    evidence: listFlag(args, 'evidence'),
    grade: flag(args, 'grade', 'pending'),
    confidence: flag(args, 'confidence', 'medium'),
    decision,
    owner: requiredFlag(args, 'owner'),
    nextExperiment: requiredFlag(args, 'next-experiment'),
    recordedAt: new Date().toISOString(),
  });
}

function recordPlaytest(args) {
  const severity = flag(args, 'severity', 'medium');
  if (!['low', 'medium', 'high', 'critical'].includes(severity)) throw new Error('--severity must be low, medium, high, or critical');
  const recommendationAgreement = flag(args, 'recommendation-agreement', null);
  if (recommendationAgreement && !['agree', 'disagree'].includes(recommendationAgreement)) throw new Error('--recommendation-agreement must be agree or disagree');
  const funScore = flag(args, 'fun-score', null);
  const automatedFunScore = flag(args, 'automated-fun-score', null);
  if (funScore !== null && (!Number.isFinite(Number(funScore)) || Number(funScore) < 0 || Number(funScore) > 100)) throw new Error('--fun-score must be 0-100');
  if (automatedFunScore !== null && (!Number.isFinite(Number(automatedFunScore)) || Number(automatedFunScore) < 0 || Number(automatedFunScore) > 100)) throw new Error('--automated-fun-score must be 0-100');
  const observation = requiredFlag(args, 'observations');
  addRecord(PLAYTESTS_PATH, 'sessions', {
    id: requiredFlag(args, 'id'),
    surface: 'player-validation',
    scenario: requiredFlag(args, 'scenario'),
    cohort: requiredFlag(args, 'cohort'),
    objective: flag(args, 'objective', 'Observe comprehension, delight, pacing, cooperation, and return intent.'),
    hypothesis: flag(args, 'hypothesis', 'The player can understand and enjoy the tested loop without outside explanation.'),
    baseline: flag(args, 'baseline', 'no prior observed session for this participant'),
    observations: observation,
    evidence: listFlag(args, 'evidence'),
    severity,
    funScore: funScore === null ? null : Number(funScore),
    automatedFunScore: automatedFunScore === null ? null : Number(automatedFunScore),
    recommendationAgreement,
    unassistedFirstAction: flag(args, 'unassisted-first-action', null),
    returnIntent: flag(args, 'return-intent', null),
    grade: flag(args, 'grade', 'pending'),
    confidence: flag(args, 'confidence', 'medium'),
    decision: requiredFlag(args, 'decision'),
    owner: requiredFlag(args, 'owner'),
    nextExperiment: flag(args, 'next-experiment', 'repeat with the next representative participant'),
    consentSafe: true,
    recordedAt: new Date().toISOString(),
  });
}

function promote(args) {
  const config = readJson(CONFIG_PATH);
  const state = readJson(PROMOTION_PATH, { schemaVersion: 1, surfaces: {}, history: [] });
  const surfaceId = requiredFlag(args, 'surface');
  const to = requiredFlag(args, 'to');
  const current = state.surfaces?.[surfaceId];
  if (!current) throw new Error(`Unknown promotion surface: ${surfaceId}`);
  const validity = validatePromotionTransition(config, current.state, to);
  if (!validity.ok) throw new Error(validity.error);
  const evidence = listFlag(args, 'evidence');
  if (!evidence.length) throw new Error('Promotion requires --evidence=path[,path]');
  const decision = requiredFlag(args, 'decision');
  const at = new Date().toISOString();
  state.surfaces[surfaceId] = { state: to, evidence, decision, updatedAt: at };
  state.history = [...(state.history || []), { surface: surfaceId, from: current.state, to, evidence, decision, at }].slice(-200);
  state.updatedAt = at;
  writeJson(PROMOTION_PATH, state);
  console.log(`Promoted ${surfaceId}: ${current.state} -> ${to}`);
}

function retirementReview() {
  const registry = readJson(REPORT_REGISTRY_PATH, { reports: [] });
  const reports = evaluateReportRegistry(root, registry, new Date());
  console.log('# Report retirement review');
  for (const report of reports) {
    const status = report.retirementCandidate ? 'REVIEW' : report.stale ? 'STALE' : report.exists ? 'KEEP' : 'MISSING';
    console.log(`- ${status} ${report.id}: ${report.path}${report.supersededBy ? ` (superseded by ${report.supersededBy})` : ''}`);
  }
  console.log('No files were deleted. Update the registry after a human confirms retirement.');
}

function showLatest(args) {
  let report = readJson(LATEST_JSON_PATH, null);
  if (!report) report = runPortfolio(['--no-verify', '--scope=improvement-system']);
  console.log(has(args, 'markdown') ? markdownForPortfolio(report) : JSON.stringify(report, null, 2));
}

function saveBaseline() {
  const report = readJson(LATEST_JSON_PATH, null);
  if (!report) throw new Error('No latest portfolio exists. Run npm run improve first.');
  writeJson(BASELINE_PATH, report);
  console.log(`Saved baseline: ${resolve(root, BASELINE_PATH)}`);
}

function usage() {
  console.log(`Xenovoya Improvement Control Plane

Commands:
  apply [--scope=id,id|--all] [--quick|--full] [--dry-run] [--max-repairs=3] [--allow-risk=low]
  run [--scope=id,id] [--quick|--full] [--no-verify] [--continue-on-fail]
  plan [--scope=id,id] [--quick|--full]
  latest [--markdown]
  doctor [--warnings-as-errors]
  baseline
  experiment --id --surface --hypothesis --metric --target --owner
  decision --id --surface --decision --evidence --owner --next-experiment
  playtest --id --scenario --cohort --observations --severity --decision --owner [--fun-score=0-100 --automated-fun-score=0-100 --recommendation-agreement=agree|disagree]
  promote --surface --to --evidence --decision
  retire`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] && !args[0].startsWith('--') ? args.shift() : 'apply';
  if (command === 'apply') applyImprovements(args);
  else if (command === 'run') runPortfolio(args);
  else if (command === 'plan') {
    const { config } = loadContext();
    const files = changedFiles();
    const scope = surfaceScope(config, files, args);
    printPlan(config, files, scope, has(args, 'full') ? 'full' : 'quick');
  } else if (command === 'latest') showLatest(args);
  else if (command === 'doctor') doctor(args);
  else if (command === 'baseline') saveBaseline();
  else if (command === 'experiment') recordExperiment(args);
  else if (command === 'decision') recordDecision(args);
  else if (command === 'playtest') recordPlaytest(args);
  else if (command === 'promote') promote(args);
  else if (command === 'retire') retirementReview();
  else if (['help', '--help', '-h'].includes(command)) usage();
  else throw new Error(`Unknown command: ${command}`);
}

try { main(); } catch (error) {
  console.error(`Improvement control plane failed: ${error.message}`);
  process.exitCode = 1;
}
