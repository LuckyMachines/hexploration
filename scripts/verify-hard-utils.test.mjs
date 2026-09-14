import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compactPublicReport,
  formatDuration,
  gradeHardness,
  markdownForReport,
  parseArgs,
  resolveExecutable,
  scoreReport,
  selectFocusedCommands,
  tailText,
  verificationReportBasename,
} from './verify-hard-utils.mjs';

test('parseArgs reads tier, output modes, skips, and jobs', () => {
  const args = parseArgs(['--tier=hard', '--continue-on-fail', '--json', '--jobs=3', '--skip-forge']);
  assert.equal(args.tier, 'hard');
  assert.equal(args.continueOnFail, true);
  assert.equal(args.json, true);
  assert.equal(args.jobs, 3);
  assert.equal(args.skips.has('forge'), true);
});

test('parseArgs rejects unknown tiers', () => {
  assert.throws(() => parseArgs(['--tier=chaos']), /Unknown verification tier/);
});

test('resolveExecutable uses Windows npm wrappers only on Windows', () => {
  assert.equal(resolveExecutable('npm', 'win32'), 'npm.cmd');
  assert.equal(resolveExecutable('npx', 'win32'), 'npx.cmd');
  assert.equal(resolveExecutable('node', 'win32'), 'node');
  assert.equal(resolveExecutable('npm', 'linux'), 'npm');
});

test('verification tiers keep independent report artifacts', () => {
  assert.equal(verificationReportBasename({ tier: 'smoke' }), 'latest-smoke');
  assert.equal(verificationReportBasename({ tier: 'hard' }), 'latest-hard');
  assert.equal(verificationReportBasename({ tier: 'release' }), 'latest-release');
  assert.equal(verificationReportBasename({ latest: true }), 'latest-hard');
  assert.equal(verificationReportBasename({ doctor: true }), 'latest-doctor');
});

test('formatDuration and tailText keep reports compact', () => {
  assert.equal(formatDuration(250), '250ms');
  assert.equal(formatDuration(1250), '1.3s');
  assert.equal(formatDuration(125000), '2m 5s');
  assert.equal(tailText('a\nb\nc\nd', 2), 'c\nd');
});

test('scoreReport counts pass, fail, skipped, and timeouts', () => {
  assert.deepEqual(scoreReport([
    { status: 'pass' },
    { status: 'fail' },
    { status: 'timed-out' },
    { status: 'skipped' },
  ]), {
    ok: false,
    passed: 1,
    failed: 1,
    timedOut: 1,
    skipped: 1,
    total: 4,
  });
});

test('selectFocusedCommands maps changed files to targeted checks', () => {
  const selected = selectFocusedCommands([
    'M scripts/gameplay-oracle.mjs',
    'M app/src/components/board/BoardPresence.jsx',
    'M app/src/pages/GamePage.jsx',
    'M app/src/characters/character-catalog.json',
  ]);
  const ids = selected.map((item) => item.id).sort();
  assert.deepEqual(ids, ['focused.app-page-tests', 'focused.character-ci', 'focused.oracle-tests', 'smoke.app-focused-tests']);
});

test('selectFocusedCommands treats material contracts and runtime surfaces as one gate', () => {
  const selected = selectFocusedCommands([
    'M scripts/material-pipeline.mjs',
    'M app/src/art-pipeline/material-system.json',
    'M app/public/images/art/materials/slate-spires/normal.webp',
    'M app/src/components/board/lightingRigs.js',
  ]);
  const materialGate = selected.find((item) => item.id === 'focused.material-ci');
  assert.ok(materialGate);
  assert.equal(materialGate.reasons.length, 4);
});

test('markdownForReport includes failures and hints', () => {
  const markdown = markdownForReport({
    tier: 'smoke',
    generatedAt: '2026-05-18T00:00:00.000Z',
    hardnessGrade: 'B',
    score: { ok: false, passed: 1, failed: 1, timedOut: 0, skipped: 0 },
    steps: [
      { id: 'ok', status: 'pass', durationMs: 1 },
      { id: 'bad', label: 'Bad step', status: 'fail', durationMs: 2, hint: 'Fix it', stderrTail: 'nope' },
    ],
  });
  assert.match(markdown, /Verification Failed/);
  assert.match(markdown, /FAIL bad/);
  assert.match(markdown, /Fix it/);
});

test('gradeHardness and compactPublicReport summarize reports', () => {
  const report = {
    generatedAt: 'now',
    tier: 'hard',
    durationMs: 100,
    repo: { commit: 'abc', branch: 'main' },
    score: { ok: false },
    steps: [
      { id: 'smoke.local-doctor-tests', status: 'pass' },
      { id: 'smoke.ui-density', status: 'pass' },
      { id: 'focused.app-build', status: 'pass' },
      { id: 'bad', status: 'fail', label: 'Bad', hint: 'Run bad' },
    ],
  };

  assert.equal(gradeHardness(report), 'B+');
  assert.deepEqual(compactPublicReport(report).failedSteps, [
    { id: 'bad', label: 'Bad', status: 'fail', hint: 'Run bad' },
  ]);
});

test('hard aggregate utility coverage satisfies the smoke foundation', () => {
  assert.equal(gradeHardness({
    steps: [
      { id: 'hard.root-node-tests', status: 'pass' },
      { id: 'smoke.ui-density', status: 'pass' },
      { id: 'hard.forge-build', status: 'pass' },
      { id: 'hard.app-test', status: 'pass' },
      { id: 'exact.local-doctor-gate', status: 'pass' },
    ],
  }), 'A');
});
