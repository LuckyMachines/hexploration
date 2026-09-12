import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import { SponsorBudgetLedger } from './sponsor-relay-ledger.mjs';
import { actionTypedData, normalizeSignedAction, parseRelayConfig } from './sponsor-relay-core.mjs';
import { SponsorRelayService } from './sponsor-relay-service.mjs';
import { createSponsorRelayHttpServer } from './sponsor-relay-server.mjs';

const relayerPk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const signerPk = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const player = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const board = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const forwarder = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const controller = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc';
const role = `0x${'12'.repeat(32)}`;
const hash = `0x${'34'.repeat(32)}`;

function config(stateFile) {
  return parseRelayConfig({
    SPONSOR_RELAY_CHAIN_ID: '31337',
    SPONSOR_RELAY_RPC_URL: 'http://127.0.0.1:8545',
    SPONSOR_RELAY_ALLOW_LOCAL_HTTP: 'true',
    SPONSOR_RELAY_FORWARDER_ADDRESS: forwarder,
    SPONSOR_RELAY_CONTROLLER_ADDRESS: controller,
    SPONSOR_RELAY_BOARD_ADDRESS: board,
    SPONSOR_RELAYER_PRIVATE_KEY: relayerPk,
    SPONSOR_RELAY_ADMIN_TOKEN: 'test-admin-token-that-is-at-least-32-characters',
    SPONSOR_RELAY_ALLOWED_ORIGINS: 'http://127.0.0.1:3000',
    SPONSOR_RELAY_STATE_FILE: stateFile,
    SPONSOR_RELAY_MIN_BALANCE_WEI: '1',
  });
}

async function signedAction(relayConfig, overrides = {}) {
  const signer = privateKeyToAccount(signerPk);
  const action = normalizeSignedAction({
    player, playerID: '7', actionIndex: 1, options: ['2,3'], leftHand: '', rightHand: '', gameID: '42', boardAddress: board,
    nonce: '0', deadline: String(Math.floor(Date.now() / 1000) + 300), signature: `0x${'00'.repeat(65)}`,
    ...overrides,
  }, relayConfig);
  return { ...action, signature: await signer.signTypedData(actionTypedData(action, relayConfig)) };
}

function mockClients(relayConfig) {
  const account = privateKeyToAccount(relayerPk);
  const publicClient = {
    getChainId: async () => 31337,
    getBalance: async () => 10n ** 18n,
    getBytecode: async () => '0x1234',
    readContract: async ({ functionName }) => {
      if (functionName === 'CONTROLLER') return controller;
      if (functionName === 'ACTION_FORWARDER_ROLE') return role;
      if (functionName === 'hasRole' || functionName === 'isSessionKeyAuthorized') return true;
      if (functionName === 'actionNonces') return 0n;
      throw new Error(`Unexpected read ${functionName}`);
    },
    simulateContract: async (request) => ({ request }),
    estimateContractGas: async () => 100_000n,
    estimateFeesPerGas: async () => ({ maxFeePerGas: 1_000_000_000n }),
    waitForTransactionReceipt: async () => new Promise(() => {}),
  };
  const walletClient = { writeContract: async () => hash };
  return { account, publicClient, walletClient };
}

test('service preflights, budgets, submits, and deduplicates a signed action', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'xenovoya-relay-service-'));
  try {
    const relayConfig = config(path.join(temp, 'state.json'));
    const ledger = await new SponsorBudgetLedger(relayConfig.stateFile, relayConfig).init();
    const service = new SponsorRelayService({ config: relayConfig, ledger, ...mockClients(relayConfig) });
    const action = await signedAction(relayConfig);
    const submitted = await service.submit(action);
    assert.deepEqual({ hash: submitted.hash, status: submitted.status, duplicate: submitted.duplicate }, { hash, status: 'submitted', duplicate: false });
    assert.equal((await service.submit(action)).duplicate, true);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('service validates, budgets, and submits a consecutive signed batch', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'xenovoya-relay-batch-'));
  try {
    const relayConfig = config(path.join(temp, 'state.json'));
    const ledger = await new SponsorBudgetLedger(relayConfig.stateFile, relayConfig).init();
    const clients = mockClients(relayConfig);
    let submittedFunction;
    clients.walletClient.writeContract = async (request) => {
      submittedFunction = request.functionName;
      return hash;
    };
    const service = new SponsorRelayService({ config: relayConfig, ledger, ...clients });
    const actions = await Promise.all([
      signedAction(relayConfig, { nonce: '0', gameID: '42' }),
      signedAction(relayConfig, { nonce: '1', gameID: '42', actionIndex: 2 }),
    ]);
    const submitted = await service.submitBatch(actions);
    assert.equal(submitted.hash, hash);
    assert.equal(submitted.actionCount, 2);
    assert.equal(submittedFunction, 'submitActionsWithSignatures');
    assert.equal(Object.values(ledger.snapshot().requests)[0].actionCount, 2);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('readiness fails closed when the dedicated relay wallet is underfunded', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'xenovoya-relay-balance-'));
  try {
    const relayConfig = config(path.join(temp, 'state.json'));
    const ledger = await new SponsorBudgetLedger(relayConfig.stateFile, relayConfig).init();
    const clients = mockClients(relayConfig);
    clients.publicClient.getBalance = async () => 0n;
    const service = new SponsorRelayService({ config: relayConfig, ledger, ...clients });
    const readiness = await service.checkReadiness({ force: true });
    assert.equal(readiness.ready, false);
    assert.equal(readiness.balanceWei, '0');
    const action = await signedAction(relayConfig);
    await assert.rejects(() => service.submit(action), (error) => error.code === 'relay_not_ready');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('HTTP boundary enforces origin policy and authenticated emergency pause', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'xenovoya-relay-http-'));
  let server;
  try {
    const relayConfig = config(path.join(temp, 'state.json'));
    const ledger = await new SponsorBudgetLedger(relayConfig.stateFile, relayConfig).init();
    const service = new SponsorRelayService({ config: relayConfig, ledger, ...mockClients(relayConfig) });
    server = createSponsorRelayHttpServer({ config: relayConfig, service, ledger });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/v1/sponsor/config`, { headers: { origin: 'https://attacker.example' } })).status, 403);
    assert.equal((await fetch(`${base}/admin/pause`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401);
    const paused = await fetch(`${base}/admin/pause`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${relayConfig.adminToken}` },
      body: JSON.stringify({ reason: 'test stop' }),
    });
    assert.equal(paused.status, 200);
    assert.equal((await paused.json()).paused, true);
    assert.equal((await service.checkReadiness({ force: true })).ready, false);
    assert.equal((await fetch(`${base}/livez`)).status, 200);
    assert.equal((await fetch(`${base}/healthz`)).status, 503);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(temp, { recursive: true, force: true });
  }
});
