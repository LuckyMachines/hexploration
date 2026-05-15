#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { spawnSync } from 'child_process';
import {
  doctorReport,
  evaluateOracle,
  latestSimulatorReportPath,
  markdownForOracle,
  oracleReportRoot,
  oracleTaskFromRecommendation,
  readLatestOracle,
  readOracleHistory,
  summarizeOraclePack,
  writeOracleReport,
} from './gameplay-oracle-utils.mjs';
import {
  findScenario,
  loadScenarioStore,
  readJson,
  root,
  runSimulatorForScenario,
  scenarioReportRoot,
  scenarioStorePath,
  writeJson,
} from './scenario-utils.mjs';

const argv = process.argv.slice(2);
const command = argv[0] || 'latest';
const rest = argv.slice(1);

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
  if (boolArg('markdown', false) && typeof value !== 'string') console.log(markdownForOracle(value));
  else if (typeof value === 'string') console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

function loadTuningConfig() {
  return readJson(resolve(root, 'simulator.tuning.json'), {});
}

function loadReport(path) {
  const resolved = resolve(root, path || latestSimulatorReportPath);
  if (!existsSync(resolved)) throw new Error(`No simulator report found at ${resolved}`);
  return { path: resolved, report: readJson(resolved) };
}

function scenarioById(id) {
  const store = loadScenarioStore();
  const scenario = findScenario(store, id);
  if (!scenario) throw new Error(`Unknown scenario id: ${id}`);
  return { store, scenario };
}

function evaluateReport({ report, sourceReportPath, scenario = null, scenarioId = null, write = true }) {
  const tuning = loadTuningConfig();
  const history = readOracleHistory(scenarioId);
  const baselinePath = arg('baseline', null);
  const baselineOracle = baselinePath ? readJson(resolve(root, String(baselinePath)), null) : null;
  const oracle = evaluateOracle(report, scenario, {
    sourceReportPath,
    weights: tuning.oracleWeights || {},
    gates: tuning.oracleGates || {},
    baselineOracle,
    history,
    blockOnUnsupported: boolArg('block-on-unsupported', false),
  });
  if (write) {
    const paths = writeOracleReport(oracle, { scenarioId: null, markdown: true });
    if (scenarioId || scenario?.id) writeOracleReport(oracle, { scenarioId: scenarioId || scenario.id, markdown: true });
    oracle.paths = paths;
    if (boolArg('write-tasks', false)) {
      const task = oracleTaskFromRecommendation(oracle.smallestNextExperiment);
      writeJson(resolve(oracleReportRoot, 'latest-tasks.json'), task ? [task] : []);
    }
  }
  if (boolArg('gate', false) && oracle.gate && !oracle.gate.passed) {
    print(oracle);
    process.exit(1);
  }
  return oracle;
}

function latestCommand() {
  const reportPath = String(arg('report', latestSimulatorReportPath));
  const loaded = loadReport(reportPath);
  const oracle = evaluateReport({
    report: loaded.report,
    sourceReportPath: loaded.path,
    scenario: loaded.report.scenarioDefinition || null,
    scenarioId: loaded.report.scenarioDefinition?.id || null,
  });
  if (boolArg('next-only', false)) return print(oracle.smallestNextExperiment || {});
  print(oracle);
}

function scenarioCommand() {
  const id = arg('id', positional());
  const { scenario } = scenarioById(id);
  if (boolArg('run', false)) {
    const result = runSimulatorForScenario(scenario, {
      scenarioFile: scenarioStorePath,
      quiet: true,
      timeoutMs: Number(arg('timeout-ms', 180_000)),
    });
    if (result.status !== 0) {
      if (result.error) console.error(result.error.message);
      console.error(result.stderr || result.stdout);
      process.exit(result.status || 1);
    }
  }
  const reportPath = String(arg('report', resolve(scenarioReportRoot, id, 'latest-report.json')));
  const loaded = loadReport(reportPath);
  const oracle = evaluateReport({ report: loaded.report, sourceReportPath: loaded.path, scenario, scenarioId: id });
  if (boolArg('next-only', false)) return print(oracle.smallestNextExperiment || {});
  print(oracle);
}

