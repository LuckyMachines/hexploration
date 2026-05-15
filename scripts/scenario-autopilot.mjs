#!/usr/bin/env node
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  applyAutopilotCandidate,
  autopilotLimits,
  balancePath,
  buildAutopilotReport,
  compareAutopilotRuns,
  designMemoMarkdown,
  evaluateReportWithOracle,
  generateAutopilotCandidates,
  loadBalance,
  readLatestAutopilotReport,
  resolveAutopilotScenario,
  rollbackAutopilotPatch,
  selectAutopilotCandidate,
  writeAutopilotReport,
} from './scenario-autopilot-utils.mjs';
import {
  findScenario,
  loadScenarioStore,
  readJson,
  root,
  runSimulatorForScenario,
  saveScenarioStore,
  scenarioReportRoot,
  scenarioStorePath,
  upsertScenario,
} from './scenario-utils.mjs';

const argv = process.argv.slice(2);
const commandNames = new Set(['run', 'dry', 'dry-run', 'scenario', 'latest', 'explain']);
const command = commandNames.has(argv[0]) ? argv[0] : 'run';
const rest = commandNames.has(argv[0]) ? argv.slice(1) : argv;

function arg(name, fallback) {
  const found = rest.find((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!found) return fallback;
  const eq = found.indexOf('=');
  return eq >= 0 ? found.slice(eq + 1) : true;
}

function boolArg(name, fallback = false) {
  const value = arg(name, fallback);
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'no'].includes(String(value).toLowerCase());
}

function positional() {
  return rest.filter((value) => !value.startsWith('--')).join(' ').trim();
}

