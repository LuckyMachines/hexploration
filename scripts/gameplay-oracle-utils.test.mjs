import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRunArc,
  classifyTurnExperience,
  evaluateOracle,
  evaluateRegressionGate,
  findDecisiveTurns,
  markdownForOracle,
  normalizeReportForOracle,
  oracleTaskFromRecommendation,
  scoreAgency,
  scoreReadability,
  summarizeOraclePack,
} from './gameplay-oracle-utils.mjs';
import { normalizeScenario } from './scenario-utils.mjs';

function player(stats = { movement: 3, agility: 3, dexterity: 3 }, artifacts = []) {
  return { playerId: 1, stats, artifacts, location: '0,0', action: 'Move' };
}

function turn(turnNumber, action, beforeStats, afterStats, extra = {}) {
  const before = {
    players: [player(beforeStats, extra.beforeArtifacts || [])],
    activeZones: { count: extra.beforeRevealed || 1 },
  };
  const after = {
    players: [player(afterStats, extra.afterArtifacts || [])],
    activeZones: { count: extra.afterRevealed || extra.beforeRevealed || 1 },
  };
  return {
    turn: turnNumber,
    before,
    after,
    submissions: [{ playerId: 1, action, validityLog: extra.invalid ? [{ action, ok: false, reason: 'blocked' }] : [{ action, ok: true }] }],
    analysis: {
      statDelta: Object.values(afterStats).reduce((sum, value) => sum + value, 0) - Object.values(beforeStats).reduce((sum, value) => sum + value, 0),
      revealedDelta: (after.activeZones.count || 0) - (before.activeZones.count || 0),
      artifactDelta: (extra.afterArtifacts || []).length - (extra.beforeArtifacts || []).length,
      invalidAttempts: extra.invalid ? 1 : 0,
      zeroStats: extra.zeroStats || 0,
      spike: Boolean(extra.spike),
      meaningfulChoiceDensity: extra.choiceDensity ?? 0.7,
      funDebugger: { lifeScore: extra.lifeScore ?? 70 },
    },
  };
}

function reportFixture(overrides = {}) {
  const turns = [
    turn(1, 'Move', { movement: 3, agility: 3, dexterity: 3 }, { movement: 2, agility: 3, dexterity: 3 }, { beforeRevealed: 1, afterRevealed: 2, lifeScore: 72 }),
    turn(2, 'Dig', { movement: 2, agility: 3, dexterity: 3 }, { movement: 2, agility: 2, dexterity: 3 }, { beforeRevealed: 2, afterRevealed: 2, afterArtifacts: ['Relic'], lifeScore: 85 }),
    turn(3, 'Rest', { movement: 2, agility: 2, dexterity: 3 }, { movement: 3, agility: 3, dexterity: 3 }, { beforeRevealed: 2, afterRevealed: 2, lifeScore: 63 }),
  ];
  const run = {
    config: { strategy: 'dig' },
    turns,
    summary: {
      totalArtifacts: 1,
      revealedZonesGained: 1,
      statTotalDelta: 0,
      zeroStatPlayers: 0,
      spikeTurns: [],
      invalidAttempts: 0,
      meaningfulChoiceDensity: 0.7,
      cardOutcomes: { clue: 1, relic: 1 },
      tensionCurve: [
        { turn: 1, tension: 24 },
        { turn: 2, tension: 48 },
        { turn: 3, tension: 28 },
      ],
      actions: { Move: 1, Dig: 1, Rest: 1 },
      outcome: 'escaped-or-ended-with-artifacts',
    },
    funDebugger: {
      averageLifeScore: 73,
      flatTurnRate: 0.1,
      aliveTurnRate: 0.85,
      flatStreaks: [],
      turns: [
        { turn: 1, lifeScore: 72, classification: 'alive' },
        { turn: 2, lifeScore: 85, classification: 'rewarding' },
        { turn: 3, lifeScore: 63, classification: 'alive' },
      ],
    },
  };
  return {
    schemaVersion: 2,
    generatedAt: '2026-05-14T00:00:00.000Z',
    config: { scenario: 'artifact-fixture', turns: 3, strategies: ['dig', 'move'] },
    runs: [run, { ...run, config: { strategy: 'move' } }],
    turns,
    summary: run.summary,
    aggregate: {
      runs: 2,
      strategies: {
        dig: { runs: 1 },
        move: { runs: 1 },
      },
      actionTotals: { Move: 2, Dig: 2, Rest: 2 },
      averages: {
        artifacts: 1,
        revealedZones: 1,
        statDelta: 0,
        boringTurns: 0,
        spikeTurns: 0,
        meaningfulChoiceDensity: 0.7,
        invalidAttempts: 0,
        zeroStatPlayers: 0,
      },
      warnings: [],
    },
    funDebugger: {
      averageLifeScore: 73,
      flatTurnRate: 0.1,
      aliveTurnRate: 0.85,
      systemicRisks: [{ key: 'board', count: 2 }, { key: 'stats', count: 2 }],
      topExperiments: [],
    },
    scenarioVerdict: { verdict: 'answered', designQuestion: 'Does artifact hunting pay off?' },
    ...overrides,
  };
}

