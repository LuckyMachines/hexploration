import assert from 'node:assert/strict';
import test from 'node:test';
import { authorityAccount, issueAuthoritySession, openOperation, sealOperation, verifyAuthoritySession } from './game-authority.mjs';

const config = { authoritySecret: 'test-game-authority-secret-32-characters-long', authoritySessionSeconds: 3600 };

test('authority sessions are opaque, expiring, and deterministically map to a player identity', () => {
  const issued = issueAuthoritySession(config, 1000);
  assert.doesNotMatch(issued.token, /^0x/);
  const session = verifyAuthoritySession(issued.token, config, 1001);
  assert.equal(authorityAccount(session, config).address, authorityAccount(session, config).address);
  assert.throws(() => verifyAuthoritySession(`${issued.token}x`, config, 1001), /invalid/);
  assert.throws(() => verifyAuthoritySession(issued.token, config, 5000), /expired/);
});

test('operation references conceal and authenticate internal transaction hashes', () => {
  const hash = `0x${'ab'.repeat(32)}`;
  const operation = sealOperation(hash, config);
  assert.doesNotMatch(operation, /ababab/);
  assert.equal(openOperation(operation, config), hash);
  assert.throws(() => openOperation(`${operation}x`, config), /invalid/);
});