function print(value) {
  if (boolArg('markdown', false)) {
    console.log(typeof value === 'string' ? value : designMemoMarkdown(value));
    return;
  }
  if (typeof value === 'string') console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

function modeFromArgs(fallback = 'single-pass') {
  if (command === 'dry' || command === 'dry-run' || boolArg('dry-run', false) || boolArg('no-run', false)) return 'dry-run';
  if (command === 'latest' || command === 'explain') return 'explain';
  return String(arg('mode', fallback));
}

function scenarioPlan({ save = false } = {}) {
  const store = loadScenarioStore();
  const id = arg('id', '');
  const intentText = positional() || String(arg('intent', ''));
  if (!id && !intentText) throw new Error('Provide an intent string or --id=<scenario-id>.');
  return resolveAutopilotScenario({
    intentText,
    id,
    store,
    save,
    options: {
      batch: arg('batch', undefined),
      turns: arg('turns', undefined),
      players: arg('players', undefined),
      seed: arg('seed', undefined),
      setupMode: arg('setup-mode', 'best-effort'),
    },
  });
}

function scenarioLatestReportPath(id) {
  return resolve(scenarioReportRoot, id, 'latest-report.json');
}

function runScenarioAndOracle(scenario, limits, setupMode) {
  const result = runSimulatorForScenario(scenario, {
    scenarioFile: scenarioStorePath,
    quiet: true,
    setupForge: !boolArg('no-setup-forge', false),
    setupMode,
    timeoutMs: limits.timeoutMs,
  });
  if (result.status !== 0) {
    const message = result.error?.message || result.stderr || result.stdout || `scenario ${scenario.id} failed`;
    throw new Error(message.trim());
  }
  const reportPath = scenarioLatestReportPath(scenario.id);
  if (!existsSync(reportPath)) throw new Error(`Simulator finished without writing ${reportPath}`);
  const report = readJson(reportPath);
  const oracle = evaluateReportWithOracle(report, scenario, reportPath);
  return { report, oracle, reportPath };
}

function dryCommand() {
  const plan = scenarioPlan({ save: boolArg('save', false) });
  const limits = autopilotLimits({
    iterations: arg('iterations', arg('max-iterations', 0)),
    timeoutMs: arg('timeout-ms', undefined),
    targetScore: arg('target-score', undefined),
    targetConfidence: arg('target-confidence', undefined),
    maxCandidates: arg('max-candidates', undefined),
  });
  const candidates = generateAutopilotCandidates({
    scenario: plan.scenario,
    setupValidation: plan.setupValidation,
    balance: loadBalance(),
    maxCandidates: limits.maxCandidates,
  });
  const report = buildAutopilotReport({
    mode: 'dry-run',
    intent: plan.intent,
    scenario: plan.scenario,
    setupForge: plan.setupForge,
    setupValidation: plan.setupValidation,
    candidates,
    selectedChange: selectAutopilotCandidate(candidates),
    limits,
    events: [{ type: 'plan', message: 'Dry-run plan generated without simulator execution.' }],
  });
  print(writeAutopilotReport(report));
}

function latestCommand() {
  const latest = readLatestAutopilotReport();
  if (!latest) throw new Error('No Autopilot report found. Run npm run autopilot:dry first.');
  print(command === 'explain' || boolArg('memo', false) ? designMemoMarkdown(latest) : latest);
}

function saveScenario(scenario) {
  const store = loadScenarioStore();
  saveScenarioStore(upsertScenario(store, scenario));
}

function currentScenario(id) {
  const scenario = findScenario(loadScenarioStore(), id);
  if (!scenario) throw new Error(`Scenario ${id} disappeared during Autopilot run.`);
  return scenario;
}

function singlePassCommand({ write = true } = {}) {
  const mode = modeFromArgs('single-pass');
  const plan = scenarioPlan({ save: true });
  const limits = autopilotLimits({
    iterations: arg('iterations', arg('max-iterations', 1)),
    timeoutMs: arg('timeout-ms', undefined),
    targetScore: arg('target-score', undefined),
    targetConfidence: arg('target-confidence', undefined),
    maxCandidates: arg('max-candidates', undefined),
  });
  const setupMode = String(arg('setup-mode', 'best-effort'));
  const events = [{ type: 'scenario', message: `Scenario ${plan.scenario.id} saved for Autopilot.` }];
  const baseline = runScenarioAndOracle(plan.scenario, limits, setupMode);
  events.push({ type: 'baseline', message: `Baseline Oracle ${baseline.oracle.oracleVerdict} at ${baseline.oracle.weightedScore}.` });
  const candidates = generateAutopilotCandidates({
    scenario: plan.scenario,
    baselineReport: baseline.report,
    baselineOracle: baseline.oracle,
    setupValidation: plan.setupValidation,
    balance: loadBalance(),
    maxCandidates: limits.maxCandidates,
  });
  const selectedChange = selectAutopilotCandidate(candidates);
  const report = buildAutopilotReport({
    mode,
    intent: plan.intent,
    scenario: plan.scenario,
    setupForge: plan.setupForge,
    setupValidation: plan.setupValidation,
    baselineReport: baseline.report,
    baselineOracle: baseline.oracle,
    candidates,
    selectedChange,
    limits,
    events,
  });
  const written = write ? writeAutopilotReport(report) : report;
  print(written);
  return written;
}

function iterateCommand() {
  const plan = scenarioPlan({ save: true });
  const limits = autopilotLimits({
    iterations: arg('iterations', arg('max-iterations', 2)),
    timeoutMs: arg('timeout-ms', undefined),
    targetScore: arg('target-score', undefined),
    targetConfidence: arg('target-confidence', undefined),
    maxCandidates: arg('max-candidates', undefined),
  });
  const setupMode = String(arg('setup-mode', 'best-effort'));
  const shouldApply = boolArg('apply', false);
  const events = [{ type: 'scenario', message: `Scenario ${plan.scenario.id} saved for iterative Autopilot.` }];
  let activeScenario = plan.scenario;
  let baseline = runScenarioAndOracle(activeScenario, limits, setupMode);
  let finalRun = null;
  let finalOracle = null;
  let comparison = null;
  let selectedChange = null;
  let candidates = [];
  let appliedPatch = null;

  for (let iteration = 1; iteration <= limits.maxIterations; iteration += 1) {
    candidates = generateAutopilotCandidates({
      scenario: activeScenario,
      baselineReport: baseline.report,
      baselineOracle: baseline.oracle,
      setupValidation: plan.setupValidation,
      balance: loadBalance(),
      maxCandidates: limits.maxCandidates,
    });
    selectedChange = selectAutopilotCandidate(candidates);
    if (!selectedChange) {
      events.push({ type: 'stop', message: 'No candidate was available.' });
      break;
    }
    events.push({ type: 'candidate', iteration, message: selectedChange.title });
    if (!shouldApply) {
      events.push({ type: 'stop', message: 'Candidate not applied because --apply was not set.' });
      break;
    }
    appliedPatch = applyAutopilotCandidate(selectedChange);
    activeScenario = currentScenario(activeScenario.id);
    const rerun = runScenarioAndOracle(activeScenario, limits, setupMode);
    comparison = compareAutopilotRuns(baseline.report, baseline.oracle, rerun.report, rerun.oracle);
    finalRun = rerun.report;
    finalOracle = rerun.oracle;
    if (!comparison.accepted) {
      const rollback = rollbackAutopilotPatch(appliedPatch);
      events.push({ type: 'rollback', iteration, message: comparison.rejectedReasons.join(' / ') || 'Candidate rejected.', rollback });
      activeScenario = currentScenario(activeScenario.id);
      break;
    }
    events.push({ type: 'accepted', iteration, message: `Accepted ${selectedChange.title}.` });
    baseline = rerun;
    if (rerun.oracle.weightedScore >= limits.targetScore && rerun.oracle.confidence >= limits.targetConfidence) break;
  }

  saveScenario(activeScenario);
  const report = buildAutopilotReport({
    mode: 'iterate',
    intent: plan.intent,
    scenario: activeScenario,
    setupForge: activeScenario.setupForge,
    setupValidation: plan.setupValidation,
    baselineReport: baseline.report,
    baselineOracle: baseline.oracle,
    candidates,
    selectedChange,
    rerunReport: finalRun,
    finalOracle,
    comparison,
    limits,
    events,
  });
  print(writeAutopilotReport(report));
}

try {
  const mode = modeFromArgs(command === 'scenario' ? 'single-pass' : 'single-pass');
  if (command === 'latest' || command === 'explain') latestCommand();
  else if (mode === 'dry-run') dryCommand();
  else if (mode === 'iterate') iterateCommand();
  else singlePassCommand();
} catch (error) {
  console.error(`[autopilot] ${error.message || String(error)}`);
  process.exit(1);
}
