import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import {
  actionDigest,
  actionTypedData,
  normalizeSignedAction,
  parseRelayConfig,
  recoverActionSigner,
  RelayError,
} from './sponsor-relay-core.mjs';
import { SponsorBudgetLedger } from './sponsor-relay-ledger.mjs';

const relayerPk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const signerPk = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const player = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const board = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const forwarder = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const controller = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc';

function config(overrides = {}) {
  return parseRelayConfig({
    SPONSOR_RELAY_CHAIN_ID: '31337',
    SPONSOR_RELAY_RPC_URL: 'http://127.0.0.1:8545',
    SPONSOR_RELAY_ALLOW_LOCAL_HTTP: 'true',
    SPONSOR_RELAY_FORWARDER_ADDRESS: forwarder,
    SPONSOR_RELAY_CONTROLLER_ADDRESS: controller,
    SPONSOR_RELAY_BOARD_ADDRESS: board,
    GAME_AUTHORITY_REGISTRY_ADDRESS: player,
    GAME_AUTHORITY_READ_ADDRESSES: [forwarder, controller, board, player].join(','),
    SPONSOR_RELAYER_PRIVATE_KEY: relayerPk,
    SPONSOR_RELAY_ADMIN_TOKEN: 'test-admin-token-that-is-at-least-32-characters',
    GAME_AUTHORITY_SECRET: 'test-game-authority-secret-that-is-at-least-32-characters',
    SPONSOR_RELAY_ALLOWED_ORIGINS: 'http://127.0.0.1:3000',
    ...overrides,
  });
}

async function signedAction(relayConfig, overrides = {}) {
  const account = privateKeyToAccount(signerPk);
  const base = normalizeSignedAction({
    player,
    playerID: '7',
    actionIndex: 1,
    options: ['2,3'],
    leftHand: '',
    rightHand: '',
    gameID: '42',
    boardAddress: board,
    nonce: '0',
    deadline: String(Math.floor(Date.now() / 1000) + 300),
    signature: `0x${'00'.repeat(65)}`,
    ...overrides,
  }, relayConfig);
  return { ...base, signature: await account.signTypedData(actionTypedData(base, relayConfig)) };
}

test('relay config requires HTTPS except for explicitly allowed loopback RPC', () => {
  assert.equal(config().chainId, 31337);
  assert.equal(config().maxPriorityFeePerGasWei, 50_000_000n);
  assert.equal(config().authorityMaxBatchSize, 8);
  assert.throws(() => config({ SPONSOR_RELAY_ALLOW_LOCAL_HTTP: 'false' }), /must use HTTPS/);
  assert.throws(() => config({ GAME_AUTHORITY_MAX_BATCH_SIZE: '9' }), /cannot exceed 8/);
  assert.throws(() => config({ SPONSOR_RELAY_ADMIN_TOKEN: 'short' }), /at least 32/);
  assert.throws(() => config({ SPONSOR_RELAY_ALLOWED_ORIGINS: 'http://attacker.example' }), /exact HTTPS origins/);
  assert.throws(() => config({ SPONSOR_RELAY_ALLOWED_ORIGINS: 'https://play.example/path' }), /exact HTTPS origins/);
});

test('signed action digest recovers the scoped session signer', async () => {
  const relayConfig = config();
  const action = await signedAction(relayConfig);
  assert.match(actionDigest(action, relayConfig), /^0x[0-9a-f]{64}$/);
  assert.equal(await recoverActionSigner(action, relayConfig), privateKeyToAccount(signerPk).address);
});

test('action validation rejects wrong boards, expired signatures, and invalid action indices', async () => {
  const relayConfig = config();
  assert.throws(() => normalizeSignedAction({ boardAddress: player }, relayConfig), RelayError);
  await assert.rejects(() => signedAction(relayConfig, { deadline: '1' }), /expired/);
  await assert.rejects(() => signedAction(relayConfig, { actionIndex: 8 }), /outside/);
});

test('durable budget ledger deduplicates requests and enforces signer limits', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'xenovoya-relay-'));
  try {
    const relayConfig = config({ SPONSOR_RELAY_PER_SIGNER_HOURLY_ACTIONS: '1' });
    const file = path.join(temp, 'state.json');
    const ledger = await new SponsorBudgetLedger(file, relayConfig).init();
    const first = await ledger.reserve({ digest: '0x01', player, signer: privateKeyToAccount(signerPk).address, gas: 100n, costWei: 1000n });
    assert.equal(first.duplicate, false);
    assert.equal((await ledger.reserve({ digest: '0x01', player, signer: privateKeyToAccount(signerPk).address, gas: 100n, costWei: 1000n })).duplicate, true);
    await assert.rejects(
      () => ledger.reserve({ digest: '0x02', player, signer: privateKeyToAccount(signerPk).address, gas: 100n, costWei: 1000n }),
      (error) => error.code === 'signer_hourly_limit',
    );
    assert.equal(JSON.parse(await readFile(file, 'utf8')).requests['0x01'].status, 'reserved');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('budget ledger reconciles reservations to actual receipt cost across a batch', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'xenovoya-relay-reconcile-'));
  try {
    const relayConfig = config();
    const file = path.join(temp, 'state.json');
    const ledger = await new SponsorBudgetLedger(file, relayConfig).init();
    const secondPlayer = privateKeyToAccount(signerPk).address;
    await ledger.reserve({
      digest: '0xbatch', player, signer: player, gas: 200n, costWei: 2_000n, actionCount: 2,
      participants: [
        { player, signer: player, actionCount: 1 },
        { player: secondPlayer, signer: secondPlayer, actionCount: 1 },
      ],
    });
    const hash = `0x${'44'.repeat(32)}`;
    await ledger.markSubmitted('0xbatch', hash);
    await ledger.markReceipt(hash, { status: 'success', blockNumber: 10n, gasUsed: 100n, effectiveGasPrice: 5n });
    const snapshot = ledger.snapshot();
    const day = snapshot.days[Object.keys(snapshot.days)[0]];
    assert.equal(day.gas, '100');
    assert.equal(day.costWei, '500');
    assert.equal(day.players[player].costWei, '250');
    assert.equal(day.players[secondPlayer].costWei, '250');
    assert.equal(snapshot.requests['0xbatch'].actualCostWei, '500');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
