#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = resolve(root, 'app');
const suites = {
  input: {
    spec: 'e2e/ux-input.spec.js',
    projects: ['chromium-desktop'],
    scope: ['keyboard path', '200 percent reflow', 'forced colors', 'reduced motion'],
  },
  assistive: {
    spec: 'e2e/ux-assistive.spec.js',
    projects: ['chromium-desktop', 'firefox-desktop', 'webkit-desktop'],
    scope: ['landmarks', 'heading hierarchy', 'accessible names', 'live announcements', 'dialog focus restoration'],
  },
  touch: {
    spec: 'e2e/ux-touch.spec.js',
    projects: ['pixel-7', 'iphone-13'],
    scope: ['tap-only completion', '44 px targets', 'horizontal reflow', 'dialog close target', 'destructive confirmation'],
  },
};

const suiteId = process.argv[2];
const suite = suites[suiteId];
if (!suite) {
  console.error(`Usage: node scripts/ux-browser-evidence.mjs ${Object.keys(suites).join('|')}`);
  process.exit(1);
}

const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['playwright', 'test', suite.spec, ...suite.projects.flatMap((project) => [`--project=${project}`])];
const invocation = process.platform === 'win32'
  ? { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', executable, ...args] }
  : { command: executable, args };
const startedAt = new Date();
const result = spawnSync(invocation.command, invocation.args, {
  cwd: appRoot,
  env: { ...process.env, VITE_ENABLE_INTERNAL_TOOLS: 'true' },
  encoding: 'utf8',
  windowsHide: true,
  shell: false,
  maxBuffer: 32 * 1024 * 1024,
});
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) process.stderr.write(`${result.error.message}\n`);

const report = {
  schemaVersion: 1,
  id: suiteId,
  source: 'playwright-synthetic',
  generatedAt: new Date().toISOString(),
  durationMs: Date.now() - startedAt.getTime(),
  status: result.status === 0 ? 'pass' : 'fail',
  projects: suite.projects,
  scope: suite.scope,
  command: `npx playwright test ${suite.spec} ${suite.projects.map((project) => `--project=${project}`).join(' ')}`,
};
const output = resolve(root, 'reports', 'ux', 'browser', `${suiteId}.json`);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`UX browser evidence ${report.status}: ${output}`);
process.exitCode = result.status ?? 1;
