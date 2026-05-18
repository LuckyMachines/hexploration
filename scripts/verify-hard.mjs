#!/usr/bin/env node
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import {
  compactPublicReport,
  DEFAULT_TIMEOUTS,
  formatDuration,
  gradeHardness,
  hintForFailure,
  markdownForReport,
  parseArgs,
  resolveExecutable,
  scoreReport,
  selectFocusedCommands,
  tailText,
} from './verify-hard-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const appDir = resolve(root, 'app');
const reportDir = resolve(root, 'reports', 'verification');
const publicReportDir = resolve(root, 'app', 'public', 'verification');
const latestJsonPath = resolve(reportDir, 'latest-hard.json');
const latestMarkdownPath = resolve(reportDir, 'latest-hard.md');
const publicLatestJsonPath = resolve(publicReportDir, 'latest-hard.json');
const foundryBinDir = process.env.FOUNDRY_BIN
  || resolve(process.env.USERPROFILE || process.env.HOME || '', '.foundry', 'bin');
const foundryExeSuffix = process.platform === 'win32' ? '.exe' : '';

const args = parseArgs(process.argv.slice(2));
const localStack = { process: null, stdout: '', stderr: '' };

function npmScript(script, extra = []) {
  return { command: resolveExecutable('npm'), args: ['run', script, ...extra] };
}

function npxCommand(commandArgs) {
  return { command: resolveExecutable('npx'), args: commandArgs };
}

function nodeTest(files) {
  return { command: 'node', args: ['--test', ...files] };
}

function foundryBinary(name) {
  return resolve(foundryBinDir, `${name}${foundryExeSuffix}`);
}

function rootTestFiles() {
  return readdirSync(resolve(root, 'scripts'))
    .filter((name) => name.endsWith('.test.mjs'))
    .map((name) => `scripts/${name}`);
}

