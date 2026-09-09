#!/usr/bin/env node
import { spawn, spawnSync } from 'child_process';
import { createServer } from 'net';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { buildExactRunPlan, candidatePorts, classifyExactRunFailure } from './gameplay-exact-runner-utils.mjs';
import { readJson } from './scenario-utils.mjs';
import { fingerprint } from './gameplay-improvement-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valueArg = (name, fallback = null) => {
  const found = args.find((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!found) return fallback;
  const eq = found.indexOf('=');
  return eq >= 0 ? found.slice(eq + 1) : true;
};
const boolArg = (name, fallback = false) => {
  const value = valueArg(name, fallback);
  return typeof value === 'boolean' ? value : !['false', '0', 'no'].includes(String(value).toLowerCase());
};

const batch = Math.max(1, Number(valueArg('batch', 10)));
const scenarioId = valueArg('scenario', null);
const suppliedRpc = valueArg('rpc', null);
const resume = args.includes('--no-resume') ? false : boolArg('resume', true);
const continueOnFail = boolArg('continue-on-fail', false);
const includeRegressions = boolArg('include-regressions', false);
const regressionsOnly = boolArg('regressions-only', false);
const timeoutMs = Math.max(60_000, Number(valueArg('timeout-ms', 3_600_000)));
const outputDir = resolve(root, 'reports', 'gameplay-improvement', 'exact-runner');
const checkpointPath = resolve(outputDir, regressionsOnly ? 'regression-checkpoint.json' : 'checkpoint.json');
const latestPath = resolve(outputDir, regressionsOnly ? 'latest-regression-report.json' : 'latest-report.json');
const logPath = resolve(outputDir, regressionsOnly ? 'latest-regression-stack.log' : 'latest-stack.log');

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function portAvailable(port) {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.once('error', () => resolvePort(false));
    server.once('listening', () => server.close(() => resolvePort(true)));
    server.listen(port, '127.0.0.1');
  });
}

async function choosePort() {
  for (const port of candidatePorts(valueArg('port', null))) {
    if (await portAvailable(port)) return port;
  }
  throw new Error('No available local RPC port found in the candidate range.');
}

function stopProcessTree(child) {
  if (!child?.pid || child.killed) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else child.kill('SIGTERM');
  } catch {}
}

function startStack(port) {
  const child = spawn(process.execPath, [resolve(root, 'scripts', 'run-local-stack.mjs'), '--solo', '--no-vite', '--no-worker', '--no-bots'], {
    cwd: root,
    env: {
      ...process.env,
      ANVIL_PORT: String(port),
      LOCAL_STACK_DEPLOY_TIMEOUT_MS: process.env.LOCAL_STACK_DEPLOY_TIMEOUT_MS || '180000',
      LOCAL_STACK_COMMAND_TIMEOUT_MS: process.env.LOCAL_STACK_COMMAND_TIMEOUT_MS || '120000',
      LOCAL_STACK_READINESS_TIMEOUT_MS: process.env.LOCAL_STACK_READINESS_TIMEOUT_MS || '30000',
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const append = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-2_000_000);
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(logPath, output);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  return { child, getOutput: () => output };
}

function waitForReady(stack) {
  return new Promise((resolveReady, rejectReady) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (stack.getOutput().includes('local-stack-ready')) {
        clearInterval(timer);
        resolveReady();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        rejectReady(new Error(`Local stack did not become ready within ${timeoutMs}ms.`));
      }
    }, 250);
    stack.child.once('exit', (code) => {
      clearInterval(timer);
      rejectReady(new Error(`Local stack exited before readiness with code ${code}.`));
    });
    stack.child.once('error', (error) => {
      clearInterval(timer);
      rejectReady(error);
    });
  });
}

function runScenario(item, rpcUrl) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const result = spawnSync(process.execPath, [
    resolve(root, 'scripts', 'scenario-designer.mjs'),
    'run',
    `--id=${item.scenario.id}`,
    `--batch=${batch}`,
    `--rpc=${rpcUrl}`,
    `--timeout-ms=${timeoutMs}`,
    '--quiet',
  ], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 30,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
  });
  const classification = result.status === 0 ? null : classifyExactRunFailure(result);
  return {
    scenarioId: item.scenario.id,
    signature: item.signature,
    status: result.status === 0 ? 'passed' : 'failed',
    exitCode: result.status,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    failureCategory: classification?.category || null,
    retryable: classification?.retryable || false,
    stdoutTail: String(result.stdout || '').slice(-2000),
    stderrTail: String(result.stderr || result.error?.message || '').slice(-2000),
  };
}