test('normalizes reports for Oracle evaluation', () => {
  const report = normalizeReportForOracle({ turns: [], summary: {}, config: { scenario: 'tiny' } });
  assert.equal(report.runs.length, 1);
  assert.equal(report.config.scenario, 'tiny');
});

test('scores agency and readability from aggregate metrics', () => {
  const report = normalizeReportForOracle(reportFixture());
  assert.ok(scoreAgency(report).score > 60);
  assert.ok(scoreReadability(report).score > 70);
});

test('classifies turn experience and run arc', () => {
  const artifactTurn = reportFixture().turns[1];
  assert.equal(classifyTurnExperience(artifactTurn), 'triumphant');
  assert.equal(classifyRunArc(reportFixture().runs[0]), 'earned-escape');
});

test('finds decisive turns', () => {
  const decisive = findDecisiveTurns(normalizeReportForOracle(reportFixture()));
  assert.ok(decisive.some((item) => item.type === 'first-artifact'));
  assert.ok(decisive.some((item) => item.type === 'first-discovery'));
});

test('evaluates Oracle verdict and recommendation', () => {
  const scenario = normalizeScenario({
    id: 'artifact-fixture',
    name: 'Artifact Fixture',
    designQuestion: 'Does artifact hunting pay off?',
    tags: ['artifact'],
    players: 1,
    strategies: ['dig', 'move'],
  });
  const oracle = evaluateOracle(reportFixture(), scenario);
  assert.ok(['strong-pass', 'pass', 'mixed'].includes(oracle.oracleVerdict));
  assert.ok(oracle.weightedScore > 50);
  assert.ok(oracle.smallestNextExperiment.title);
  assert.ok(markdownForOracle(oracle).includes('Gameplay Oracle Report'));
  assert.ok(oracleTaskFromRecommendation(oracle.smallestNextExperiment).source === 'oracle');
});

test('regression gate catches low scores', () => {
  const scenario = normalizeScenario({
    id: 'bad',
    name: 'Bad',
    designQuestion: 'Does it work?',
    players: 1,
    strategies: ['idle'],
  });
  const oracle = evaluateOracle(reportFixture({
    aggregate: { actionTotals: { Idle: 10 }, averages: { meaningfulChoiceDensity: 0.05, invalidAttempts: 8, zeroStatPlayers: 2 }, warnings: ['bad'] },
    funDebugger: { averageLifeScore: 10, flatTurnRate: 0.9, aliveTurnRate: 0 },
    runs: [],
  }), scenario);
  const gate = evaluateRegressionGate(oracle, null, { minimumWeightedScore: 90 });
  assert.equal(gate.passed, false);
});

test('summarizes packs', () => {
  const scenario = normalizeScenario({
    id: 'artifact-fixture',
    name: 'Artifact Fixture',
    designQuestion: 'Does artifact hunting pay off?',
    tags: ['artifact'],
    players: 1,
    strategies: ['dig'],
  });
  const summary = summarizeOraclePack([evaluateOracle(reportFixture(), scenario)], 'artifacts');
  assert.equal(summary.packId, 'artifacts');
  assert.equal(summary.oracleCount, 1);
  assert.ok(summary.projectLevelRecommendation);
});
