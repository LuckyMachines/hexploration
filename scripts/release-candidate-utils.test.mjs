import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateReleaseCandidate, markdownForReleaseCandidate } from './release-candidate-utils.mjs';

const sha = 'a'.repeat(40);
const now = Date.parse('2026-09-14T20:00:00.000Z');

function validInput() {
  return {
    branch: 'main',
    localHead: sha,
    statusPorcelain: '',
    expectedRelease: sha,
    now,
    hardReport: {
      tier: 'hard',
      generatedAt: '2026-09-14T19:00:00.000Z',
      repo: { commit: sha.slice(0, 7), status: '' },
      score: { ok: true, failed: 0, timedOut: 0, skipped: 0 },
    },
    buildMetadata: {
      service: 'xenovoya-player',
      environment: 'production',
      release: sha,
      capabilities: { returnApi: true, sponsorDelegation: false },
    },
    rollbackPlan: {
      schemaVersion: 1,
      platform: 'coolify',
      application: 'xenovoya-player',
      branch: 'main',
      healthUrl: 'https://play.xenovoya.com/release.json',
      steps: ['Freeze', 'Redeploy', 'Verify'],
      validation: ['Release matches', 'Health passes'],
    },
  };
}

test('accepts only a clean, exact, reproducible release candidate', () => {
  const report = evaluateReleaseCandidate(validInput());
  assert.equal(report.ready, true);
  assert.equal(report.grade, 'A');
  assert.deepEqual(report.failures, []);
});

test('rejects dirty or mismatched candidate provenance', () => {
  const input = validInput();
  input.statusPorcelain = ' M app/src/App.jsx';
  input.hardReport.repo.status = ' M app/src/App.jsx';
  input.hardReport.repo.commit = 'b'.repeat(7);
  const report = evaluateReleaseCandidate(input);
  assert.equal(report.ready, false);
  assert.ok(report.failures.includes('candidate.clean'));
  assert.ok(report.failures.includes('candidate.hard-provenance'));
});

test('rejects stale, incomplete, or skipped hard verification', () => {
  const input = validInput();
  input.hardReport.generatedAt = '2026-09-01T00:00:00.000Z';
  input.hardReport.score.skipped = 1;
  const report = evaluateReleaseCandidate(input);
  assert.ok(report.failures.includes('candidate.hard-suite'));
});

test('requires explicit capability metadata in a new candidate build', () => {
  const input = validInput();
  delete input.buildMetadata.capabilities;
  const report = evaluateReleaseCandidate(input);
  assert.ok(report.failures.includes('candidate.build-metadata'));
});

test('renders an explicit deploy or do-not-deploy decision', () => {
  const ready = { generatedAt: 'now', localHead: sha, expectedRelease: sha, ...evaluateReleaseCandidate(validInput()) };
  assert.match(markdownForReleaseCandidate(ready), /may proceed to an explicit deployment decision/i);
  const blockedInput = validInput();
  blockedInput.expectedRelease = '';
  const blocked = { generatedAt: 'now', localHead: sha, expectedRelease: '', ...evaluateReleaseCandidate(blockedInput) };
  assert.match(markdownForReleaseCandidate(blocked), /Do not deploy/i);
});
