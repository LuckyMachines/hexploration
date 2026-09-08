import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  buildPortfolio,
  buildRemediationPlan,
  capGrade,
  classifyChangedFiles,
  compactPublicReport,
  evaluateEvidence,
  evaluateReportRegistry,
  markdownForPortfolio,
  markdownForApplyReport,
  parseGitStatus,
  pathsOutsideDeclared,
  selectCommands,
  validateConfig,
  validatePromotionTransition,
  validateQualityRecords,
} from './improvement-control-plane-utils.mjs';

function fixture() {
  return {
    version: '1.0.0',
    name: 'Test control plane',
    defaultStaleDays: 14,
    promotionStates: ['idea', 'baseline', 'candidate', 'verified', 'retired'],
    allowedTransitions: {
      idea: ['baseline', 'retired'],
      baseline: ['candidate', 'retired'],
      candidate: ['verified', 'retired'],
      verified: ['retired'],
      retired: [],
    },
    commands: {
      shared: { label: 'Shared', command: 'node', args: ['--version'], timeoutMs: 1000 },
      art: { label: 'Art', command: 'node', args: ['--version'], timeoutMs: 1000 },
    },
    remediations: [],
    surfaces: [
      {
        id: 'ux', label: 'UX', owner: 'design', weight: 1, currentGrade: 'B+', objective: 'Clear choices', stricterABar: 'Observed clarity',
        pathPatterns: ['^app/src/'], evidence: [], quickCommands: ['shared'], fullCommands: ['shared'],
      },
      {
        id: 'art', label: 'Art', owner: 'art', weight: 1, currentGrade: 'A-', objective: 'Joy', stricterABar: 'Context proof',
        pathPatterns: ['^app/public/images/', '^scripts/art-'], evidence: [], quickCommands: ['shared', 'art'], fullCommands: ['shared', 'art'],
      },
    ],
  };
}

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'xenovoya-improve-'));
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function writeJson(root, path, value) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`);
}

test('validates the shared quality contract', () => {
  assert.deepEqual(validateConfig(fixture()), { ok: true, errors: [] });
  const broken = fixture();
  broken.surfaces[0].quickCommands = ['missing'];
  assert.equal(validateConfig(broken).ok, false);
});

test('classifies normalized changed files and parses rename status', () => {
  const config = fixture();
  const files = parseGitStatus(' M app\\src\\Board.jsx\nR  old.png -> app/public/images/new.png\n?? docs/new.md\n');
  assert.deepEqual(files, ['app/src/Board.jsx', 'app/public/images/new.png', 'docs/new.md']);
  assert.deepEqual(classifyChangedFiles(files, config.surfaces), [
    { id: 'ux', matchedFiles: ['app/src/Board.jsx'] },
    { id: 'art', matchedFiles: ['app/public/images/new.png'] },
  ]);
});

test('evaluates missing, stale, and minimum-record evidence', () => {
  const { root, cleanup } = tempRoot();
  try {
    assert.equal(evaluateEvidence(root, { path: 'missing.json', required: true }).status, 'missing');
    writeJson(root, 'stale.json', { generatedAt: '2020-01-01T00:00:00.000Z' });
    assert.equal(evaluateEvidence(root, { path: 'stale.json', maxAgeDays: 1 }, new Date('2026-01-01T00:00:00.000Z')).status, 'stale');
    writeJson(root, 'playtests.json', { updatedAt: '2026-01-01T00:00:00.000Z', sessions: [{ id: 'one' }] });
    const result = evaluateEvidence(root, { path: 'playtests.json', maxAgeDays: 30, minimumRecords: 5 }, new Date('2026-01-02T00:00:00.000Z'));
    assert.equal(result.status, 'insufficient');
    assert.equal(result.missingRecords, 4);
  } finally { cleanup(); }
});

test('caps grades without allowing a cap to improve a grade', () => {
  assert.equal(capGrade('A-', 'B'), 'B');
  assert.equal(capGrade('C', 'B'), 'C');
});

test('deduplicates shared verification commands while retaining surface ownership', () => {
  const selected = selectCommands(fixture(), ['ux', 'art'], 'quick');
  assert.deepEqual(selected.map((item) => item.id), ['shared', 'art']);
  assert.deepEqual(selected[0].surfaceIds, ['ux', 'art']);
});

test('rejects illegal promotion jumps', () => {
  const config = fixture();
  assert.equal(validatePromotionTransition(config, 'idea', 'baseline').ok, true);
  assert.equal(validatePromotionTransition(config, 'idea', 'verified').ok, false);
});

test('validates complete, unique, surface-bound quality records', () => {
  const fields = ['objective', 'hypothesis', 'baseline', 'evidence', 'grade', 'confidence', 'decision', 'owner', 'nextExperiment'];
  const complete = Object.fromEntries(fields.map((field) => [field, field === 'evidence' ? [] : 'value']));
  assert.equal(validateQualityRecords([{ id: 'one', surface: 'ux', ...complete }], fields, ['ux']).ok, true);
  const invalid = validateQualityRecords([{ id: 'one', surface: 'missing', ...complete }, { id: 'one', surface: 'ux', ...complete, owner: '' }], fields, ['ux']);
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join('\n'), /unknown surface/);
  assert.match(invalid.errors.join('\n'), /duplicate record id/);
  assert.match(invalid.errors.join('\n'), /missing owner/);
});

test('selects only bounded automatic repairs and preserves human blockers', () => {
  const config = fixture();
  config.remediations = [{
    id: 'refresh-art',
    label: 'Refresh art proof',
    surfaceIds: ['art'],
    actionTypes: ['stale-evidence'],
    evidencePaths: ['reports/art.json'],
    commandId: 'art',
    verifyCommandIds: ['shared'],
    writePaths: ['reports/art/'],
    risk: 'low',
    auto: true,
  }];
  assert.equal(validateConfig(config).ok, true);
  const actions = [
    { type: 'insufficient', surfaceId: 'player-validation', title: 'Record playtests', evidence: 'playtests.json' },
    { type: 'stale-evidence', surfaceId: 'art', title: 'Refresh art', evidence: 'reports/art.json' },
  ];
  const plan = buildRemediationPlan(actions, config);
  assert.equal(plan.next.recipe.id, 'refresh-art');
  assert.equal(plan.blocked[0].autonomy, 'human-required');
  const attempted = buildRemediationPlan(actions, config, { attempted: [plan.next.attemptKey] });
  assert.equal(attempted.next, null);
  assert.match(attempted.blocked.find((entry) => entry.action.surfaceId === 'art').reason, /already attempted/);
  assert.match(markdownForApplyReport({ status: 'blocked', blocked: plan.blocked }), /Needs Judgment/);
});

test('rejects unsafe or unknown remediation recipes', () => {
  const config = fixture();
  config.remediations = [{
    id: 'unsafe', label: 'Unsafe', surfaceIds: ['missing'], actionTypes: ['missing'], commandId: 'missing',
    verifyCommandIds: ['missing'], writePaths: ['../outside'], risk: 'extreme', auto: true,
  }];
  const result = validateConfig(config);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /unsafe write path/);
  assert.match(result.errors.join('\n'), /unknown repair command/);
});

test('detects writes outside a remediation allowlist', () => {
  assert.deepEqual(
    pathsOutsideDeclared(
      ['reports/seo/latest.json', 'app/public/sitemap.xml', 'app/src/App.jsx'],
      ['reports/seo/', 'app/public/sitemap.xml'],
    ),
    ['app/src/App.jsx'],
  );
});

test('builds a conservative portfolio and ranks failed checks first', () => {
  const config = fixture();
  const report = buildPortfolio({
    config,
    changedFiles: ['app/src/Board.jsx', 'app/public/images/new.png'],
    evidenceBySurface: {
      ux: [{ path: 'ux.json', required: true, status: 'missing' }],
      art: [{ path: 'art.json', required: true, status: 'current' }],
    },
    checkResults: [
      { id: 'shared', label: 'Shared', status: 'fail', surfaceIds: ['ux', 'art'] },
      { id: 'art', label: 'Art', status: 'pass', surfaceIds: ['art'] },
    ],
    promotionState: { surfaces: { ux: { state: 'candidate' }, art: { state: 'verified' } } },
    selectedSurfaceIds: ['ux', 'art'],
    reportInventory: [],
    checklistText: '- [x] One\n- [ ] Two\n',
    now: new Date('2026-01-01T00:00:00.000Z'),
  });
  assert.equal(report.status, 'fail');
  assert.equal(report.surfaces.find((item) => item.id === 'ux').observedGrade, 'C');
  assert.equal(report.nextAction.type, 'failed-check');
  assert.equal(report.metrics.verificationCoverage, 1);
  assert.equal(report.metrics.recommendationCompletionRate, 0.5);
});

test('creates compact public and markdown portfolio views', () => {
  const report = buildPortfolio({
    config: fixture(), evidenceBySurface: { ux: [], art: [] }, now: new Date('2026-01-01T00:00:00.000Z'),
  });
  const compact = compactPublicReport(report);
  assert.equal(compact.surfaces.length, 2);
  assert.equal('evidence' in compact.surfaces[0], false);
  assert.match(markdownForPortfolio(report), /# Improvement Portfolio/);
});

test('flags superseded and stale reports for retirement review', () => {
  const { root, cleanup } = tempRoot();
  try {
    writeJson(root, 'old.json', { generatedAt: '2020-01-01T00:00:00.000Z' });
    const reports = evaluateReportRegistry(root, {
      reports: [{ id: 'old', path: 'old.json', canonical: false, supersededBy: 'new', reviewCadenceDays: 1 }],
    }, new Date('2026-01-01T00:00:00.000Z'));
    assert.equal(reports[0].retirementCandidate, true);
  } finally { cleanup(); }
});
