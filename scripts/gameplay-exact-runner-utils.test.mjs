import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExactRunPlan,
  candidatePorts,
  canonicalScenarioSignature,
  classifyExactRunFailure,
} from './gameplay-exact-runner-utils.mjs';

test('scenario signature is stable and source-sensitive', () => {
  const input = { scenario: { id: 'one', turns: 4 }, batch: 10, sourceHashes: { b: '2', a: '1' } };
  assert.equal(canonicalScenarioSignature(input), canonicalScenarioSignature(input));
  assert.notEqual(canonicalScenarioSignature(input), canonicalScenarioSignature({ ...input, batch: 11 }));
});

test('exact run plan skips only matching successful checkpoints', () => {
  const store = { scenarios: [{ id: 'one' }, { id: 'archived', archived: true }] };
  const first = buildExactRunPlan(store, { batch: 10, sourceHashes: { code: 'a' } });
  const checkpoint = { scenarios: { one: { status: 'passed', signature: first[0].signature } } };
  const resumed = buildExactRunPlan(store, { batch: 10, sourceHashes: { code: 'a' }, checkpoint });
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].cached, true);
});

test('regression-only plans exclude production scenarios', () => {
  const store = { scenarios: [
    { id: 'core', productionEligible: true },
    { id: 'boundary', productionEligible: false, testFixture: true },
  ] };
  const plan = buildExactRunPlan(store, { regressionsOnly: true });
  assert.deepEqual(plan.map((item) => item.scenario.id), ['boundary']);
});

test('failure classifier separates infrastructure from gameplay failures', () => {
  assert.equal(classifyExactRunFailure({ status: 1, stderr: 'RPC is not reachable' }).category, 'infrastructure');
  assert.equal(classifyExactRunFailure({ status: 1, stderr: 'scenario target failed' }).category, 'gameplay-or-contract');
});

test('preferred port is first when valid', () => {
  assert.deepEqual(candidatePorts(11133, 3), [11133, 11134, 11135]);
});
