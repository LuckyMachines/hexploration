import { createHash } from 'node:crypto';

export const REQUIRED_SECURITY_HEADERS = {
  'content-security-policy': ['default-src', 'script-src', 'connect-src', "object-src 'none'", "frame-ancestors 'none'"],
  'strict-transport-security': ['max-age='],
  'x-content-type-options': ['nosniff'],
  'x-frame-options': ['deny'],
  'referrer-policy': ['strict-origin-when-cross-origin'],
  'permissions-policy': ['camera=()', 'microphone=()', 'geolocation=()'],
  'cross-origin-opener-policy': ['same-origin'],
  'cross-origin-resource-policy': ['same-origin'],
};

export function isFullCommitSha(value) {
  return /^[a-f0-9]{40}$/i.test(String(value || ''));
}

export function evaluateSecurityHeaders(headers = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value).toLowerCase()]));
  const failures = [];
  for (const [name, fragments] of Object.entries(REQUIRED_SECURITY_HEADERS)) {
    const value = normalized[name] || '';
    if (!value) failures.push(`${name} is missing`);
    else for (const fragment of fragments) {
      if (!value.includes(fragment)) failures.push(`${name} is missing ${fragment}`);
    }
  }
  return { pass: failures.length === 0, failures };
}

export function evaluateReleaseMetadata(payload = {}, expectedRelease = '', { service = 'xenovoya-player' } = {}) {
  const failures = [];
  if (payload.service !== service) failures.push(`service must be ${service}`);
  if (payload.environment !== 'production') failures.push('environment must be production');
  if (!isFullCommitSha(payload.release)) failures.push('release must be a full commit SHA');
  if (expectedRelease && payload.release !== expectedRelease) failures.push(`release does not match expected ${expectedRelease}`);
  if (payload.capabilities !== undefined) {
    if (typeof payload.capabilities?.returnApi !== 'boolean') failures.push('capabilities.returnApi must be boolean');
    if (typeof payload.capabilities?.managedPlay !== 'boolean') failures.push('capabilities.managedPlay must be boolean');
  }
  return { pass: failures.length === 0, failures };
}

export function validateRollbackPlan(plan = {}) {
  const failures = [];
  if (plan.schemaVersion !== 1) failures.push('schemaVersion must be 1');
  if (plan.platform !== 'coolify') failures.push('platform must be coolify');
  if (!plan.application || !plan.branch || !plan.healthUrl) failures.push('application, branch, and healthUrl are required');
  if (!Array.isArray(plan.steps) || plan.steps.length < 3) failures.push('at least three rollback steps are required');
  if (!Array.isArray(plan.validation) || plan.validation.length < 2) failures.push('at least two rollback validations are required');
  return { pass: failures.length === 0, failures };
}

export function summarizeReleaseAudit(checks = []) {
  const requiredFailures = checks.filter((check) => check.required !== false && check.status === 'fail');
  const optionalGaps = checks.filter((check) => check.required === false && check.status !== 'pass');
  const status = requiredFailures.length ? 'fail' : optionalGaps.length ? 'pass-with-caveats' : 'pass';
  const grade = requiredFailures.length ? (requiredFailures.length >= 3 ? 'C' : 'B') : optionalGaps.length ? 'A-' : 'A';
  return {
    status,
    grade,
    total: checks.length,
    passed: checks.filter((check) => check.status === 'pass').length,
    failed: checks.filter((check) => check.status === 'fail').length,
    skipped: checks.filter((check) => check.status === 'skipped').length,
    requiredFailures: requiredFailures.map((check) => check.id),
    optionalGaps: optionalGaps.map((check) => check.id),
  };
}

export function stableObjectHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function markdownForReleaseAudit(report) {
  const lines = [
    '# Xenovoya Live Release Audit',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.summary.status.toUpperCase()}`,
    `Grade: ${report.summary.grade}`,
    `Observed release: ${report.observedRelease || 'unavailable'}`,
    `Expected release: ${report.expectedRelease || 'not supplied'}`,
    `Observed marketing release: ${report.observedMarketingRelease || 'unavailable'}`,
    `Expected marketing release: ${report.expectedMarketingRelease || 'not supplied'}`,
    `Checkout relationship: ${report.checkoutRelationship || 'unknown'}`,
    '',
    '## Checks',
    '',
    '| Check | Required | Result | Detail |',
    '| --- | --- | --- | --- |',
  ];
  report.checks.forEach((check) => lines.push(`| ${check.label} | ${check.required === false ? 'no' : 'yes'} | ${check.status.toUpperCase()} | ${(check.detail || '').replaceAll('|', '\\|')} |`));
  lines.push('', '## Release decision', '');
  if (report.summary.status === 'pass') lines.push('- The deployed release satisfies every automated live gate. Human smoke review and the explicit promotion decision remain separate records.');
  else if (report.summary.status === 'pass-with-caveats') lines.push(`- Required live gates pass. Resolve optional evidence gaps: ${report.summary.optionalGaps.join(', ')}.`);
  else lines.push(`- Do not promote. Required live gates failed: ${report.summary.requiredFailures.join(', ')}.`);
  lines.push('', '## Rollback', '', `- Contract: ${report.rollbackPlan.path}`, `- Fingerprint: ${report.rollbackPlan.sha256}`, '');
  return `${lines.join('\n')}\n`;
}
