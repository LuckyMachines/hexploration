import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SETUP_SUPPORT_MATRIX,
  applySetupForge,
  compareRequestedToActualSetup,
  markdownForSetupReport,
  normalizeSetupForge,
  parseSetupForgeIntent,
  setupApplicationLevel,
  setupBacklog,
  setupCoverage,
  validateSetupForge,
} from './setup-forge-utils.mjs';
import { evaluateOracle } from './gameplay-oracle-utils.mjs';
import { normalizeScenario } from './scenario-utils.mjs';

function scenario() {
  return normalizeScenario({
    id: 'escape-pressure-4p',
    name: 'Escape Pressure 4P',
    designQuestion: 'Does escape pressure create cooperation?',
    players: 4,
    strategies: ['balanced', 'rest', 'move', 'risky'],
    tags: ['multiplayer', 'cooperation', 'escape', 'survival'],
    requiredSetupLevel: 'partial',
    initialState: {
      assumptions: [
        { key: 'playerStats', description: 'two exhausted players', support: 'notYetSupported' },
        { key: 'artifactsHeld', description: 'one artifact holder', support: 'notYetSupported' },
        { key: 'landingRevealed', description: 'landing revealed', support: 'observedOnly' },
      ],
    },
  });
}

function reportWithSetup(setupApplication, setupLevel = 'partial') {
  return {
    schemaVersion: 2,
    config: { scenario: 'escape-pressure-4p', turns: 2, strategies: ['balanced', 'rest'] },
    setupForge: setupApplication.setupForge,
    setupApplication,
    setupLevel,
    runs: [{
      config: { strategy: 'balanced' },
      turns: [],
      summary: {
        totalArtifacts: 0,
        revealedZonesGained: 1,
        statTotalDelta: 0,
        zeroStatPlayers: 0,
        spikeTurns: [{ turn: 1 }],
        invalidAttempts: 0,
        meaningfulChoiceDensity: 0.6,
        cardOutcomes: { clue: 1 },
        tensionCurve: [{ turn: 1, tension: 55 }],
        actions: { Move: 1, Rest: 1, Help: 1, Flee: 1 },
      },
      funDebugger: {
        averageLifeScore: 65,
        flatTurnRate: 0.1,
        aliveTurnRate: 0.8,
        flatStreaks: [],
        turns: [{ turn: 1, lifeScore: 65, classification: 'alive' }],
      },
    }],
    aggregate: {
      runs: 1,
      strategies: { balanced: { runs: 1 } },
      actionTotals: { Move: 1, Rest: 1, Help: 1, Flee: 1 },
      averages: {
        artifacts: 0,
        revealedZones: 1,
        statDelta: 0,
        boringTurns: 0,
        spikeTurns: 1,
        meaningfulChoiceDensity: 0.6,
        invalidAttempts: 0,
        zeroStatPlayers: 0,
      },
      warnings: [],
    },
    funDebugger: {
      averageLifeScore: 65,
      flatTurnRate: 0.1,
      aliveTurnRate: 0.8,
      systemicRisks: [{ key: 'stats', count: 1 }],
    },
  };
}

test('normalizes setup forge fields', () => {
  const setup = normalizeSetupForge({
    players: [{ playerIndex: 0, stats: { movement: 9, agility: 1, dexterity: 1 }, artifacts: ['Engraved Tablet'] }],
    board: { revealedZones: ['1, 0'], terrain: { '1, 0': 'Mountain' }, landingZone: '0,0' },
    time: { day: 3, phase: 'Day' },
  }, scenario());
  assert.equal(setup.players[0].stats.movement, 4);
  assert.equal(setup.board.revealedZones[0], '1,0');
  assert.equal(setup.requiredSetupLevel, 'partial');
  assert.ok(setup.setupId.startsWith('escape-pressure-4p-'));
});

test('validates exact landing setup through revealed zone support', () => {
  const setup = normalizeSetupForge({ board: { landingZone: '0,0' } }, scenario());
  const result = validateSetupForge(setup, scenario(), 'strict');
  assert.equal(result.ok, true);
  assert.equal(result.support.find((field) => field.key === 'landingZone').exact, true);
});

