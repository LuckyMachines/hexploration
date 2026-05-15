import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  applyAutopilotCandidate,
  autopilotLimits,
  buildAutopilotReport,
  compareAutopilotRuns,
  finalAutopilotVerdict,
  generateAutopilotCandidates,
  normalizeAutopilotIntent,
  resolveAutopilotScenario,
  rollbackAutopilotPatch,
  selectAutopilotCandidate,
  writeAutopilotReport,
} from './scenario-autopilot-utils.mjs';

function sampleReport(score = 50, overrides = {}) {
  return {
    schemaVersion: 1,
    scenarioDefinition: { id: 'autopilot-test', requiredSetupLevel: 'metadata' },
    aggregate: {
      actionTotals: { Move: 1, Rest: 3 },
      averages: {
        invalidAttempts: 0,
        zeroStatPlayers: 0,
        artifacts: 0,
        revealedZones: 1,
      },
      warnings: [],
    },
    funDebugger: {
      averageLifeScore: score,
      flatTurnRate: score < 60 ? 0.5 : 0.1,
      aliveTurnRate: score < 60 ? 0.1 : 0.6,
      topIssue: { key: 'oneChoice', label: 'One choice' },
    },
    oracle: {
      weightedScore: score,
      confidence: 0.7,
      oracleVerdict: score >= 65 ? 'pass' : 'mixed',
      experienceScores: {
        agency: { score: score - 10 },
        readability: { score },
      },
      setup: { level: 'metadata', requiredSetupLevel: 'metadata' },
    },
    ...overrides,
  };
}

test('normalizes plain-English autopilot intent', () => {
  const intent = normalizeAutopilotIntent('4-player escape should feel desperate but cooperative, not hopeless');
  assert.match(intent.slug, /^4-player-escape-should-feel-desperate-but-cooperative-not/);
  assert.ok(intent.qualities.includes('tense'));
  assert.ok(intent.qualities.includes('cooperative'));
  assert.ok(intent.qualities.includes('fair'));
});

test('resolves a new scenario with setup forge support', () => {
  const plan = resolveAutopilotScenario({
    intentText: 'solo artifact hunting should feel risky but rewarding',
    store: { schemaVersion: 1, scenarios: [], packs: [] },
  });
  assert.match(plan.scenario.id, /^autopilot-/);
  assert.ok(plan.scenario.tags.includes('artifact'));
  assert.equal(plan.setupValidation.ok, true);
});

test('generates and selects grounded candidates from weak evidence', () => {
  const plan = resolveAutopilotScenario({
    intentText: 'solo artifact hunting should feel risky but rewarding',
    store: { schemaVersion: 1, scenarios: [], packs: [] },
  });
  const oracle = sampleReport(48).oracle;
  const candidates = generateAutopilotCandidates({
    scenario: plan.scenario,
    baselineReport: sampleReport(48),
    baselineOracle: oracle,
    setupValidation: plan.setupValidation,
    balance: { knobs: { moveBias: 1, digBias: 1, artifactLifeReward: 22 } },
  });
  assert.ok(candidates.length > 0);
  assert.ok(selectAutopilotCandidate(candidates));
});

test('compares reruns and accepts clear improvements', () => {
  const comparison = compareAutopilotRuns(sampleReport(45), sampleReport(45).oracle, sampleReport(70), sampleReport(70).oracle);
  assert.equal(comparison.accepted, true);
  assert.equal(comparison.delta.weightedScore, 25);
});

test('compares reruns and rejects clear regressions', () => {
  const comparison = compareAutopilotRuns(sampleReport(70), sampleReport(70).oracle, sampleReport(55), sampleReport(55).oracle);
  assert.equal(comparison.accepted, false);
  assert.ok(comparison.rejectedReasons.length > 0);
});

test('applies and rolls back scenario and balance patches', () => {
  const dir = mkdtempSync(join(tmpdir(), 'autopilot-'));
  const scenarioPath = join(dir, 'simulator.scenarios.json');
  const balanceFile = join(dir, 'simulator.balance.json');
  writeFileSync(scenarioPath, JSON.stringify({
    schemaVersion: 1,
    scenarios: [{
      id: 'autopilot-test',
      name: 'Autopilot Test',
      designQuestion: 'Does this work?',
      players: 1,
      turns: 10,
      strategies: ['balanced'],
      tags: ['smoke'],
      targets: [],
      failureSignals: [],
    }],
    packs: [],
  }, null, 2));
  writeFileSync(balanceFile, JSON.stringify({ schemaVersion: 1, knobs: { moveBias: 1 }, gates: {} }, null, 2));

  const scenarioPatch = {
    id: 'scenario-patch',
    files: ['simulator.scenarios.json'],
    patch: { file: 'simulator.scenarios.json', scenarioId: 'autopilot-test', patch: { turns: 8 } },
  };
  const appliedScenario = applyAutopilotCandidate(scenarioPatch, { storePath: scenarioPath, balanceFile });
  assert.match(readFileSync(scenarioPath, 'utf8'), /"turns": 8/);
  rollbackAutopilotPatch(appliedScenario, { storePath: scenarioPath, balanceFile });
  assert.match(readFileSync(scenarioPath, 'utf8'), /"turns": 10/);

  const balancePatch = {
    id: 'balance-patch',
    files: ['simulator.balance.json'],
    patch: { file: 'simulator.balance.json', knobs: { moveBias: 3 } },
  };
  const appliedBalance = applyAutopilotCandidate(balancePatch, { storePath: scenarioPath, balanceFile });
  assert.match(readFileSync(balanceFile, 'utf8'), /"moveBias": 3/);
  rollbackAutopilotPatch(appliedBalance, { storePath: scenarioPath, balanceFile });
  assert.match(readFileSync(balanceFile, 'utf8'), /"moveBias": 1/);
  rmSync(dir, { recursive: true, force: true });
});

test('builds reports with target-aware verdicts', () => {
  const limits = autopilotLimits({ targetScore: 65, targetConfidence: 0.6 });
  const report = buildAutopilotReport({
    mode: 'dry-run',
    intent: normalizeAutopilotIntent('make it alive'),
    scenario: { id: 'autopilot-test', requiredSetupLevel: 'metadata' },
    setupValidation: { warnings: [] },
    baselineReport: sampleReport(68),
    baselineOracle: sampleReport(68).oracle,
    limits,
  });
  assert.equal(report.finalVerdict, 'target-met');
});

test('writes an autopilot report and design memo', () => {
  const report = buildAutopilotReport({
    mode: 'dry-run',
    intent: normalizeAutopilotIntent('make it alive'),
    scenario: { id: `autopilot-test-${Date.now()}`, requiredSetupLevel: 'metadata' },
    setupValidation: { warnings: [] },
    baselineReport: null,
    baselineOracle: null,
  });
  const written = writeAutopilotReport(report);
  assert.ok(written.paths.latest);
  assert.match(written.designMemo, /Scenario Autopilot Memo/);
});
