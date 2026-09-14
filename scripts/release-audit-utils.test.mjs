import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateReleaseMetadata,
  evaluateSecurityHeaders,
  isFullCommitSha,
  summarizeReleaseAudit,
  validateRollbackPlan,
} from './release-audit-utils.mjs';

test('validates production release metadata and an expected SHA', () => {
  const sha = 'a'.repeat(40);
  assert.equal(isFullCommitSha(sha), true);
  assert.equal(evaluateReleaseMetadata({ service: 'xenovoya-player', environment: 'production', release: sha, capabilities: { returnApi: true, sponsorDelegation: false } }, sha).pass, true);
  assert.equal(evaluateReleaseMetadata({ service: 'xenovoya-player', environment: 'preview', release: 'short' }, sha).pass, false);
  assert.equal(evaluateReleaseMetadata({ service: 'xenovoya-player', environment: 'production', release: sha, capabilities: { returnApi: 'yes' } }, sha).pass, false);
  assert.equal(evaluateReleaseMetadata({ service: 'xenovoya-site', environment: 'production', release: sha }, sha, { service: 'xenovoya-site' }).pass, true);
});

test('requires the complete player security-header contract', () => {
  const result = evaluateSecurityHeaders({
    'content-security-policy': "default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'",
    'strict-transport-security': 'max-age=31536000',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
  });
  assert.equal(result.pass, true);
  assert.equal(evaluateSecurityHeaders({}).pass, false);
});

test('separates required failures from optional evidence gaps', () => {
  assert.equal(summarizeReleaseAudit([{ id: 'a', status: 'pass' }, { id: 'b', status: 'skipped', required: false }]).grade, 'A-');
  const failed = summarizeReleaseAudit([{ id: 'a', status: 'fail' }, { id: 'b', status: 'pass' }]);
  assert.equal(failed.grade, 'B');
  assert.deepEqual(failed.requiredFailures, ['a']);
});

test('requires an actionable Coolify rollback contract', () => {
  const plan = {
    schemaVersion: 1,
    platform: 'coolify',
    application: 'xenovoya-player',
    branch: 'main',
    healthUrl: 'https://play.xenovoya.com/release.json',
    steps: ['Freeze', 'Redeploy', 'Verify'],
    validation: ['Release matches', 'Health passes'],
  };
  assert.equal(validateRollbackPlan(plan).pass, true);
  assert.equal(validateRollbackPlan({}).pass, false);
});
