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
import { openOperation } from './game-authority.mjs';

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
    GAME_AUTHORITY_REGISTRY_ADDRESS: player,
    GAME_AUTHORITY_READ_ADDRESSES: [forwarder, controller, board, player].join(','),
    SPONSOR_RELAYER_PRIVATE_KEY: relayerPk,
    SPONSOR_RELAY_ADMIN_TOKEN: 'test-admin-token-that-is-at-least-32-characters',
    GAME_AUTHORITY_SECRET: 'test-game-authority-secret-that-is-at-least-32-characters',
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
      if (functionName === 'registrationNonces') return 0n;
      throw new Error(`Unexpected read ${functionName}`);
    },
    simulateContract: async (request) => ({ request }),
    estimateContractGas: async () => 100_000n,
    getBlock: async () => ({ baseFeePerGas: 1_000_000_000n }),
    estimateFeesPerGas: async () => ({ maxFeePerGas: 2_100_000_000n, maxPriorityFeePerGas: 100_000_000n }),
    waitForTransactionReceipt: async () => new Promise(() => {}),
    request: async ({ method }) => method === 'eth_chainId' ? '0x7a69' : '0x1',
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

test('authority signs and submits a player action without exposing chain receipt data', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'xenovoya-authority-action-'));
  try {
    const relayConfig = config(path.join(temp, 'state.json'));
    const ledger = await new SponsorBudgetLedger(relayConfig.stateFile, relayConfig).init();
    const service = new SponsorRelayService({ config: relayConfig, ledger, ...mockClients(relayConfig) });
    const result = await service.submitAuthorityAction({ sid: 'ab'.repeat(24) }, {
      playerID: '7', actionIndex: 1, options: ['2,3'], leftHand: '', rightHand: '', gameID: '42',
    });
    assert.deepEqual(Object.keys(result).sort(), ['duplicate', 'operationId', 'status']);
    assert.equal(result.status, 'processing');
    assert.equal(openOperation(result.operationId, relayConfig), hash);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('authority batches compatible crew actions into one fee-controlled submission', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'xenovoya-authority-batch-'));
  try {
    const relayConfig = config(path.join(temp, 'state.json'));
    const ledger = await new SponsorBudgetLedger(relayConfig.stateFile, relayConfig).init();
    const clients = mockClients(relayConfig);
    let submitted;
    clients.walletClient.writeContract = async (request) => { submitted = request; return hash; };
    const service = new SponsorRelayService({ config: relayConfig, ledger, ...clients });
    const command = { playerID: '7', actionIndex: 1, options: ['2,3'], leftHand: '', rightHand: '', gameID: '42' };
    const [first, second] = await Promise.all([
      service.submitAuthorityAction({ sid: '11'.repeat(24) }, command),
      service.submitAuthorityAction({ sid: '22'.repeat(24) }, { ...command, playerID: '8', options: ['3,3'] }),
    ]);
    assert.equal(submitted.functionName, 'submitActionsWithSignatures');
    assert.equal(submitted.args[0].length, 2);
    assert.equal(submitted.maxPriorityFeePerGas, relayConfig.maxPriorityFeePerGasWei);
    assert.equal(submitted.gas, 110_000n);
    assert.equal(openOperation(first.operationId, relayConfig), openOperation(second.operationId, relayConfig));
    assert.equal(Object.values(ledger.snapshot().requests)[0].actionCount, 2);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('fee policy waits rather than overspending during an expensive settlement window', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'xenovoya-authority-fees-'));
  try {
    const relayConfig = config(path.join(temp, 'state.json'));
    const ledger = await new SponsorBudgetLedger(relayConfig.stateFile, relayConfig).init();
    const clients = mockClients(relayConfig);
    clients.publicClient.getBlock = async () => ({ baseFeePerGas: relayConfig.maxFeePerGasWei + 1n });
    const service = new SponsorRelayService({ config: relayConfig, ledger, ...clients });
    await assert.rejects(
      () => service.submitAuthorityAction({ sid: '33'.repeat(24) }, {
        playerID: '7', actionIndex: 1, options: ['2,3'], leftHand: '', rightHand: '', gameID: '42',
      }),
      (error) => error.code === 'action_unavailable',
    );
    assert.equal(Object.keys(ledger.snapshot().requests).length, 0);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('authority registers its derived player through the signed forwarder path', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'xenovoya-authority-register-'));
  try {
    const relayConfig = config(path.join(temp, 'state.json'));
    const ledger = await new SponsorBudgetLedger(relayConfig.stateFile, relayConfig).init();
    const clients = mockClients(relayConfig);
    let submitted;
    clients.walletClient.writeContract = async (request) => { submitted = request; return hash; };
    const service = new SponsorRelayService({ config: relayConfig, ledger, ...clients });
    const result = await service.registerAuthorityPlayer({ sid: 'cd'.repeat(24) }, { gameId: '42' });
    assert.equal(submitted.functionName, 'registerForGameWithSignature');
    assert.equal(submitted.args[0].gameID, 42n);
    assert.equal(openOperation(result.operationId, relayConfig), hash);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('authority state reads are method, address, and range constrained', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'xenovoya-authority-read-'));
  try {
    const relayConfig = config(path.join(temp, 'state.json'));
    const ledger = await new SponsorBudgetLedger(relayConfig.stateFile, relayConfig).init();
    const service = new SponsorRelayService({ config: relayConfig, ledger, ...mockClients(relayConfig) });
    assert.equal(await service.readAuthorityState({ method: 'eth_chainId', params: [] }), '0x7a69');
    await assert.rejects(
      () => service.readAuthorityState({ method: 'eth_sendRawTransaction', params: [] }),
      (error) => error.code === 'read_not_allowed',
    );
    await assert.rejects(
      () => service.readAuthorityState({ method: 'eth_call', params: [{ to: '0x0000000000000000000000000000000000000001', data: '0x' }, 'latest'] }),
      (error) => error.code === 'read_scope_denied',
    );
    await assert.rejects(
      () => service.readAuthorityState({ method: 'eth_getLogs', params: [{ address: board, fromBlock: '0x0', toBlock: '0x10000' }] }),
      (error) => error.code === 'read_range_too_large',
    );
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
    const sessionResponse = await fetch(`${base}/v1/game/session`, {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:3000' },
    });
    assert.equal(sessionResponse.status, 201);
    const session = await sessionResponse.json();
    assert.match(session.token, /^g1\./);
    assert.match(session.playerIdentity, /^0x[0-9A-Fa-f]{40}$/);
    assert.equal('chainId' in session, false);
    const stateResponse = await fetch(`${base}/v1/game/state`, {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:3000', authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'eth_chainId', params: [] }),
    });
    assert.equal(stateResponse.status, 200);
    assert.equal((await stateResponse.json()).result, '0x7a69');
    assert.equal((await fetch(`${base}/v1/game/state`, {
      method: 'POST', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: '{}',
    })).status, 401);
    assert.equal((await fetch(`${base}/v1/sponsor/config`, { headers: { origin: 'http://127.0.0.1:3000' } })).status, 404);
    assert.equal((await fetch(`${base}/v1/sponsor/config`, { headers: { origin: 'https://attacker.example' } })).status, 403);
    assert.equal((await fetch(`${base}/admin/budget`)).status, 401);
    const budget = await fetch(`${base}/admin/budget`, { headers: { authorization: `Bearer ${relayConfig.adminToken}` } });
    assert.equal(budget.status, 200);
    assert.equal((await budget.json()).limits.maxPriorityFeePerGasWei, relayConfig.maxPriorityFeePerGasWei.toString());
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
