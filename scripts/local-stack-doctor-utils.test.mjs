import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addressesFromBroadcastJson,
  buildHealthReport,
  bytecodeStatus,
  isAddress,
  markdownForLocalStackHealth,
  normalizeAddressMap,
  parseEnvText,
  scoreChecks,
} from './local-stack-doctor-utils.mjs';

test('parseEnvText handles comments, exports, blank lines, and quotes', () => {
  const parsed = parseEnvText(`
# local stack
export VITE_BOARD_ADDRESS=0x1111111111111111111111111111111111111111
VITE_RPC_URL="http://127.0.0.1:9955"
EMPTY=
IGNORED
`);

  assert.equal(parsed.VITE_BOARD_ADDRESS, '0x1111111111111111111111111111111111111111');
  assert.equal(parsed.VITE_RPC_URL, 'http://127.0.0.1:9955');
  assert.equal(parsed.EMPTY, '');
  assert.equal(parsed.IGNORED, undefined);
});

test('isAddress validates Ethereum address shape', () => {
  assert.equal(isAddress('0x1111111111111111111111111111111111111111'), true);
  assert.equal(isAddress('0x111111111111111111111111111111111111111'), false);
  assert.equal(isAddress('not-address'), false);
});

test('normalizeAddressMap removes empty values but preserves address strings', () => {
  assert.deepEqual(normalizeAddressMap({
    A: '0x1111111111111111111111111111111111111111',
    B: '',
    C: null,
    D: undefined,
    E: 7,
  }), {
    A: '0x1111111111111111111111111111111111111111',
    E: '7',
  });
});

test('bytecodeStatus reports bytecode presence and size', () => {
  assert.deepEqual(bytecodeStatus('0x'), { hasBytecode: false, sizeBytes: 0 });
  assert.deepEqual(bytecodeStatus(null), { hasBytecode: false, sizeBytes: 0 });
  assert.deepEqual(bytecodeStatus('0x60016002'), { hasBytecode: true, sizeBytes: 4 });
});

test('scoreChecks treats failures as not ready and warnings as non-blocking', () => {
  assert.deepEqual(scoreChecks([
    { status: 'pass' },
    { status: 'warn' },
    { status: 'fail' },
  ]), {
    ok: false,
    passed: 1,
    failed: 1,
    warnings: 1,
    total: 3,
  });

  assert.equal(scoreChecks([{ status: 'pass' }, { status: 'warn' }]).ok, true);
});

test('addressesFromBroadcastJson maps deployed contracts into app env keys', () => {
  const broadcast = {
    transactions: [
      { contractName: 'XenovoyaBoard', contractAddress: '0x1111111111111111111111111111111111111111' },
      { contractName: 'XenovoyaController', contractAddress: '0x2222222222222222222222222222222222222222' },
      { contractName: 'GameSummary', contractAddress: '0x3333333333333333333333333333333333333333' },
      { contractName: 'PlayerSummary', contractAddress: '0x4444444444444444444444444444444444444444' },
      { contractName: 'GameEvents', contractAddress: '0x5555555555555555555555555555555555555555' },
      { contractName: 'GameRegistry', contractAddress: '0x6666666666666666666666666666666666666666' },
      { contractName: 'XenovoyaQueue', contractAddress: '0x7777777777777777777777777777777777777777' },
      { contractName: 'GameSetup', contractAddress: '0x8888888888888888888888888888888888888888' },
      { contractName: 'PlayerRegistry', contractAddress: '0x9999999999999999999999999999999999999999' },
      { contractName: 'CharacterCard', contractAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      { contractName: 'TokenInventory', contractAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
    ],
  };

  const mapped = addressesFromBroadcastJson(broadcast);
  assert.equal(mapped.appAddrs.VITE_BOARD_ADDRESS, '0x1111111111111111111111111111111111111111');
  assert.equal(mapped.appAddrs.VITE_TOKEN_INVENTORY_ADDRESS, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.equal(mapped.byName.XenovoyaController, '0x2222222222222222222222222222222222222222');
});

test('buildHealthReport serializes bigint evidence and computes readiness', () => {
  const report = buildHealthReport({
    rpcUrl: 'http://127.0.0.1:9955',
    checks: [{ status: 'pass', id: 'ok' }],
    evidence: { latestGameId: 3n },
  });

  assert.equal(report.ok, true);
  assert.equal(report.evidence.latestGameId, '3');
});

test('markdownForLocalStackHealth renders check and evidence summaries', () => {
  const markdown = markdownForLocalStackHealth({
    ok: true,
    generatedAt: '2026-05-18T00:00:00.000Z',
    runtime: { rpcUrl: 'http://127.0.0.1:9955', mode: 'solo', players: 1 },
    score: { passed: 1, failed: 0, warnings: 0 },
    evidence: { latestGameId: '1', openGameCount: 1 },
    checks: [{ status: 'pass', id: 'rpc.chainId', label: 'RPC chain ID', message: 'Chain ID is 31337.' }],
    bootSteps: [{ status: 'pass', id: 'rpc', label: 'Wait for RPC', durationMs: 12 }],
  });

  assert.match(markdown, /Local Stack Health: ready/);
  assert.match(markdown, /PASS RPC chain ID/);
  assert.match(markdown, /Latest game ID: 1/);
  assert.match(markdown, /pass Wait for RPC/);
});

