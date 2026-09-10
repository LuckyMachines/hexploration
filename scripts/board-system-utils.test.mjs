import test from 'node:test';
import assert from 'node:assert/strict';
import contract from '../app/src/board-system/board-system.json' with { type: 'json' };
import {
  boardFindingAttribution,
  buildBoardReport,
  compareBoardMetrics,
  evaluateBoardMetrics,
  exactReportToBoardReplay,
  validateBoardSystem,
} from './board-system-utils.mjs';

test('the board contract covers states, mechanics, stability, and performance', () => {
  assert.deepEqual(validateBoardSystem(contract), { ok: true, errors: [] });
});

test('exact engine turns become deterministic board replay frames', () => {
  const report = {
    exactEngine: true,
    generatedAt: '2026-09-09T00:00:00.000Z',
    runs: [{
      summary: { terminal: true, traceHash: 'trace-1', outcome: 'escaped' },
      turns: [{
        turn: 1,
        before: { players: [{ playerId: '1', location: '0,0' }] },
        after: {
          gameOver: true,
          activeZones: { zones: ['0,0'], tiles: [5], campsites: [false] },
          players: [{ playerId: '1', location: '0,0', action: 'Flee', stats: { movement: 2, agility: 2, dexterity: 2 }, inventory: {} }],
        },
      }],
    }],
  };
  const replay = exactReportToBoardReplay(report, { id: 'escape', name: 'Escape' });
  assert.equal(replay.frames.length, 1);
  assert.equal(replay.frames[0].viewModel.source.kind, 'exact-engine');
  assert.equal(replay.frames[0].viewModel.phase, 'complete');
});

test('metric comparison and attribution identify rendering regressions', () => {
  const comparison = compareBoardMetrics(
    { scenes: [{ id: 'ready', drawCalls: 50, frameP95Ms: 16, renderP95Ms: 4 }] },
    { scenes: [{ id: 'ready', drawCalls: 55, frameP95Ms: 20, renderP95Ms: 6 }] },
  );
  assert.equal(comparison.regressions.length, 1);
  assert.match(boardFindingAttribution({ id: 'draw-calls' }), /ThreeBoard/);
});

test('metric evaluation rejects remount heap growth beyond the contract', () => {
  const evaluation = evaluateBoardMetrics({
    remountHeapGrowthMiB: contract.performance.maxRemountHeapGrowthMiB + 0.1,
    scenes: [{ id: 'ready', canvasCount: 1, drawCalls: 20, triangles: 1000, frameP95Ms: 16, renderP95Ms: 4, assetExpected: 1, assetLoaded: 1, assetFailures: 0 }],
  }, contract);
  assert.equal(evaluation.ok, false);
  const heapFailure = evaluation.failures.find((failure) => failure.id === 'remount-heap-growth');
  assert.ok(heapFailure);
  assert.match(heapFailure.module, /ThreeBoard/);
});

test('the board report derives its grade from current evidence', () => {
  const states = contract.requiredEvidence.states.flatMap((state) => contract.requiredEvidence.viewports.map((viewport) => ({ state, viewport: viewport.id, id: `${state}-${viewport.id}`, canvasCount: 1, drawCalls: 20, triangles: 1000, frameP95Ms: 16, renderP95Ms: 4, assetExpected: 1, assetLoaded: 1, assetFailures: 0 })));
  const report = buildBoardReport({
    contract,
    replays: [{ exactEngine: true, frames: [{}] }],
    metrics: { sourceHash: 'current', remountHeapGrowthMiB: 0, scenes: states },
    gameplay: { blockers: [] },
    browserCompatibility: { passed: true, sourceHash: 'current', projects: ['firefox-desktop', 'webkit-desktop'] },
    currentSourceHash: 'current',
  });
  assert.equal(report.grade, 'A');
  assert.equal(report.status, 'pass');
});
