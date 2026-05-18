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
  ]);
  const ids = selected.map((item) => item.id).sort();
  assert.deepEqual(ids, ['focused.app-page-tests', 'focused.oracle-tests', 'smoke.app-focused-tests']);
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

