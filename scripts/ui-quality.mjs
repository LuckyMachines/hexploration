#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { uiQualityScenes } from '../app/src/design-system/uiQualityMatrix.js';
import { buildUiQualityReport, markdownForUiQuality, sha256File, sourceHash } from './ui-quality-utils.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const appRoot = resolve(root, 'app');
const approvalsPath = resolve(root, 'ui-quality', 'visual-approvals.json');
const metricsPath = resolve(root, 'artifacts', 'ui-quality', 'metrics', 'latest.json');
const captureRoot = resolve(root, 'artifacts', 'ui-quality', 'captures');
const comparisonRoot = resolve(root, 'artifacts', 'ui-quality', 'comparisons');
const reportPath = resolve(root, 'reports', 'ui-quality', 'latest.json');
const reportMarkdownPath = resolve(root, 'reports', 'ui-quality', 'latest.md');
const publicPath = resolve(appRoot, 'public', 'ui-quality', 'latest.json');
const qualityRunId = `${Date.now()}-${process.pid}`;

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function valueFlag(args, name, fallback = '') {
  const prefix = `--${name}=`;
  const direct = args.find((value) => value.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback;
}

function baselinePath(scene) {
  return resolve(appRoot, 'e2e', '__screenshots__', 'ui-quality', `${scene.id}.png`);
}

function actualPath(scene) {
  return resolve(captureRoot, `${scene.id}.png`);
}

function run(command, args, { cwd = root, quiet = false } = {}) {
  const invocation = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command)
    ? { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', command, ...args] }
    : { command, args };
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    env: {
      ...process.env,
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
      VITE_ENABLE_INTERNAL_TOOLS: 'true',
      UI_QUALITY_CAPTURE_DIR: captureRoot,
      UI_QUALITY_METRICS_PATH: metricsPath,
      UI_QUALITY_RUN_ID: qualityRunId,
    },
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (!quiet && result.stdout) process.stdout.write(result.stdout);
  if (!quiet && result.stderr) process.stderr.write(result.stderr);
  return result;
}

function playwright(update = false) {
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['playwright', 'test', 'e2e/ui-quality.spec.js', '--project=chromium-desktop'];
  if (update) args.push('--update-snapshots');
  console.log(`${update ? 'Approving' : 'Checking'} ${uiQualityScenes.length} deterministic UI scenes...`);
  const result = run(executable, args, { cwd: appRoot });
  if (result.status !== 0) throw new Error(`UI browser suite failed with exit code ${result.status ?? 'unknown'}.`);
}

function crossBrowser() {
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  console.log('Checking UI contracts in Chromium, Firefox, WebKit, Pixel 7, and iPhone 13...');
  const result = run(executable, ['playwright', 'test', 'e2e/ui-quality-cross-browser.spec.js'], { cwd: appRoot });
  if (result.status !== 0) throw new Error(`Cross-browser UI suite failed with exit code ${result.status ?? 'unknown'}.`);
}

function buildReport() {
  const approvalDocument = readJson(approvalsPath, { scenes: {} });
  const metricDocument = readJson(metricsPath, { scenes: [] });
  const report = buildUiQualityReport({
    scenes: uiQualityScenes,
    approvals: approvalDocument.scenes,
    appRoot,
    baselinePathFor: baselinePath,
    actualPathFor: actualPath,
    metrics: metricDocument.scenes,
    metricsGeneratedAt: metricDocument.generatedAt,
  });
  report.scenes = report.scenes.map((scene) => ({
    ...scene,
    baselinePath: relative(root, scene.baselinePath).replaceAll('\\', '/'),
    actualPath: relative(root, scene.actualPath).replaceAll('\\', '/'),
  }));
  writeJson(reportPath, report);
  writeFileSync(reportMarkdownPath, markdownForUiQuality(report));
  writeJson(publicPath, {
    generatedAt: report.generatedAt,
    status: report.status,
    grade: report.grade,
    summary: report.summary,
    nextAction: report.nextAction,
    scenes: report.scenes.map(({ id, label, status, reason }) => ({ id, label, status, reason })),
  });
  console.log(`UI quality ${report.grade}: ${report.summary.current}/${report.summary.total} approvals current.`);
  console.log(`Report: ${reportPath}`);
  return report;
}

function approve(args) {
  const owner = valueFlag(args, 'owner');
  const reason = valueFlag(args, 'reason');
  if (!owner || !reason) throw new Error('Approval requires --owner="..." and --reason="...".');
  playwright(true);
  const approvedAt = new Date().toISOString();
  const existing = readJson(approvalsPath, { schemaVersion: 1, scenes: {} });
  for (const scene of uiQualityScenes) {
    const baseline = baselinePath(scene);
    if (!existsSync(baseline)) throw new Error(`Playwright did not produce ${baseline}`);
    existing.scenes[scene.id] = {
      approvedAt,
      owner,
      reason,
      sourceHash: sourceHash(appRoot, scene.sources),
      baselineHash: sha256File(baseline),
      sources: scene.sources,
    };
  }
  existing.schemaVersion = 1;
  existing.updatedAt = approvedAt;
  writeJson(approvalsPath, existing);
  console.log(`Recorded explicit approval for ${uiQualityScenes.length} scenes at ${approvalsPath}`);
  return buildReport();
}

function composeComparisons() {
  mkdirSync(comparisonRoot, { recursive: true });
  const outputs = [];
  const diffs = [];
  for (const scene of uiQualityScenes) {
    const baseline = baselinePath(scene);
    const actual = actualPath(scene);
    if (!existsSync(baseline) || !existsSync(actual)) {
      console.warn(`Skipping ${scene.id}: baseline or actual capture is missing.`);
      continue;
    }
    const output = resolve(comparisonRoot, `${scene.id}.png`);
    const result = run('python', [resolve(root, 'scripts', 'compose_compare.py'), '--reference', baseline, '--actual', actual, '--output', output, '--height', '720'], { quiet: true });
    if (result.status !== 0) throw new Error(`Could not compose ${scene.id}: ${result.stderr || result.stdout}`);
    outputs.push(output);
    const diffPath = resolve(comparisonRoot, `${scene.id}-diff.png`);
    const difference = run('magick', ['compare', '-metric', 'AE', baseline, actual, diffPath], { quiet: true });
    const absoluteErrorPixels = Number.parseInt(String(difference.stderr || difference.stdout || '0').trim(), 10);
    diffs.push({
      id: scene.id,
      absoluteErrorPixels: Number.isFinite(absoluteErrorPixels) ? absoluteErrorPixels : null,
      exactMatch: difference.status === 0,
      diffPath: relative(root, diffPath).replaceAll('\\', '/'),
    });
  }
  if (!outputs.length) throw new Error('No complete baseline/current pairs are available. Run ui:quality:approve first.');

  const sheetPath = resolve(root, 'artifacts', 'ui-quality', 'contact-sheets', 'latest.png');
  mkdirSync(dirname(sheetPath), { recursive: true });
  const montage = run('magick', ['montage', ...outputs, '-tile', '1x', '-geometry', '+0+24', '-background', '#09070b', sheetPath], { quiet: true });
  if (montage.status !== 0) {
    console.warn('ImageMagick montage is unavailable; individual comparisons were still generated.');
  } else {
    console.log(`Contact sheet: ${sheetPath}`);
  }
  writeJson(resolve(root, 'artifacts', 'ui-quality', 'diffs', 'latest.json'), { generatedAt: new Date().toISOString(), scenes: diffs });
  console.log(`Comparisons: ${comparisonRoot}`);
  return { outputs, sheetPath: montage.status === 0 ? sheetPath : null };
}

function doctor(strict = false) {
  const report = buildReport();
  const checks = [
    ['approval ledger exists', existsSync(approvalsPath)],
    ['rendered metrics exist', existsSync(metricsPath)],
    ['every scene has an approved baseline', report.summary.current === report.summary.total],
    ['every scene has current rendered metrics', report.summary.metricsComplete],
    ['rendered metrics are no older than 14 days', report.summary.metricsFresh],
  ];
  for (const [label, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`);
  if (strict && checks.some(([, pass]) => !pass)) process.exitCode = 1;
  return report;
}

function usage() {
  console.log(`UI quality control plane

  capture                         Capture, compare, and report without changing approval
  approve --owner --reason        Update baselines and bind them to current source hashes
  report                          Re-evaluate source and baseline freshness
  contact-sheet                   Compose reference-left/current-right evidence
  cross-browser                   Run semantic and reflow contracts in every browser project
  doctor [--strict]               Check that evidence is complete and current`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'capture';
  if (command === 'capture') {
    playwright(false);
    const report = buildReport();
    composeComparisons();
    if (report.status !== 'pass') process.exitCode = 1;
  } else if (command === 'approve') {
    approve(args.slice(1));
    composeComparisons();
  } else if (command === 'report') buildReport();
  else if (command === 'contact-sheet') composeComparisons();
  else if (command === 'cross-browser') crossBrowser();
  else if (command === 'doctor') doctor(args.includes('--strict'));
  else if (['help', '--help', '-h'].includes(command)) usage();
  else throw new Error(`Unknown UI quality command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`UI quality failed: ${error.message}`);
  process.exitCode = 1;
}
