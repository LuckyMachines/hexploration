import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import {
  compileScenarioArgs,
  evaluateScenarioReport,
  loadScenarioStore,
  normalizeScenario,
  parseScenarioIntent,
  upsertScenario,
  validateScenario,
  validateStore,
  writeJson,
  readJson,
} from './scenario-utils.mjs';

test('parses 4-player escape pressure with exhausted players', () => {
  const scenario = parseScenarioIntent('4-player escape pressure with two exhausted players and one artifact');
  assert.equal(scenario.players, 4);
  assert.ok(scenario.tags.includes('escape'));
  assert.ok(scenario.tags.includes('survival'));
  assert.ok(scenario.tags.includes('artifact'));
  assert.ok(scenario.initialState.assumptions.some((assumption) => assumption.key === 'playerStats'));
  assert.ok(scenario.strategies.includes('risky'));
});

test('parses solo artifact hunt', () => {
  const scenario = parseScenarioIntent('solo artifact hunt with high stat pressure');
  assert.equal(scenario.players, 1);
  assert.ok(scenario.tags.includes('artifact'));
  assert.ok(scenario.targets.some((target) => target.metric === 'artifacts'));
});

test('validates missing and invalid scenario fields', () => {
  const scenario = normalizeScenario({
    id: 'bad',
    name: 'Bad',
    designQuestion: '',
    players: 9,
    strategies: ['unknown'],
  });
  const result = validateScenario({ ...scenario, players: 9, strategies: ['unknown'], designQuestion: '' }, []);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('players')));
  assert.ok(result.errors.some((error) => error.includes('unknown strategy')));
});

test('compiles scenario into simulator args', () => {
  const scenario = parseScenarioIntent('solo exploration smoke');
  const args = compileScenarioArgs(scenario, { quiet: true });
  assert.ok(args.includes(`--scenario-id=${scenario.id}`));
  assert.ok(args.includes(`--players=${scenario.players}`));
  assert.ok(args.includes('--quiet'));
  assert.ok(args.some((entry) => entry.startsWith('--strategies=')));
});

test('evaluates scenario verdicts', () => {
  const scenario = normalizeScenario({
    id: 'verdict',
    name: 'Verdict',
    designQuestion: 'Does it pass?',
    players: 1,
    strategies: ['balanced'],
    targets: [{ metric: 'lifeScore', op: '>=', value: 30, label: 'Life' }],
    failureSignals: [{ metric: 'flatTurnRate', op: '>', value: 0.5, label: 'Too flat' }],
  });
  const report = {
    funDebugger: { averageLifeScore: 35, flatTurnRate: 0.1, aliveTurnRate: 0.8 },
    aggregate: { actionTotals: {}, averages: {} },
    runs: [],
  };
  const verdict = evaluateScenarioReport(report, scenario);
  assert.equal(verdict.verdict, 'answered');
  assert.equal(verdict.targets[0].value, 30);
  assert.equal(verdict.targets[0].actual, 35);
});

test('writes and reloads scenario store data', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'scenario-store-'));
  try {
    const path = resolve(dir, 'simulator.scenarios.json');
    let store = { schemaVersion: 1, scenarios: [], packs: [] };
    const scenario = parseScenarioIntent('cooperation with one weak player', { id: 'coop-weak' });
    store = upsertScenario(store, scenario);
    writeJson(path, store);
    const loaded = loadScenarioStore(path);
    assert.equal(loaded.scenarios.length, 1);
    assert.equal(validateStore(loaded).ok, true);
    assert.equal(readJson(path).scenarios[0].id, 'coop-weak');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
