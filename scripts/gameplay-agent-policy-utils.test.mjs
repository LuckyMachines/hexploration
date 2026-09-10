import test from 'node:test';
import assert from 'node:assert/strict';
import { shortestBoardPath, shortestRevealedPath, terminalIntentPlan } from './gameplay-agent-policy-utils.mjs';

const graph = {
  A: ['B'],
  B: ['A', 'C'],
  C: ['B'],
};
const adjacentFor = (alias) => graph[alias] || [];

test('finds a deterministic route through revealed zones', () => {
  assert.deepEqual(shortestRevealedPath('C', 'A', ['A', 'B', 'C'], adjacentFor), ['C', 'B', 'A']);
});

test('does not distort ordinary play before the evidence window', () => {
  assert.equal(terminalIntentPlan({ turn: 2, totalTurns: 10, requireTerminalOutcome: true, player: { location: 'C' }, snapshot: { activeZones: { zones: ['A', 'B', 'C'], tiles: [5, 1, 1] } }, adjacentFor }), null);
});

test('finds a bounded board route when the revealed route is disconnected', () => {
  const adjacent = (alias) => ({ '2,0': ['1,0', '3,0'], '1,0': ['2,0', '0,0'], '0,0': ['1,0'] })[alias] || [];
  assert.deepEqual(shortestBoardPath('2,0', '0,0', adjacent, { min: 0, max: 2 }), ['2,0', '1,0', '0,0']);
});

test('routes to landing and then attempts a terminal flee', () => {
  const snapshot = { activeZones: { zones: ['A', 'B', 'C'], tiles: [5, 1, 1] } };
  assert.deepEqual(terminalIntentPlan({ turn: 7, totalTurns: 10, requireTerminalOutcome: true, player: { location: 'C' }, snapshot, adjacentFor }), { action: 1, options: ['B'], reason: 'terminal-evidence route toward landing' });
  assert.deepEqual(terminalIntentPlan({ turn: 8, totalTurns: 10, requireTerminalOutcome: true, player: { location: 'A' }, snapshot, adjacentFor }), { action: 7, options: [], reason: 'terminal-evidence evacuation from landing' });
});

test('uses the available movement budget and ignores inactive players', () => {
  const snapshot = { activeZones: { zones: ['A', 'B', 'C'], tiles: [5, 1, 1] } };
  assert.deepEqual(
    terminalIntentPlan({ turn: 7, totalTurns: 10, requireTerminalOutcome: true, player: { location: 'C', active: true, stats: { movement: 2 } }, snapshot, adjacentFor }),
    { action: 1, options: ['B', 'A'], reason: 'terminal-evidence route toward landing' },
  );
  assert.equal(terminalIntentPlan({ turn: 7, totalTurns: 10, requireTerminalOutcome: true, player: { location: 'A', active: false }, snapshot, adjacentFor }), null);
});
