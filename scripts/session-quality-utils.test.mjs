import assert from 'node:assert/strict';
import test from 'node:test';
import contract from '../session.quality-contract.json' with { type: 'json' };
import { gradeSessionChecks, validateSessionContract } from './session-quality-utils.mjs';

test('session quality contract covers every recovery and social scenario', () => {
  assert.deepEqual(validateSessionContract(contract), []);
});

test('session grades fail honestly when any required gate fails', () => {
  assert.equal(gradeSessionChecks([{ ok: true }, { ok: false }]).grade, 'D');
  assert.equal(gradeSessionChecks([{ ok: true }, { ok: true }]).grade, 'A');
});
