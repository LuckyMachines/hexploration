import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCalibration, evaluateCoverage, evaluateEffectiveness, findExactSourceDrift, productionScenarios } from './gameplay-improvement-utils.mjs';

test('coverage ignores generated and archived scenarios', () => {
  const store = { scenarios: [
    { id: 'solo', players: 1, loopCoverage: ['explore'], archived: false },
    { id: 'autopilot-test-noise', players: 4, loopCoverage: ['noise'], archived: false },
    { id: 'old', players: 2, loopCoverage: ['old'], archived: true },
  ] };
  assert.deepEqual(productionScenarios(store).map((item) => item.id), ['solo']);
  const coverage = evaluateCoverage(store, { requiredPlayerCounts: [1, 2], requiredLoops: ['explore', 'recover'] });
  assert.deepEqual(coverage.missingPlayerCounts, [2]);
  assert.deepEqual(coverage.missingLoops, ['recover']);
});

test('human calibration remains pending until observed evidence is sufficient', () => {
  const calibration = evaluateCalibration({ sessions: [{ recommendationAgreement: 'agree' }] }, { humanCalibration: { minimumObservedSessions: 5 } });
  assert.equal(calibration.calibrated, false);
  assert.equal(calibration.sessions, 1);
});

test('counts an honest inconclusive closure as resolved without accepting it', () => {
  const result = evaluateEffectiveness({ experiments: { experiments: [{ status: 'inconclusive', decision: 'inconclusive' }] } });
  assert.equal(result.resolvedExperiments, 1);
  assert.equal(result.experimentResolutionRate, 1);
  assert.equal(result.recommendationAcceptanceRate, 0);
});

test('detects exact-engine evidence produced from stale source', () => {
  const report = { sourceHashes: { 'contracts/A.sol': 'current', 'contracts/B.sol': 'old' } };
  const currentHashes = { 'contracts/A.sol': 'current', 'contracts/B.sol': 'current' };
  assert.deepEqual(findExactSourceDrift(report, (path) => currentHashes[path]), ['contracts/B.sol']);
});