async function main() {
  mkdirSync(outputDir, { recursive: true });
  const store = readJson(resolve(root, 'simulator.scenarios.json'), { scenarios: [] });
  const sourceHashes = Object.fromEntries([
    'scripts/gameplay-simulator.mjs',
    'scripts/scenario-utils.mjs',
    'simulator.scenarios.json',
    'simulator.agent-policies.json',
    'simulator.evaluation.json',
    'foundry.toml',
    'contracts/XenovoyaGameplayUpdates.sol',
    'contracts/XenovoyaController.sol',
  ].map((path) => [path, fingerprint(path)]));
  const checkpoint = resume ? readJson(checkpointPath, { scenarios: {} }) : { scenarios: {} };
  const plan = buildExactRunPlan(store, { scenarioId, batch, sourceHashes, checkpoint, includeRegressions, regressionsOnly });
  if (plan.length === 0) throw new Error(scenarioId ? `Unknown production scenario: ${scenarioId}` : 'No production scenarios configured.');

  let stack = null;
  let rpcUrl = suppliedRpc;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    batch,
    resume,
    includeRegressions,
    regressionsOnly,
    sourceHashes,
    rpc: { managed: !suppliedRpc, url: null, port: null },
    scenarios: [],
  };

  const cleanup = () => stopProcessTree(stack?.child);
  process.once('SIGINT', () => { cleanup(); process.exit(130); });
  process.once('SIGTERM', () => { cleanup(); process.exit(143); });

  try {
    if (!rpcUrl) {
      const port = await choosePort();
      rpcUrl = `http://127.0.0.1:${port}`;
      report.rpc.url = rpcUrl;
      report.rpc.port = port;
      console.log(`[gameplay:exact] Starting hidden local stack on RPC port ${port}.`);
      stack = startStack(port);
      await waitForReady(stack);
    } else {
      report.rpc.url = rpcUrl;
      report.rpc.port = Number(new URL(rpcUrl).port || 80);
    }

    for (const item of plan) {
      if (item.cached) {
        const cached = { ...checkpoint.scenarios[item.scenario.id], cached: true };
        report.scenarios.push(cached);
        console.log(`[gameplay:exact] CACHED ${item.scenario.id}`);
        continue;
      }
      console.log(`[gameplay:exact] RUN ${item.scenario.id} (${batch} replicates per strategy)`);
      const result = runScenario(item, rpcUrl);
      report.scenarios.push(result);
      checkpoint.scenarios = { ...checkpoint.scenarios, [item.scenario.id]: result };
      checkpoint.sourceHashes = sourceHashes;
      checkpoint.updatedAt = new Date().toISOString();
      writeJson(checkpointPath, checkpoint);
      console.log(`[gameplay:exact] ${result.status === 'passed' ? 'PASS' : 'FAIL'} ${item.scenario.id}`);
      if (result.status !== 'passed' && !continueOnFail) break;
    }
  } finally {
    cleanup();
  }

  report.finishedAt = new Date().toISOString();
  report.passed = report.scenarios.length === plan.length && report.scenarios.every((item) => item.status === 'passed');
  report.summary = {
    planned: plan.length,
    passed: report.scenarios.filter((item) => item.status === 'passed').length,
    failed: report.scenarios.filter((item) => item.status === 'failed').length,
    cached: report.scenarios.filter((item) => item.cached).length,
  };
  writeJson(latestPath, report);
  console.log(JSON.stringify({ reportPath: latestPath, ...report.summary, rpcPort: report.rpc.port }, null, 2));
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => {
  const previous = existsSync(latestPath) ? readFileSync(latestPath, 'utf8') : null;
  writeJson(latestPath, { schemaVersion: 1, generatedAt: new Date().toISOString(), passed: false, error: error.message, previousReportPreserved: Boolean(previous) });
  console.error(`[gameplay:exact] ${error.stack || error.message}`);
  process.exitCode = 1;
});
