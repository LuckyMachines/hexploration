#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { buildGameplayImprovementReport, productionScenarios } from './gameplay-improvement-utils.mjs';
import { readJson } from './scenario-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const command = ['refresh', 'report', 'doctor', 'plan'].includes(argv[0]) ? argv[0] : 'report';
const args = ['refresh', 'report', 'doctor', 'plan'].includes(argv[0]) ? argv.slice(1) : argv;
const boolArg = (name) => args.includes(`--${name}`) || args.includes(`--${name}=true`);
const valueArg = (name, fallback = null) => {
  const match = args.find((value) => value.startsWith(`--${name}=`));
  return match ? match.slice(match.indexOf('=') + 1) : fallback;
};
const reportPath = resolve(root, 'reports', 'gameplay-improvement', 'latest-report.json');
const publicReportPath = resolve(root, 'app', 'public', 'gameplay', 'latest-report.json');

function run(label, scriptArgs) {
  const result = spawnSync(process.execPath, scriptArgs, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 30,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const step = { label, command: [process.execPath, ...scriptArgs].join(' '), passed: result.status === 0, status: result.status, output: (result.stdout || '').trim().slice(-1200), error: (result.stderr || '').trim().slice(-1200) };
  console.log(`[gameplay:refresh] ${step.passed ? 'PASS' : 'FAIL'} ${label}`);
  if (!step.passed && !boolArg('continue-on-fail')) throw new Error(`${label} failed: ${step.error || step.output}`);
  return step;
}

function writeReport(report) {
  mkdirSync(dirname(reportPath), { recursive: true });
  mkdirSync(dirname(publicReportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(publicReportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function refresh() {
  const store = readJson(resolve(root, 'simulator.scenarios.json'), { scenarios: [] });
  const requestedScenario = valueArg('scenario', null);
  const scenarios = productionScenarios(store).filter((scenario) => !requestedScenario || scenario.id === requestedScenario);
  if (requestedScenario && scenarios.length === 0) throw new Error(`Unknown production scenario: ${requestedScenario}`);
  const steps = [];
  steps.push(run('validate scenarios', [resolve(root, 'scripts', 'scenario-designer.mjs'), 'validate']));
  for (const scenario of scenarios) {
    steps.push(run(`validate setup ${scenario.id}`, [resolve(root, 'scripts', 'scenario-setup-forge.mjs'), 'validate', `--id=${scenario.id}`, '--gate']));
  }
  if (boolArg('with-engine')) {
    const exactArgs = [resolve(root, 'scripts', 'gameplay-exact-runner.mjs'), `--batch=${valueArg('batch', '10')}`, '--resume'];
    if (requestedScenario) exactArgs.push(`--scenario=${requestedScenario}`);
    if (valueArg('port', null)) exactArgs.push(`--port=${valueArg('port')}`);
    if (boolArg('continue-on-fail')) exactArgs.push('--continue-on-fail');
    if (boolArg('no-resume')) {
      exactArgs.splice(exactArgs.indexOf('--resume'), 1, '--no-resume');
    }
    steps.push(run('refresh exact same-engine matrix', exactArgs));
  }
  steps.push(run('project Oracle', [resolve(root, 'scripts', 'gameplay-oracle.mjs'), 'project', '--refresh']));
  const evidenceScenarios = scenarios.filter((scenario) => existsSync(resolve(root, 'reports', 'simulator', 'scenarios', scenario.id, 'latest-report.json')));
  for (const scenario of evidenceScenarios) {
    steps.push(run(`refresh feeling ${scenario.id}`, [resolve(root, 'scripts', 'player-feeling-black-box.mjs'), 'scenario', `--id=${scenario.id}`]));
  }
  steps.push(run('index feelings', [resolve(root, 'scripts', 'player-feeling-black-box.mjs'), 'index']));
  steps.push(run('rebuild memory', [resolve(root, 'scripts', 'playable-design-memory.mjs'), 'build']));
  steps.push(run('rebuild time machine', [resolve(root, 'scripts', 'scenario-time-machine.mjs'), 'build']));
  for (const scenario of evidenceScenarios) {
    steps.push(run(`refresh lab ${scenario.id}`, [resolve(root, 'scripts', 'scenario-lab-notebook.mjs'), 'entry', `--id=${scenario.id}`]));
  }
  steps.push(run('refresh lab brief', [resolve(root, 'scripts', 'scenario-lab-notebook.mjs'), 'daily']));
  steps.push(run('rebuild tutor', [resolve(root, 'scripts', 'scenario-self-driving-tutor.mjs'), 'build']));
  steps.push(run('rebuild bridge', [resolve(root, 'scripts', 'scenario-evidence-bridge.mjs'), 'build']));
  steps.push(run('rebuild fun report', [resolve(root, 'scripts', 'fun-report.mjs')]));
  const report = buildGameplayImprovementReport();
  report.refresh = { withEngine: boolArg('with-engine'), steps, passed: steps.every((step) => step.passed) };
  writeReport(report);
  console.log(JSON.stringify({ reportPath, grade: report.grade, blockers: report.blockers, steps: steps.length }, null, 2));
}

if (command === 'refresh') refresh();
else {
  const report = buildGameplayImprovementReport();
  if (command !== 'plan') writeReport(report);
  console.log(JSON.stringify(command === 'plan' ? {
    grade: report.grade,
    grades: report.grades,
    qualityPassed: report.qualityPassed,
    coverage: report.coverage,
    nextActions: report.nextActions,
    stages: report.pipeline.map(({ id, inputs, output, fresh }) => ({ id, inputs, output, fresh })),
  } : report, null, 2));
  if (command === 'doctor' && !['A', 'A-'].includes(report.grade) && boolArg('strict')) process.exitCode = 1;
}
