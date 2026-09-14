#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateReleaseCandidate, markdownForReleaseCandidate } from './release-candidate-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const noWrite = argv.includes('--no-write');
const expectedArg = argv.find((arg) => arg.startsWith('--expected='));
const expectedRelease = expectedArg?.slice('--expected='.length) || process.env.XENOVOYA_EXPECTED_RELEASE_SHA || '';

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : '';
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

const localHead = git(['rev-parse', 'HEAD']);
const evaluated = evaluateReleaseCandidate({
  branch: git(['branch', '--show-current']),
  localHead,
  statusPorcelain: git(['status', '--porcelain', '--untracked-files=all']),
  expectedRelease,
  hardReport: readJson(resolve(root, 'reports', 'verification', 'latest-hard.json')),
  buildMetadata: readJson(resolve(root, 'app', 'dist', 'release.json')),
  rollbackPlan: readJson(resolve(root, 'release', 'rollback-plan.json')),
});
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  localHead: localHead || null,
  expectedRelease: expectedRelease || null,
  ...evaluated,
};

if (!noWrite) {
  const reportRoot = resolve(root, 'reports', 'release');
  mkdirSync(reportRoot, { recursive: true });
  writeFileSync(resolve(reportRoot, 'latest-candidate.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(resolve(reportRoot, 'latest-candidate.md'), markdownForReleaseCandidate(report), 'utf8');
}

process.stdout.write(markdownForReleaseCandidate(report));
if (strict && !report.ready) process.exitCode = 1;