function commandRegistry() {
  return {
    'smoke.git-status': {
      id: 'smoke.git-status',
      label: 'Record git status',
      command: 'git',
      args: ['status', '--short'],
      timeoutMs: DEFAULT_TIMEOUTS.quick,
      required: true,
    },
    'smoke.local-doctor-tests': {
      id: 'smoke.local-doctor-tests',
      label: 'Local stack doctor unit tests',
      ...npmScript('local:doctor:test'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'smoke.scenario-tests': {
      id: 'smoke.scenario-tests',
      label: 'Scenario utility tests',
      ...npmScript('scenario:test'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'smoke.ui-density': {
      id: 'smoke.ui-density',
      label: 'UI density report',
      ...npmScript('ui:density'),
      timeoutMs: DEFAULT_TIMEOUTS.quick,
      required: true,
      artifacts: ['reports/ui-density/latest.json'],
    },
    'smoke.app-focused-tests': {
      id: 'smoke.app-focused-tests',
      label: 'Focused app UI tests',
      cwd: appDir,
      ...npxCommand(['vitest', 'run', 'src/lib/interfaceDensity.test.js', 'src/components/actions/ActionPanel.test.jsx', 'src/components/board/HexGrid.test.jsx', '--pool=threads']),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'focused.app-build': {
      id: 'focused.app-build',
      label: 'App production build',
      cwd: appDir,
      ...npmScript('build'),
      timeoutMs: DEFAULT_TIMEOUTS.heavy,
      required: true,
    },
    'focused.app-page-tests': {
      id: 'focused.app-page-tests',
      label: 'Focused app page tests',
      cwd: appDir,
      ...npxCommand(['vitest', 'run', 'src/pages/GamePage.test.jsx', '--pool=threads']),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'focused.oracle-tests': {
      id: 'focused.oracle-tests',
      label: 'Gameplay Oracle unit tests',
      ...npmScript('oracle:test'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'focused.setup-tests': {
      id: 'focused.setup-tests',
      label: 'Setup Forge unit tests',
      ...npmScript('setup:test'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'focused.memory-tests': {
      id: 'focused.memory-tests',
      label: 'Design memory unit tests',
      ...npmScript('memory:test'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'focused.feel-tests': {
      id: 'focused.feel-tests',
      label: 'Player feeling unit tests',
      ...npmScript('feel:test'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'focused.growth-tests': {
      id: 'focused.growth-tests',
      label: 'Growth unit tests',
      ...npmScript('growth:test'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'focused.fun-tests': {
      id: 'focused.fun-tests',
      label: 'Fun unit tests',
      ...npmScript('fun:test'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'hard.forge-build': {
      id: 'hard.forge-build',
      label: 'Forge build',
      command: foundryBinary('forge'),
      args: ['build'],
      timeoutMs: DEFAULT_TIMEOUTS.heavy,
      required: true,
      group: 'forge',
    },
    'hard.forge-test': {
      id: 'hard.forge-test',
      label: 'Forge tests',
      command: foundryBinary('forge'),
      args: ['test'],
      timeoutMs: DEFAULT_TIMEOUTS.heavy,
      required: true,
      group: 'forge',
    },
    'hard.root-node-tests': {
      id: 'hard.root-node-tests',
      label: 'All root Node utility tests',
      ...nodeTest(rootTestFiles()),
      timeoutMs: DEFAULT_TIMEOUTS.heavy,
      required: true,
    },
    'hard.app-test': {
      id: 'hard.app-test',
      label: 'Full app Vitest suite',
      cwd: appDir,
      ...npmScript('test'),
      timeoutMs: DEFAULT_TIMEOUTS.heavy,
      required: true,
      group: 'app',
    },
    'hard.sim-golden': {
      id: 'hard.sim-golden',
      label: 'Simulator golden run',
      ...npmScript('sim:golden'),
      timeoutMs: DEFAULT_TIMEOUTS.heavy,
      required: true,
      group: 'sim',
    },
    'hard.oracle-ci': {
      id: 'hard.oracle-ci',
      label: 'Gameplay Oracle CI gate',
      ...npmScript('oracle:ci'),
      timeoutMs: DEFAULT_TIMEOUTS.heavy,
      required: true,
    },
    'hard.setup-doctor': {
      id: 'hard.setup-doctor',
      label: 'Setup Forge doctor',
      ...npmScript('setup:doctor'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'hard.memory-doctor': {
      id: 'hard.memory-doctor',
      label: 'Design memory doctor',
      ...npmScript('memory:doctor'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'hard.lab-doctor': {
      id: 'hard.lab-doctor',
      label: 'Lab notebook doctor',
      ...npmScript('lab:doctor'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'hard.feel-doctor': {
      id: 'hard.feel-doctor',
      label: 'Feeling black-box doctor',
      ...npmScript('feel:doctor'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'hard.bridge-doctor': {
      id: 'hard.bridge-doctor',
      label: 'Evidence bridge doctor',
      ...npmScript('bridge:doctor'),
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
    },
    'exact.local-stack-start': {
      id: 'exact.local-stack-start',
      label: 'Start exact local stack',
      kind: 'local-stack',
      timeoutMs: DEFAULT_TIMEOUTS.exact,
      required: true,
      group: 'exact',
      artifacts: ['reports/local-stack/latest-health.json'],
    },
    'exact.local-doctor-gate': {
      id: 'exact.local-doctor-gate',
      label: 'Gate exact local stack health',
      command: 'node',
      args: ['scripts/local-stack-doctor.mjs', '--gate', '--markdown'],
      timeoutMs: DEFAULT_TIMEOUTS.medium,
      required: true,
      group: 'exact',
    },
    'release.e2e': {
      id: 'release.e2e',
      label: 'Playwright e2e suite',
      cwd: appDir,
      ...npmScript('test:e2e'),
      timeoutMs: DEFAULT_TIMEOUTS.release,
      required: true,
      group: 'e2e',
    },
    'release.ui-density-strict': {
      id: 'release.ui-density-strict',
      label: 'Strict UI density gate',
      command: 'node',
      args: ['scripts/game-ui-density-report.mjs', '--strict'],
      timeoutMs: DEFAULT_TIMEOUTS.quick,
      required: true,
    },
    'release.clean-repo': {
      id: 'release.clean-repo',
      label: 'Release clean repo check',
      command: 'git',
      args: ['status', '--short'],
      timeoutMs: DEFAULT_TIMEOUTS.quick,
      required: true,
      cleanRepoGate: true,
    },
  };
}

const BASE_SEQUENCES = {
  smoke: ['smoke.git-status', 'smoke.local-doctor-tests', 'smoke.scenario-tests', 'smoke.ui-density', 'smoke.app-focused-tests'],
  focused: ['smoke.git-status', 'smoke.local-doctor-tests', 'smoke.scenario-tests', 'smoke.ui-density', 'smoke.app-focused-tests', 'focused.app-build'],
  hard: ['smoke.git-status', 'hard.forge-build', 'hard.forge-test', 'hard.root-node-tests', 'focused.app-build', 'hard.app-test', 'smoke.ui-density', 'hard.sim-golden', 'hard.oracle-ci', 'hard.setup-doctor', 'hard.memory-doctor', 'hard.lab-doctor', 'hard.feel-doctor', 'hard.bridge-doctor'],
  exact: ['smoke.git-status', 'hard.forge-build', 'hard.forge-test', 'hard.root-node-tests', 'focused.app-build', 'hard.app-test', 'smoke.ui-density', 'hard.sim-golden', 'hard.oracle-ci', 'hard.setup-doctor', 'hard.memory-doctor', 'hard.lab-doctor', 'hard.feel-doctor', 'hard.bridge-doctor', 'exact.local-stack-start', 'exact.local-doctor-gate'],
  release: ['release.clean-repo', 'hard.forge-build', 'hard.forge-test', 'hard.root-node-tests', 'focused.app-build', 'hard.app-test', 'smoke.ui-density', 'hard.sim-golden', 'hard.oracle-ci', 'hard.setup-doctor', 'hard.memory-doctor', 'hard.lab-doctor', 'hard.feel-doctor', 'hard.bridge-doctor', 'exact.local-stack-start', 'exact.local-doctor-gate', 'release.e2e', 'release.ui-density-strict', 'release.clean-repo'],
};

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, 'utf8');
}

async function runCommandStep(step) {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  let stdout = '';
  let stderr = '';

  return new Promise((resolve) => {
    let settled = false;
    const useShell = String(step.command).toLowerCase().endsWith('.cmd');
    const child = spawn(step.command, step.args || [], {
      cwd: step.cwd || root,
      env: { ...process.env },
      shell: useShell,
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      if (settled) return;
      try {
        if (process.platform === 'win32' && child.pid) spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F']);
        else child.kill('SIGTERM');
      } catch {}
      settled = true;
      resolve({
        ...step,
        status: 'timed-out',
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        stdoutTail: tailText(stdout),
        stderrTail: tailText(stderr),
        hint: 'The command timed out. Run it directly or increase the timeout for this tier.',
      });
    }, step.timeoutMs || DEFAULT_TIMEOUTS.medium);

    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      const failed = {
        ...step,
        status: 'fail',
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        stdoutTail: tailText(stdout),
        stderrTail: tailText(`${stderr}\n${error.message}`),
      };
      failed.hint = hintForFailure(failed);
      resolve(failed);
    });
    child.on('exit', (code) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      const cleanRepoFailed = step.cleanRepoGate && stdout.trim().length > 0;
      const failed = code !== 0 || cleanRepoFailed;
      const result = {
        ...step,
        status: failed ? 'fail' : 'pass',
        exitCode: code,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        stdoutTail: tailText(stdout),
        stderrTail: tailText(stderr),
      };
      if (failed) result.hint = cleanRepoFailed ? 'Release mode requires a clean working tree.' : hintForFailure(result);
      resolve(result);
    });
  });
}

async function waitForPortFree(port, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const free = await new Promise((resolvePort) => {
      const server = net.createServer();
      server.once('error', () => resolvePort(false));
      server.once('listening', () => server.close(() => resolvePort(true)));
      server.listen(port, '127.0.0.1');
    });
    if (free) return true;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  return false;
}

async function runLocalStackStep(step) {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  localStack.stdout = '';
  localStack.stderr = '';

  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(resolveExecutable('npm'), ['run', 'local:sim'], {
      cwd: root,
      env: {
        ...process.env,
        LOCAL_STACK_DEPLOY_TIMEOUT_MS: process.env.LOCAL_STACK_DEPLOY_TIMEOUT_MS || '120000',
        LOCAL_STACK_COMMAND_TIMEOUT_MS: process.env.LOCAL_STACK_COMMAND_TIMEOUT_MS || '120000',
        LOCAL_STACK_READINESS_TIMEOUT_MS: process.env.LOCAL_STACK_READINESS_TIMEOUT_MS || '20000',
      },
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    localStack.process = child;

    const finish = (status, hint = '') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ...step,
        status,
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - start,
        stdoutTail: tailText(localStack.stdout),
        stderrTail: tailText(localStack.stderr),
        hint,
      });
    };

    const timer = setTimeout(() => {
      cleanupLocalStack();
      finish('timed-out', 'Local stack did not print local-stack-ready before the timeout.');
    }, step.timeoutMs || DEFAULT_TIMEOUTS.exact);

    child.stdout?.on('data', (chunk) => {
      localStack.stdout += chunk.toString();
      if (localStack.stdout.includes('local-stack-ready')) finish('pass');
    });
    child.stderr?.on('data', (chunk) => { localStack.stderr += chunk.toString(); });
    child.on('error', (error) => {
      localStack.stderr += `\n${error.message}`;
      finish('fail', 'Local stack failed to start.');
    });
    child.on('exit', (code) => {
      if (!settled) finish(code === 0 ? 'pass' : 'fail', 'Local stack exited before readiness.');
    });
  });
}

function cleanupLocalStack() {
  const child = localStack.process;
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32' && child.pid) spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F']);
    else child.kill('SIGTERM');
  } catch {}
}

async function runStep(step) {
  console.log(`[verify] ${step.id}: ${step.label}`);
  if (args.skips.has(step.group || '') || args.skips.has(step.id)) {
    return { ...step, status: 'skipped', durationMs: 0, hint: `Skipped by --skip-${step.group || step.id}` };
  }
  if (step.kind === 'local-stack') return runLocalStackStep(step);
  return runCommandStep(step);
}

async function commandOutput(command, commandArgs, fallback = '') {
  const result = await runCommandStep({
    id: `meta.${command}`,
    label: `Metadata ${command}`,
    command,
    args: commandArgs,
    timeoutMs: DEFAULT_TIMEOUTS.quick,
  });
  return result.status === 'pass' ? result.stdoutTail.trim() : fallback;
}

async function repoMetadata() {
  return {
    branch: await commandOutput('git', ['branch', '--show-current'], 'unknown'),
    commit: await commandOutput('git', ['rev-parse', '--short', 'HEAD'], 'unknown'),
    status: await commandOutput('git', ['status', '--short'], ''),
  };
}

async function toolMetadata() {
  const tools = {};
  for (const item of [
    ['node', ['--version']],
    [resolveExecutable('npm'), ['--version']],
    ['git', ['--version']],
    [foundryBinary('forge'), ['--version']],
    [foundryBinary('anvil'), ['--version']],
  ]) {
    const key = item[0].includes('forge') ? 'forge' : item[0].includes('anvil') ? 'anvil' : item[0].replace(/\.cmd$/, '');
    tools[key] = await commandOutput(item[0], item[1], 'missing');
  }
  tools.playwright = await commandOutput(resolveExecutable('npx'), ['playwright', '--version'], 'missing');
  return tools;
}

function writeReport(report) {
  writeJson(latestJsonPath, report);
  writeText(latestMarkdownPath, markdownForReport(report));
  writeJson(publicLatestJsonPath, compactPublicReport(report));
}

function readLatestReport() {
  if (!existsSync(latestJsonPath)) {
    console.log('No verification report found.');
    return 1;
  }
  const report = JSON.parse(readFileSync(latestJsonPath, 'utf8'));
  console.log(markdownForReport(report));
  return report.score?.ok ? 0 : 1;
}

function cleanArtifacts() {
  rmSync(reportDir, { recursive: true, force: true });
  rmSync(publicReportDir, { recursive: true, force: true });
  console.log('Removed verification report artifacts.');
}

async function doctor() {
  const tools = await toolMetadata();
  const steps = Object.entries(tools).map(([name, value]) => ({
    id: `doctor.${name}`,
    label: `${name} availability`,
    status: value === 'missing' ? 'fail' : 'pass',
    durationMs: 0,
    stdoutTail: value,
    hint: value === 'missing' ? `Install or expose ${name} on PATH.` : '',
  }));
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tier: 'doctor',
    repo: await repoMetadata(),
    tools,
    steps,
  };
  report.score = scoreReport(steps);
  report.hardnessGrade = gradeHardness(report);
  writeReport(report);
  console.log(markdownForReport(report));
  return report.score.ok ? 0 : 1;
}

async function changedFiles() {
  const output = await commandOutput('git', ['status', '--short'], '');
  return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

async function sequenceForTier(tier, registry) {
  const ids = [...BASE_SEQUENCES[tier]];
  if (tier === 'focused') {
    for (const selected of selectFocusedCommands(await changedFiles())) {
      if (!ids.includes(selected.id)) ids.push(selected.id);
    }
  }
  return ids.map((id) => registry[id]).filter(Boolean);
}

async function main() {
  if (args.cleanArtifacts) {
    cleanArtifacts();
    return 0;
  }
  if (args.latest) return readLatestReport();
  if (args.doctor) return doctor();

  const started = Date.now();
  const registry = commandRegistry();
  const steps = [];
  const tools = await toolMetadata();
  const repo = await repoMetadata();
  const sequence = await sequenceForTier(args.tier, registry);

  try {
    for (const step of sequence) {
      const result = await runStep(step);
      steps.push(result);
      console.log(`[verify] ${result.status.toUpperCase()} ${result.id} ${formatDuration(result.durationMs || 0)}`);
      if (['fail', 'timed-out'].includes(result.status) && !args.continueOnFail) break;
    }
  } finally {
    cleanupLocalStack();
    if (localStack.process) {
      const free = await waitForPortFree(Number(process.env.ANVIL_PORT) || 9955);
      steps.push({
        id: 'exact.local-stack-cleanup',
        label: 'Verify local stack cleanup',
        status: free ? 'pass' : 'fail',
        durationMs: 0,
        hint: free ? '' : 'Anvil port is still in use after cleanup.',
      });
    }
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    tier: args.tier,
    options: {
      continueOnFail: args.continueOnFail,
      jobs: args.jobs,
      skips: [...args.skips],
    },
    repo,
    tools,
    durationMs: Date.now() - started,
    steps,
  };
  report.score = scoreReport(steps);
  report.hardnessGrade = gradeHardness(report);
  writeReport(report);

  const markdown = markdownForReport(report);
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else console.log(markdown);
  return report.score.ok ? 0 : 1;
}

process.on('SIGINT', () => {
  cleanupLocalStack();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanupLocalStack();
  process.exit(143);
});

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    cleanupLocalStack();
    console.error('[verify] Fatal error:', error);
    process.exit(1);
  });