test('parses setup intent from plain English', () => {
  const setup = parseSetupForgeIntent('4-player escape pressure with two exhausted players and one artifact on day 3 near campsite', scenario());
  assert.equal(setup.players.length >= 2, true);
  assert.equal(setup.players[0].stats.movement, 1);
  assert.ok(setup.players.some((player) => player.artifacts.includes('Engraved Tablet')));
  assert.equal(setup.time.day, 3);
  assert.equal(setup.board.campsites[0], '1,0');
});

test('dry-run application skips without touching chain', async () => {
  const setup = normalizeSetupForge({ players: [{ playerIndex: 0, stats: { movement: 1, agility: 1, dexterity: 1 }, critical: true }] }, scenario());
  const application = await applySetupForge({}, { scenario: scenario(), gameId: 1, addresses: {}, deployerWallet: {}, deployerAddress: '0x0' }, setup, { dryRun: true });
  assert.equal(application.dryRun, true);
  assert.equal(application.applied.length, 0);
  assert.equal(application.skipped.length > 0, true);
  assert.equal(setupApplicationLevel(application), 'metadata');
});

test('compares requested setup to actual snapshot', () => {
  const setup = normalizeSetupForge({ players: [{ playerIndex: 0, stats: { movement: 1, agility: 1, dexterity: 1 }, location: '1,0', artifacts: ['Engraved Tablet'] }] }, scenario());
  const diff = compareRequestedToActualSetup(setup, {
    players: [{ playerId: 1, stats: { movement: 1, agility: 1, dexterity: 1 }, location: '1,0', inventory: { artifact: 'Engraved Tablet' }, artifacts: [] }],
    activeZones: { zones: ['1,0'] },
  });
  assert.ok(diff.every((entry) => entry.pass !== false));
});

test('setup level reflects actual critical verification failures', () => {
  const setup = normalizeSetupForge({ players: [{ playerIndex: 0, stats: { movement: 1, agility: 1, dexterity: 1 }, critical: true }] }, scenario());
  const validation = validateSetupForge(setup, scenario(), 'best-effort');
  const application = {
    support: validation.support,
    applied: [{ field: 'playerStats', label: 'P1 stats', status: 'applied' }],
    skipped: [],
    failed: [],
    errors: [],
    actualDiff: [{ field: 'playerStats', playerId: 1, pass: false }],
  };
  assert.equal(setupApplicationLevel(application), 'blocked');
});

test('computes setup coverage and backlog', () => {
  const setup = normalizeSetupForge({ players: [{ playerIndex: 0, stats: { movement: 1, agility: 1, dexterity: 1 } }], board: { landingZone: '0,0' } }, scenario());
  const coverage = setupCoverage(scenario(), setup);
  assert.ok(coverage.fieldCount >= 2);
  const backlog = setupBacklog([{ importance: 'core', blockedFields: ['landingZone'] }]);
  assert.equal(backlog[0].field, 'landingZone');
});

test('Oracle reacts to blocked critical setup', () => {
  const setup = normalizeSetupForge({ board: { landingZone: '0,0' } }, scenario());
  const validation = validateSetupForge(setup, scenario(), 'best-effort');
  const application = {
    setupForge: setup,
    mode: 'best-effort',
    requiredSetupLevel: 'partial',
    support: validation.support,
    applied: [],
    skipped: [],
    failed: [{ field: 'landingZone', status: 'failed', error: 'zone not active' }],
    warnings: validation.warnings,
    errors: [],
    setupLevel: 'metadata',
  };
  const oracle = evaluateOracle(reportWithSetup(application, 'metadata'), scenario());
  assert.equal(oracle.smallestNextExperiment.changeType, 'scenario-setup-support');
  assert.ok(oracle.confidence < 0.8);
});

test('generates Markdown setup report', () => {
  const markdown = markdownForSetupReport({
    generatedAt: 'now',
    scenarioId: 'scenario',
    setupLevel: 'metadata',
    setupApplication: { mode: 'metadata-only', applied: [], skipped: [{ field: 'playerStats', status: 'skipped', reason: 'metadata' }], failed: [], warnings: [] },
  });
  assert.ok(markdown.includes('Scenario Setup Forge Report'));
  assert.ok(SETUP_SUPPORT_MATRIX.playerStats);
});