function packCommand() {
  const packId = arg('pack', arg('id', positional()));
  const store = loadScenarioStore();
  const pack = (store.packs || []).find((item) => item.id === packId);
  if (!pack) throw new Error(`Unknown pack id: ${packId}`);
  const maxScenarios = Number(arg('max-scenarios', pack.scenarioIds.length || 999));
  const oracles = [];
  const failures = [];
  for (const scenarioId of (pack.scenarioIds || []).slice(0, maxScenarios)) {
    const scenario = findScenario(store, scenarioId);
    if (!scenario) continue;
    try {
      if (boolArg('run', false)) {
        const result = runSimulatorForScenario(scenario, {
          scenarioFile: scenarioStorePath,
          quiet: true,
          timeoutMs: Number(arg('timeout-ms', 180_000)),
        });
        if (result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout || `scenario ${scenarioId} failed`);
      }
      const reportPath = resolve(scenarioReportRoot, scenarioId, 'latest-report.json');
      const loaded = loadReport(reportPath);
      oracles.push(evaluateReport({ report: loaded.report, sourceReportPath: loaded.path, scenario, scenarioId }));
    } catch (error) {
      failures.push({ scenarioId, error: error.message || String(error) });
      if (!boolArg('continue', false)) break;
    }
  }
  const summary = summarizeOraclePack(oracles, packId);
  summary.failures = failures;
  writeJson(resolve(oracleReportRoot, `pack-${packId}-latest.json`), summary);
  print(summary);
}

function projectCommand() {
  const store = loadScenarioStore();
  const coreIds = new Set();
  for (const scenario of store.scenarios || []) {
    if ((scenario.importance || 'supporting') === 'core') coreIds.add(scenario.id);
  }
  if (coreIds.size === 0) {
    for (const pack of store.packs || []) {
      for (const id of pack.scenarioIds || []) coreIds.add(id);
    }
  }
  const oracles = [];
  const failures = [];
  for (const scenarioId of [...coreIds].slice(0, Number(arg('max-scenarios', 8)))) {
    const scenario = findScenario(store, scenarioId);
    if (!scenario) continue;
    const existing = readLatestOracle(scenarioId);
    if (existing && !boolArg('refresh', false)) {
      oracles.push(existing);
      continue;
    }
    try {
      const loaded = loadReport(resolve(scenarioReportRoot, scenarioId, 'latest-report.json'));
      oracles.push(evaluateReport({ report: loaded.report, sourceReportPath: loaded.path, scenario, scenarioId }));
    } catch (error) {
      failures.push({ scenarioId, error: error.message || String(error) });
    }
  }
  const summary = summarizeOraclePack(oracles, 'project');
  summary.failures = failures;
  writeJson(resolve(oracleReportRoot, 'project-latest.json'), summary);
  mkdirSync(oracleReportRoot, { recursive: true });
  writeFileSync(resolve(oracleReportRoot, 'project-latest.md'), markdownForPack(summary));
  print(summary);
}

function markdownForPack(summary) {
  const rows = (summary.scenarios || []).map((scenario) => `| ${scenario.scenarioId} | ${scenario.verdict} | ${scenario.weightedScore} | ${scenario.weakestScore?.metric || ''} | ${scenario.smallestNextExperiment || ''} |`).join('\n');
  return `# Gameplay Oracle Project Report

Generated: ${summary.generatedAt}

Verdict: ${summary.packVerdict}

Average weighted score: ${summary.averageWeightedScore}

Common failure pattern: ${summary.commonFailurePattern || 'none'}

## Scenarios

| Scenario | Verdict | Score | Weakest | Next |
| --- | --- | ---: | --- | --- |
${rows}
`;
}

function runCommand() {
  const simulatorArgs = [resolve(root, 'scripts', 'gameplay-simulator.mjs'), ...rest.filter((value) => !['--json', '--markdown', '--gate', '--write-tasks'].includes(value))];
  const result = spawnSync(process.execPath, simulatorArgs, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: Number(arg('timeout-ms', 180_000)),
  });
  if (result.status !== 0) {
    if (result.error) console.error(result.error.message);
    console.error(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  latestCommand();
}

function doctorCommand() {
  const report = doctorReport();
  print(report);
  if (boolArg('gate', false) && (report.missingScenarioReports.length > 0 || report.unsupportedAssumptionCount > 0)) process.exit(1);
}

function ciCommand() {
  const existing = existsSync(latestSimulatorReportPath);
  if (!existing) return doctorCommand();
  const loaded = loadReport(latestSimulatorReportPath);
  const oracle = evaluateReport({ report: loaded.report, sourceReportPath: loaded.path, scenario: loaded.report.scenarioDefinition || null, write: true });
  print(oracle);
  if (oracle.gate && !oracle.gate.passed) process.exit(1);
}

try {
  if (command === 'latest') latestCommand();
  else if (command === 'scenario') scenarioCommand();
  else if (command === 'pack') packCommand();
  else if (command === 'project') projectCommand();
  else if (command === 'run') runCommand();
  else if (command === 'doctor') doctorCommand();
  else if (command === 'ci') ciCommand();
  else throw new Error(`Unknown oracle command: ${command}`);
} catch (error) {
  console.error(`[oracle] ${error.message || String(error)}`);
  process.exit(1);
}
