export const TIERS = ['smoke', 'focused', 'hard', 'exact', 'release'];

export const DEFAULT_TIMEOUTS = {
  quick: 30_000,
  medium: 120_000,
  heavy: 300_000,
  exact: 420_000,
  release: 600_000,
};

export function parseArgs(args = []) {
  const parsed = {
    tier: 'smoke',
    continueOnFail: false,
    json: false,
    markdown: false,
    doctor: false,
    latest: false,
    cleanArtifacts: false,
    strict: false,
    jobs: 1,
    skips: new Set(),
  };

  for (const arg of args) {
    if (arg === '--continue-on-fail') parsed.continueOnFail = true;
    else if (arg === '--json') parsed.json = true;
    else if (arg === '--markdown') parsed.markdown = true;
    else if (arg === '--doctor') parsed.doctor = true;
    else if (arg === '--latest') parsed.latest = true;
    else if (arg === '--clean-artifacts') parsed.cleanArtifacts = true;
    else if (arg === '--strict') parsed.strict = true;
    else if (arg.startsWith('--tier=')) parsed.tier = arg.slice('--tier='.length);
    else if (arg.startsWith('--jobs=')) parsed.jobs = Math.max(1, Number(arg.slice('--jobs='.length)) || 1);
    else if (arg.startsWith('--skip-')) parsed.skips.add(arg.slice('--skip-'.length));
  }

  if (!TIERS.includes(parsed.tier)) {
    throw new Error(`Unknown verification tier "${parsed.tier}". Expected one of: ${TIERS.join(', ')}`);
  }

  return parsed;
}

export function resolveExecutable(name, platform = process.platform) {
  if (platform === 'win32' && ['npm', 'npx'].includes(name)) return `${name}.cmd`;
  return name;
}

export function formatDuration(ms = 0) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

export function tailText(text = '', maxLines = 40) {
  const lines = String(text || '').split(/\r?\n/);
  return lines.slice(Math.max(0, lines.length - maxLines)).join('\n').trim();
}

export function scoreReport(steps = []) {
  const passed = steps.filter((step) => step.status === 'pass').length;
  const failed = steps.filter((step) => step.status === 'fail').length;
  const timedOut = steps.filter((step) => step.status === 'timed-out').length;
  const skipped = steps.filter((step) => step.status === 'skipped').length;
  return {
    ok: failed === 0 && timedOut === 0,
    passed,
    failed,
    timedOut,
    skipped,
    total: steps.length,
  };
}

export function gradeHardness(report = {}) {
  const ids = new Set((report.steps || []).filter((step) => step.status === 'pass').map((step) => step.id));
  const hasSmoke = ids.has('smoke.local-doctor-tests') && ids.has('smoke.ui-density');
  const hasBuild = ids.has('hard.forge-build') || ids.has('focused.app-build');
  const hasApp = ids.has('hard.app-test') || ids.has('focused.app-build');
  const hasExact = ids.has('exact.local-doctor-gate');
  const hasE2e = ids.has('release.e2e');
  const hasDensity = ids.has('release.ui-density-strict') || ids.has('smoke.ui-density');

  if (hasSmoke && hasBuild && hasApp && hasExact && hasE2e && hasDensity) return 'A+';
  if (hasSmoke && hasBuild && hasApp && hasExact && hasDensity) return 'A';
  if (hasSmoke && hasBuild && hasApp && hasDensity) return 'B+';
  if (hasSmoke && hasDensity) return 'B';
  return 'C';
}

