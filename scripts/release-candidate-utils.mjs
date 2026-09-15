import {
  evaluateReleaseMetadata,
  isFullCommitSha,
  validateRollbackPlan,
} from './release-audit-utils.mjs';

const HARD_EVIDENCE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function result(id, label, pass, detail) {
  return { id, label, required: true, status: pass ? 'pass' : 'fail', detail };
}

export function evaluateReleaseCandidate({
  branch = '',
  localHead = '',
  statusPorcelain = '',
  expectedRelease = '',
  hardReport = null,
  buildMetadata = null,
  rollbackPlan = null,
  now = Date.now(),
} = {}) {
  const checks = [];
  checks.push(result('candidate.branch', 'Release branch', branch === 'main', branch === 'main' ? 'main' : `expected main, received ${branch || 'unknown'}`));
  checks.push(result('candidate.clean', 'Clean checkout', !String(statusPorcelain).trim(), String(statusPorcelain).trim() ? 'tracked or untracked changes are present' : 'no Git-visible changes'));

  const expectedValid = isFullCommitSha(expectedRelease);
  checks.push(result('candidate.expected-sha', 'Expected release SHA', expectedValid, expectedValid ? expectedRelease : 'supply a full 40-character XENOVOYA_EXPECTED_RELEASE_SHA'));
  checks.push(result('candidate.head-match', 'Expected SHA matches HEAD', expectedValid && localHead === expectedRelease, expectedValid && localHead === expectedRelease ? localHead : `HEAD ${localHead || 'unknown'} does not match expected ${expectedRelease || 'missing'}`));

  const hardGeneratedAt = Date.parse(hardReport?.generatedAt || '');
  const hardAgeMs = Number.isFinite(hardGeneratedAt) ? now - hardGeneratedAt : Number.POSITIVE_INFINITY;
  const hardFresh = hardAgeMs >= -5 * 60 * 1000 && hardAgeMs <= HARD_EVIDENCE_MAX_AGE_MS;
  const hardPassed = hardReport?.tier === 'hard'
    && hardReport?.score?.ok === true
    && hardReport?.score?.failed === 0
    && hardReport?.score?.timedOut === 0
    && hardReport?.score?.skipped === 0;
  checks.push(result('candidate.hard-suite', 'Hard verification evidence', hardPassed && hardFresh, hardPassed && hardFresh ? `A evidence from ${hardReport.generatedAt}` : 'fresh hard-tier evidence with zero failures, timeouts, and skips is required'));

  const hardCommit = String(hardReport?.repo?.commit || '');
  const hardCommitMatches = hardCommit.length >= 7 && isFullCommitSha(localHead) && localHead.startsWith(hardCommit);
  const hardWasClean = !String(hardReport?.repo?.status || '').trim();
  checks.push(result('candidate.hard-provenance', 'Hard evidence provenance', hardCommitMatches && hardWasClean, hardCommitMatches && hardWasClean ? `clean ${hardCommit}` : 'hard evidence must come from this commit and a clean checkout'));

  const metadata = evaluateReleaseMetadata(buildMetadata || {}, expectedRelease);
  const capabilitiesComplete = typeof buildMetadata?.capabilities?.returnApi === 'boolean'
    && typeof buildMetadata?.capabilities?.managedPlay === 'boolean';
  const metadataFailures = [
    ...metadata.failures,
    ...(capabilitiesComplete ? [] : ['capabilities.returnApi and capabilities.managedPlay must be declared']),
  ];
  checks.push(result('candidate.build-metadata', 'Production build identity', metadataFailures.length === 0, metadataFailures.length === 0 ? buildMetadata.release : metadataFailures.join('; ')));

  const rollback = validateRollbackPlan(rollbackPlan || {});
  checks.push(result('candidate.rollback', 'Rollback contract', rollback.pass, rollback.pass ? `${rollbackPlan.platform}/${rollbackPlan.application}` : rollback.failures.join('; ')));

  const failures = checks.filter((check) => check.status === 'fail');
  return {
    ready: failures.length === 0,
    grade: failures.length === 0 ? 'A' : failures.length <= 2 ? 'B' : 'C',
    checks,
    failures: failures.map((check) => check.id),
  };
}

export function markdownForReleaseCandidate(report) {
  const lines = [
    '# Xenovoya Release Candidate Audit',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.ready ? 'READY' : 'NOT READY'}`,
    `Grade: ${report.grade}`,
    `Candidate: ${report.localHead || 'unknown'}`,
    `Expected: ${report.expectedRelease || 'not supplied'}`,
    '',
    '## Checks',
    '',
    '| Check | Result | Detail |',
    '| --- | --- | --- |',
  ];
  report.checks.forEach((check) => lines.push(`| ${check.label} | ${check.status.toUpperCase()} | ${String(check.detail || '').replaceAll('|', '\\|')} |`));
  lines.push('', '## Decision', '');
  if (report.ready) lines.push('- Candidate is locally reproducible and may proceed to an explicit deployment decision. Deployment and post-release exact-SHA verification remain separate gates.');
  else lines.push(`- Do not deploy. Resolve: ${report.failures.join(', ')}.`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}