export function markdownForReport(report = {}) {
  const score = report.score || scoreReport(report.steps || []);
  const lines = [
    `# Verification ${score.ok ? 'Passed' : 'Failed'}`,
    '',
    `Tier: ${report.tier || 'unknown'}`,
    `Generated: ${report.generatedAt || 'unknown'}`,
    `Grade: ${report.hardnessGrade || 'n/a'}`,
    `Summary: ${score.passed} passed, ${score.failed} failed, ${score.timedOut} timed out, ${score.skipped} skipped`,
    '',
    '## Steps',
    '',
  ];

  for (const step of report.steps || []) {
    lines.push(`- ${step.status.toUpperCase()} ${step.id} (${formatDuration(step.durationMs || 0)})`);
    if (step.label) lines.push(`  ${step.label}`);
    if (step.hint && step.status !== 'pass') lines.push(`  Hint: ${step.hint}`);
  }

  const failed = (report.steps || []).filter((step) => ['fail', 'timed-out'].includes(step.status));
  if (failed.length > 0) {
    lines.push('', '## Failed Output', '');
    for (const step of failed) {
      lines.push(`### ${step.id}`, '');
      if (step.stderrTail) lines.push('```', step.stderrTail, '```');
      else if (step.stdoutTail) lines.push('```', step.stdoutTail, '```');
      else lines.push('No output captured.');
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

const CHANGED_FILE_TEST_MAP = [
  { pattern: /^scripts\/local-stack-/, commandId: 'smoke.local-doctor-tests', reason: 'local stack script changed' },
  { pattern: /^scripts\/scenario-/, commandId: 'smoke.scenario-tests', reason: 'scenario tooling changed' },
  { pattern: /^scripts\/setup-/, commandId: 'focused.setup-tests', reason: 'setup tooling changed' },
  { pattern: /^scripts\/gameplay-oracle/, commandId: 'focused.oracle-tests', reason: 'oracle tooling changed' },
  { pattern: /^scripts\/playable-design-memory/, commandId: 'focused.memory-tests', reason: 'memory tooling changed' },
  { pattern: /^scripts\/player-feeling/, commandId: 'focused.feel-tests', reason: 'feeling tooling changed' },
  { pattern: /^scripts\/growth-/, commandId: 'focused.growth-tests', reason: 'growth tooling changed' },
  { pattern: /^scripts\/fun-/, commandId: 'focused.fun-tests', reason: 'fun tooling changed' },
  { pattern: /^app\/src\/lib\/interfaceDensity/, commandId: 'smoke.app-focused-tests', reason: 'interface density changed' },
  { pattern: /^app\/src\/components\/actions\//, commandId: 'smoke.app-focused-tests', reason: 'action UI changed' },
  { pattern: /^app\/src\/components\/board\//, commandId: 'smoke.app-focused-tests', reason: 'board UI changed' },
  { pattern: /^app\/src\/pages\//, commandId: 'focused.app-page-tests', reason: 'app page changed' },
];

export function selectFocusedCommands(changedFiles = []) {
  const selected = new Map();
  for (const file of changedFiles) {
    const normalized = file.replace(/\\/g, '/').replace(/^\s*[MADRCU?!]+\s+/, '');
    for (const entry of CHANGED_FILE_TEST_MAP) {
      if (entry.pattern.test(normalized)) {
        if (!selected.has(entry.commandId)) {
          selected.set(entry.commandId, { id: entry.commandId, reasons: [] });
        }
        selected.get(entry.commandId).reasons.push(`${entry.reason}: ${normalized}`);
      }
    }
  }
  return [...selected.values()];
}

export function compactPublicReport(report = {}) {
  return {
    schemaVersion: 1,
    generatedAt: report.generatedAt,
    tier: report.tier,
    ok: report.score?.ok ?? false,
    score: report.score,
    hardnessGrade: report.hardnessGrade,
    failedSteps: (report.steps || [])
      .filter((step) => ['fail', 'timed-out'].includes(step.status))
      .map((step) => ({ id: step.id, label: step.label, status: step.status, hint: step.hint })),
    durationMs: report.durationMs,
    commit: report.repo?.commit,
    branch: report.repo?.branch,
  };
}

export function hintForFailure(step = {}) {
  const text = `${step.id || ''} ${step.stderrTail || ''} ${step.stdoutTail || ''}`.toLowerCase();
  if (text.includes('playwright')) return 'Run the Playwright command locally and check browser/server setup.';
  if (text.includes('forge')) return 'Run forge build/test directly to inspect the Solidity failure.';
  if (text.includes('local-stack')) return 'Run npm run local:doctor -- --markdown, then retry local stack boot.';
  if (text.includes('vitest')) return 'Run the targeted Vitest command shown in the step.';
  if (text.includes('sim')) return 'Regenerate or compare simulator evidence before accepting a baseline.';
  return 'Run the step command directly for full output.';
}

