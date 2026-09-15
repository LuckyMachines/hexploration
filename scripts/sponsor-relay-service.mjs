import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  hashTypedData,
  http,
  keccak256,
  stringToHex,
} from 'viem';
import { nonceManager, privateKeyToAccount } from 'viem/accounts';
import {
  actionDigest,
  actionTypedData,
  CONTROLLER_COMMAND_ABI,
  CONTROLLER_FORWARDER_ABI,
  jsonSafeAction,
  KeyedMutex,
  normalizeSignedAction,
  recoverActionSigner,
  registrationTypedData,
  RelayError,
  SESSION_FORWARDER_ABI,
} from './sponsor-relay-core.mjs';
import { authorityAccount, openOperation, sealOperation } from './game-authority.mjs';

export function createRelayClients(config) {
  const account = privateKeyToAccount(config.privateKey, { nonceManager });
  const chain = defineChain({
    id: config.chainId,
    name: config.chainId === 11155111 ? 'Sepolia' : `Xenovoya ${config.chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
    ...(config.explorerUrl ? { blockExplorers: { default: { name: 'Explorer', url: config.explorerUrl } } } : {}),
  });
  const transport = http(config.rpcUrl, { timeout: 12_000, retryCount: 2, retryDelay: 500 });
  return {
    account,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
  };
}

export class SponsorRelayService {
  constructor({ config, ledger, publicClient, walletClient, account, logger = () => {} }) {
    this.config = config;
    this.ledger = ledger;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.account = account;
    this.logger = logger;
    this.signerMutex = new KeyedMutex();
    this.authorityMutex = new KeyedMutex();
    this.authorityActionBuckets = new Map();
    this.readiness = null;
  }

  publicConfig() {
    return {
      version: 1,
      chainId: this.config.chainId,
      forwarderAddress: this.config.forwarderAddress,
      controllerAddress: this.config.controllerAddress,
      boardAddress: this.config.boardAddress,
      relayerAddress: this.account.address,
      confirmations: this.config.confirmations,
      maxDeadlineSeconds: this.config.maxDeadlineSeconds,
      limits: {
        authorityBatchWindowMs: this.config.authorityBatchWindowMs,
        authorityMaxBatchSize: this.config.authorityMaxBatchSize,
        perSignerHourlyActions: this.config.perSignerHourlyActions,
        perPlayerDailyActions: this.config.perPlayerDailyActions,
        globalDailyActions: this.config.globalDailyActions,
        maxGasPerAction: this.config.maxGasPerAction.toString(),
        maxSponsoredCostWei: this.config.maxSponsoredCostWei.toString(),
        maxFeePerGasWei: this.config.maxFeePerGasWei.toString(),
        maxPriorityFeePerGasWei: this.config.maxPriorityFeePerGasWei.toString(),
      },
      paused: this.config.forcedPaused || this.ledger.snapshot().paused,
    };
  }

  spendStatus() {
    const day = new Date().toISOString().slice(0, 10);
    const usage = this.ledger.snapshot().days[day] || { actions: 0, gas: '0', costWei: '0' };
    return {
      day,
      actions: usage.actions,
      gas: usage.gas,
      costWei: usage.costWei,
      limits: {
        actions: this.config.globalDailyActions,
        gas: this.config.globalDailyGas.toString(),
        costWei: this.config.globalDailyCostWei.toString(),
        maxFeePerGasWei: this.config.maxFeePerGasWei.toString(),
        maxPriorityFeePerGasWei: this.config.maxPriorityFeePerGasWei.toString(),
      },
    };
  }

  playerIdentity(session) {
    return authorityAccount(session, this.config);
  }

  async readAuthorityState(request) {
    const method = String(request?.method || '');
    const params = Array.isArray(request?.params) ? request.params : [];
    const allowed = new Set([
      'eth_blockNumber',
      'eth_call',
      'eth_chainId',
      'eth_getBlockByNumber',
      'eth_getCode',
      'eth_getLogs',
      'eth_getTransactionReceipt',
    ]);
    if (!allowed.has(method)) throw new RelayError(400, 'read_not_allowed', 'That game-state request is not allowed');

    if (method === 'eth_call' || method === 'eth_getCode') {
      const address = String(method === 'eth_call' ? params[0]?.to : params[0] || '').toLowerCase();
      if (!this.config.readAddresses.has(address)) throw new RelayError(403, 'read_scope_denied', 'That game-state request is outside the playable world');
    }
    if (method === 'eth_getLogs') {
      const filter = params[0] || {};
      const addresses = (Array.isArray(filter.address) ? filter.address : [filter.address]).filter(Boolean).map((value) => String(value).toLowerCase());
      if (!addresses.length || addresses.some((address) => !this.config.readAddresses.has(address))) {
        throw new RelayError(403, 'read_scope_denied', 'That game-state request is outside the playable world');
      }
      const from = this.rpcBlock(filter.fromBlock);
      const to = this.rpcBlock(filter.toBlock);
      if (from !== null && to !== null && (to < from || to - from > 50_000n)) {
        throw new RelayError(400, 'read_range_too_large', 'That game-state history request is too large');
      }
    }
    return this.publicClient.request({ method, params });
  }

  rpcBlock(value) {
    if (value === undefined || value === null || ['latest', 'safe', 'finalized', 'pending', 'earliest'].includes(value)) return null;
    try { return BigInt(value); } catch { throw new RelayError(400, 'invalid_read', 'Game-state request contains an invalid block reference'); }
  }

  async submitAuthorityAction(session, input) {
    const player = this.playerIdentity(session);
    return this.authorityMutex.run(player.address, async () => {
      const nonce = await this.publicClient.readContract({
        address: this.config.forwarderAddress,
        abi: SESSION_FORWARDER_ABI,
        functionName: 'actionNonces',
        args: [player.address],
      });
      const action = normalizeSignedAction({
        ...input,
        player: player.address,
        boardAddress: this.config.boardAddress,
        nonce,
        deadline: BigInt(Math.floor(Date.now() / 1000) + Math.min(this.config.maxDeadlineSeconds, 300)),
        signature: `0x${'00'.repeat(65)}`,
      }, this.config);
      action.signature = await player.signTypedData(actionTypedData(action, this.config));
      try {
        return this.authorityResponse(await this.enqueueAuthorityAction(action));
      } catch (error) {
        if (error instanceof RelayError) {
          const status = error.status >= 500 ? 503 : error.status;
          throw new RelayError(status, 'action_unavailable', status >= 500
            ? 'Live play is temporarily unavailable'
            : 'The game cannot accept that action right now');
        }
        throw error;
      }
    });
  }

  enqueueAuthorityAction(action) {
    const key = `${action.boardAddress}:${action.gameID}`;
    let bucket = this.authorityActionBuckets.get(key);
    if (!bucket) {
      bucket = { actions: [], timer: null, flushing: false };
      this.authorityActionBuckets.set(key, bucket);
    }
    return new Promise((resolve, reject) => {
      bucket.actions.push({ action, resolve, reject });
      if (bucket.actions.length >= this.config.authorityMaxBatchSize) {
        clearTimeout(bucket.timer);
        bucket.timer = null;
        void this.flushAuthorityActions(key, bucket);
      } else if (!bucket.timer) {
        bucket.timer = setTimeout(() => this.flushAuthorityActions(key, bucket), this.config.authorityBatchWindowMs);
      }
    });
  }

  async flushAuthorityActions(key, bucket) {
    if (bucket.flushing) return;
    bucket.flushing = true;
    clearTimeout(bucket.timer);
    bucket.timer = null;
    const entries = bucket.actions.splice(0, this.config.authorityMaxBatchSize);
    try {
      if (entries.length === 1) {
        entries[0].resolve(await this.submit(entries[0].action));
      } else {
        try {
          const record = await this.submitAuthorityBatch(entries.map((entry) => entry.action));
          entries.forEach((entry) => entry.resolve(record));
        } catch (error) {
          if (error.code !== 'simulation_failed') throw error;
          const results = await Promise.allSettled(entries.map((entry) => this.submit(entry.action)));
          results.forEach((result, index) => result.status === 'fulfilled'
            ? entries[index].resolve(result.value)
            : entries[index].reject(result.reason));
        }
      }
    } catch (error) {
      entries.forEach((entry) => entry.reject(error));
    } finally {
      bucket.flushing = false;
      if (bucket.actions.length) {
        bucket.timer = setTimeout(() => this.flushAuthorityActions(key, bucket), this.config.authorityBatchWindowMs);
      } else {
        this.authorityActionBuckets.delete(key);
      }
    }
  }

  async submitAuthorityBatch(actions) {
    const signers = await Promise.all(actions.map((action) => recoverActionSigner(action, this.config)));
    const digest = keccak256(stringToHex(actions.map((action) => actionDigest(action, this.config)).join(':')));
    const participants = [...new Set(signers)].map((signer) => {
      const indexes = signers.map((value, index) => value === signer ? index : -1).filter((index) => index >= 0);
      return { player: actions[indexes[0]].player, signer, actionCount: indexes.length };
    });
    return this.signerMutex.run(`authority-batch:${actions[0].gameID}`, async () => {
      const existing = this.ledger.snapshot().requests[digest];
      if (existing) return this.responseFor(existing, true);
      const readiness = await this.checkReadiness({ force: true });
      if (!readiness.ready) throw new RelayError(503, 'service_unavailable', 'Live play is temporarily unavailable');
      const nonces = new Map(await Promise.all(participants.map(async ({ signer }) => [signer, await this.publicClient.readContract({
        address: this.config.forwarderAddress,
        abi: SESSION_FORWARDER_ABI,
        functionName: 'actionNonces',
        args: [signer],
      })])));
      const offsets = new Map();
      actions.forEach((action, index) => {
        const signer = signers[index];
        const offset = offsets.get(signer) || 0n;
        if (action.nonce !== nonces.get(signer) + offset) throw new RelayError(409, 'nonce_mismatch', 'A queued action became stale');
        offsets.set(signer, offset + 1n);
      });
      let simulation;
      try {
        simulation = await this.publicClient.simulateContract({
          address: this.config.forwarderAddress,
          abi: SESSION_FORWARDER_ABI,
          functionName: 'submitActionsWithSignatures',
          args: [actions],
          account: this.account,
        });
      } catch {
        throw new RelayError(422, 'simulation_failed', 'The combined action set no longer succeeds');
      }
      const quote = await this.quoteSubmission(simulation.request);
      const reservation = await this.ledger.reserve({
        digest,
        player: participants[0].player,
        signer: participants[0].signer,
        gas: quote.gas,
        costWei: quote.gas * quote.maxFeePerGas,
        actionCount: actions.length,
        participants,
      });
      if (reservation.duplicate) return this.responseFor(reservation.record, true);
      try {
        const hash = await this.walletClient.writeContract({ ...simulation.request, ...quote.requestFees, gas: quote.gas });
        const record = await this.ledger.markSubmitted(digest, hash);
        this.trackReceipt(hash);
        this.logger('managed_action_batch_submitted', { digest, actionCount: actions.length });
        return this.responseFor(record, false);
      } catch (error) {
        await this.ledger.markFailed(digest, error.name || 'broadcast_failed');
        throw new RelayError(502, 'command_failed', 'The game could not accept the combined actions');
      }
    });
  }

  async registerAuthorityPlayer(session, input) {
    const player = this.playerIdentity(session);
    const gameID = this.authorityUint(input?.gameId, 'gameId');
    const nonce = await this.publicClient.readContract({
      address: this.config.forwarderAddress,
      abi: SESSION_FORWARDER_ABI,
      functionName: 'registrationNonces',
      args: [player.address],
    });
    const registration = {
      player: player.address,
      gameID,
      boardAddress: this.config.boardAddress,
      nonce,
      deadline: BigInt(Math.floor(Date.now() / 1000) + Math.min(this.config.maxDeadlineSeconds, 300)),
    };
    registration.signature = await player.signTypedData(registrationTypedData(registration, this.config));
    const digest = hashTypedData(registrationTypedData(registration, this.config));
    return this.authorityResponse(await this.submitBudgetedContract({
      digest,
      player: player.address,
      signer: player.address,
      address: this.config.forwarderAddress,
      abi: SESSION_FORWARDER_ABI,
      functionName: 'registerForGameWithSignature',
      args: [registration],
      logEvent: 'game_registration_submitted',
    }));
  }

  async createAuthorityGame(session, input) {
    const player = this.playerIdentity(session);
    const totalPlayers = Number(input?.totalPlayers);
    if (!Number.isInteger(totalPlayers) || totalPlayers < 1 || totalPlayers > 4) {
      throw new RelayError(400, 'invalid_crew_size', 'Crew size must be between one and four');
    }
    const idempotencyKey = String(input?.requestId || '');
    if (!/^[a-zA-Z0-9_-]{16,96}$/.test(idempotencyKey)) throw new RelayError(400, 'invalid_request_id', 'A valid request reference is required');
    const digest = keccak256(stringToHex(`create:${session.sid}:${idempotencyKey}:${totalPlayers}`));
    return this.authorityResponse(await this.submitBudgetedContract({
      digest,
      player: player.address,
      signer: player.address,
      address: this.config.controllerAddress,
      abi: CONTROLLER_COMMAND_ABI,
      functionName: 'requestNewGame',
      args: [this.config.gameRegistryAddress, this.config.boardAddress, BigInt(totalPlayers)],
      logEvent: 'game_creation_submitted',
    }));
  }

  authorityUint(value, field) {
    let parsed;
    try { parsed = BigInt(value); } catch { throw new RelayError(400, 'invalid_command', `${field} must be a positive integer`); }
    if (parsed < 1n || parsed > (2n ** 256n) - 1n) throw new RelayError(400, 'invalid_command', `${field} must be a positive integer`);
    return parsed;
  }

  async quoteSubmission(request) {
    const [estimatedGas, block, fees] = await Promise.all([
      this.publicClient.estimateContractGas(request),
      this.publicClient.getBlock({ blockTag: 'latest' }),
      this.publicClient.estimateFeesPerGas(),
    ]);
    const gas = (estimatedGas * this.config.gasHeadroomBps + 9_999n) / 10_000n;
    const baseFee = block.baseFeePerGas ?? fees.gasPrice ?? fees.maxFeePerGas;
    if (!baseFee) throw new RelayError(503, 'fee_unavailable', 'Live play is waiting for a usable network fee quote');
    const priorityQuote = fees.maxPriorityFeePerGas ?? this.config.maxPriorityFeePerGasWei;
    const maxPriorityFeePerGas = priorityQuote < this.config.maxPriorityFeePerGasWei
      ? priorityQuote
      : this.config.maxPriorityFeePerGasWei;
    const minimumFee = baseFee + maxPriorityFeePerGas;
    if (minimumFee > this.config.maxFeePerGasWei) {
      throw new RelayError(503, 'fee_window_expensive', 'Live play is waiting for a less expensive settlement window');
    }
    const feeWithHeadroom = (baseFee * this.config.feeHeadroomBps + 9_999n) / 10_000n + maxPriorityFeePerGas;
    const maxFeePerGas = feeWithHeadroom < this.config.maxFeePerGasWei
      ? feeWithHeadroom
      : this.config.maxFeePerGasWei;
    return {
      gas,
      maxFeePerGas,
      requestFees: block.baseFeePerGas === null || block.baseFeePerGas === undefined
        ? { gasPrice: maxFeePerGas }
        : { maxFeePerGas, maxPriorityFeePerGas },
    };
  }

  async submitBudgetedContract({ digest, player, signer, address, abi, functionName, args, logEvent }) {
    return this.signerMutex.run(signer, async () => {
      const existing = this.ledger.snapshot().requests[digest];
      if (existing) {
        if (existing.hash) return this.responseFor(existing, true);
        throw new RelayError(409, 'request_in_progress', 'This command is already being processed');
      }
      const readiness = await this.checkReadiness({ force: true });
      if (!readiness.ready) throw new RelayError(503, 'service_unavailable', 'Live play is temporarily unavailable');
      let simulation;
      try {
        simulation = await this.publicClient.simulateContract({ address, abi, functionName, args, account: this.account });
      } catch (error) {
        throw new RelayError(422, 'command_rejected', 'The game cannot accept that command right now');
      }
      const quote = await this.quoteSubmission(simulation.request);
      const reservation = await this.ledger.reserve({ digest, player, signer, gas: quote.gas, costWei: quote.gas * quote.maxFeePerGas });
      if (reservation.duplicate) return this.responseFor(reservation.record, true);
      try {
        const hash = await this.walletClient.writeContract({ ...simulation.request, ...quote.requestFees, gas: quote.gas });
        const record = await this.ledger.markSubmitted(digest, hash);
        this.trackReceipt(hash);
        this.logger(logEvent, { digest });
        return this.responseFor(record, false);
      } catch (error) {
        await this.ledger.markFailed(digest, error.name || 'broadcast_failed');
        throw new RelayError(502, 'command_failed', 'The game could not accept that command');
      }
    });
  }

  authorityResponse(record) {
    return {
      operationId: sealOperation(record.hash, this.config),
      status: record.status === 'confirmed' ? 'complete' : 'processing',
      duplicate: record.duplicate,
    };
  }

  async authorityStatus(operationId) {
    const record = await this.status(openOperation(operationId, this.config));
    return {
      operationId,
      status: record.status === 'confirmed' ? 'complete' : record.status === 'reverted' ? 'failed' : 'processing',
    };
  }

  async checkReadiness({ force = false } = {}) {
    if (!force && this.readiness && Date.now() - this.readiness.checkedAt < 30_000) return this.readiness;
    const result = {
      ready: false,
      checkedAt: Date.now(),
      chainId: null,
      balanceWei: '0',
      forwarderDeployed: false,
      controllerMatches: false,
      roleGranted: false,
      paused: this.config.forcedPaused || this.ledger.snapshot().paused,
    };
    try {
      const [chainId, balance, bytecode, configuredController, forwarderRole] = await Promise.all([
        this.publicClient.getChainId(),
        this.publicClient.getBalance({ address: this.account.address }),
        this.publicClient.getBytecode({ address: this.config.forwarderAddress }),
        this.publicClient.readContract({ address: this.config.forwarderAddress, abi: SESSION_FORWARDER_ABI, functionName: 'CONTROLLER' }),
        this.publicClient.readContract({ address: this.config.controllerAddress, abi: CONTROLLER_FORWARDER_ABI, functionName: 'ACTION_FORWARDER_ROLE' }),
      ]);
      const roleGranted = await this.publicClient.readContract({
        address: this.config.controllerAddress,
        abi: CONTROLLER_FORWARDER_ABI,
        functionName: 'hasRole',
        args: [forwarderRole, this.config.forwarderAddress],
      });
      Object.assign(result, {
        chainId: Number(chainId),
        balanceWei: balance.toString(),
        forwarderDeployed: Boolean(bytecode && bytecode !== '0x'),
        controllerMatches: getAddress(configuredController) === this.config.controllerAddress,
        roleGranted: Boolean(roleGranted),
      });
      result.ready = !result.paused
        && result.chainId === this.config.chainId
        && balance >= this.config.minRelayerBalanceWei
        && result.forwarderDeployed
        && result.controllerMatches
        && result.roleGranted;
    } catch (error) {
      result.error = 'Chain readiness check failed';
      this.logger('relay_readiness_failed', { code: error.shortMessage || error.name || 'rpc_error' });
    }
    this.readiness = result;
    return result;
  }

  async submit(input) {
    const action = normalizeSignedAction(input, this.config);
    const signer = await recoverActionSigner(action, this.config);
    const digest = actionDigest(action, this.config);

    return this.signerMutex.run(signer, async () => {
      const existing = this.ledger.snapshot().requests[digest];
      if (existing) {
        if (existing.hash) return this.responseFor(existing, true);
        throw new RelayError(409, 'request_in_progress', 'This signed action is already being processed');
      }

      const readiness = await this.checkReadiness({ force: true });
      if (!readiness.ready) throw new RelayError(503, 'relay_not_ready', 'The sponsor relay is not ready to submit actions', readiness);

      const chainNonce = await this.publicClient.readContract({
        address: this.config.forwarderAddress,
        abi: SESSION_FORWARDER_ABI,
        functionName: 'actionNonces',
        args: [signer],
      });
      if (chainNonce !== action.nonce) throw new RelayError(409, 'nonce_mismatch', 'The action nonce is stale; sign a fresh request', { expectedNonce: chainNonce.toString() });

      if (signer !== action.player) {
        const authorized = await this.publicClient.readContract({
          address: this.config.forwarderAddress,
          abi: SESSION_FORWARDER_ABI,
          functionName: 'isSessionKeyAuthorized',
          args: [action.player, signer, action.gameID, action.boardAddress],
        });
        if (!authorized) throw new RelayError(403, 'session_not_authorized', 'This session key is expired, exhausted, revoked, or not authorized for the expedition');
      }

      let simulation;
      try {
        simulation = await this.publicClient.simulateContract({
          address: this.config.forwarderAddress,
          abi: SESSION_FORWARDER_ABI,
          functionName: 'submitActionWithSignature',
          args: [action],
          account: this.account,
        });
      } catch (error) {
        throw new RelayError(422, 'simulation_failed', error.shortMessage || 'The signed action no longer succeeds against current chain state');
      }
      const quote = await this.quoteSubmission(simulation.request);
      const reservation = await this.ledger.reserve({ digest, player: action.player, signer, gas: quote.gas, costWei: quote.gas * quote.maxFeePerGas });
      if (reservation.duplicate) return this.responseFor(reservation.record, true);

      try {
        const hash = await this.walletClient.writeContract({ ...simulation.request, ...quote.requestFees, gas: quote.gas });
        const record = await this.ledger.markSubmitted(digest, hash);
        this.trackReceipt(hash);
        this.logger('sponsored_action_submitted', { digest, hash, actionIndex: action.actionIndex, gameID: action.gameID.toString() });
        return this.responseFor(record, false);
      } catch (error) {
        await this.ledger.markFailed(digest, error.name || 'broadcast_failed');
        throw new RelayError(502, 'broadcast_failed', error.shortMessage || 'The relay could not broadcast the sponsored action');
      }
    });
  }

  async submitBatch(inputs) {
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 8) throw new RelayError(400, 'invalid_batch', 'A sponsored batch must contain between one and eight actions');
    const actions = inputs.map((input) => normalizeSignedAction(input, this.config));
    const signers = await Promise.all(actions.map((action) => recoverActionSigner(action, this.config)));
    const signer = signers[0];
    if (signers.some((value) => value !== signer)) throw new RelayError(400, 'mixed_batch_signers', 'Every action in a sponsored batch must use the same session key');
    if (actions.some((action) => action.player !== actions[0].player)) throw new RelayError(400, 'mixed_batch_players', 'Every action in a sponsored batch must belong to the same player');
    const digests = actions.map((action) => actionDigest(action, this.config));
    if (new Set(digests).size !== digests.length) throw new RelayError(400, 'duplicate_batch_action', 'A sponsored batch cannot contain duplicate signed actions');
    const batchDigest = keccak256(stringToHex(digests.join(':')));

    return this.signerMutex.run(signer, async () => {
      const existing = this.ledger.snapshot().requests[batchDigest];
      if (existing) {
        if (existing.hash) return this.responseFor(existing, true);
        throw new RelayError(409, 'request_in_progress', 'This signed batch is already being processed');
      }
      const readiness = await this.checkReadiness({ force: true });
      if (!readiness.ready) throw new RelayError(503, 'relay_not_ready', 'The sponsor relay is not ready to submit actions', readiness);
      const chainNonce = await this.publicClient.readContract({
        address: this.config.forwarderAddress, abi: SESSION_FORWARDER_ABI, functionName: 'actionNonces', args: [signer],
      });
      actions.forEach((action, index) => {
        if (action.nonce !== chainNonce + BigInt(index)) throw new RelayError(409, 'nonce_mismatch', 'Batch nonces must be consecutive from the current session nonce', { expectedNonce: (chainNonce + BigInt(index)).toString() });
      });
      if (signer !== actions[0].player) {
        const authorizations = await Promise.all(actions.map((action) => this.publicClient.readContract({
          address: this.config.forwarderAddress,
          abi: SESSION_FORWARDER_ABI,
          functionName: 'isSessionKeyAuthorized',
          args: [action.player, signer, action.gameID, action.boardAddress],
        })));
        if (authorizations.some((authorized) => !authorized)) throw new RelayError(403, 'session_not_authorized', 'The session key is not authorized for every action in this batch');
      }
      let simulation;
      try {
        simulation = await this.publicClient.simulateContract({
          address: this.config.forwarderAddress,
          abi: SESSION_FORWARDER_ABI,
          functionName: 'submitActionsWithSignatures',
          args: [actions],
          account: this.account,
        });
      } catch (error) {
        throw new RelayError(422, 'simulation_failed', error.shortMessage || 'The signed batch no longer succeeds against current chain state');
      }
      const quote = await this.quoteSubmission(simulation.request);
      const reservation = await this.ledger.reserve({
        digest: batchDigest,
        player: actions[0].player,
        signer,
        gas: quote.gas,
        costWei: quote.gas * quote.maxFeePerGas,
        actionCount: actions.length,
      });
      if (reservation.duplicate) return this.responseFor(reservation.record, true);
      try {
        const hash = await this.walletClient.writeContract({ ...simulation.request, ...quote.requestFees, gas: quote.gas });
        const record = await this.ledger.markSubmitted(batchDigest, hash);
        this.trackReceipt(hash);
        this.logger('sponsored_batch_submitted', { batchDigest, hash, actionCount: actions.length });
        return { ...this.responseFor(record, false), actionCount: actions.length };
      } catch (error) {
        await this.ledger.markFailed(batchDigest, error.name || 'broadcast_failed');
        throw new RelayError(502, 'broadcast_failed', error.shortMessage || 'The relay could not broadcast the sponsored batch');
      }
    });
  }

  async status(hash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash || '')) throw new RelayError(400, 'invalid_hash', 'Transaction hash is invalid');
    const transaction = this.ledger.snapshot().transactions[hash];
    if (!transaction) throw new RelayError(404, 'unknown_transaction', 'This relay has no record of that transaction');
    if (transaction.status === 'submitted') {
      try {
        const receipt = await this.publicClient.getTransactionReceipt({ hash });
        const latest = await this.publicClient.getBlockNumber();
        const confirmations = latest >= receipt.blockNumber ? latest - receipt.blockNumber + 1n : 0n;
        if (confirmations >= BigInt(this.config.confirmations)) await this.ledger.markReceipt(hash, receipt);
      } catch { /* still pending */ }
    }
    return this.transactionResponse(hash, this.ledger.snapshot().transactions[hash]);
  }

  trackReceipt(hash) {
    this.publicClient.waitForTransactionReceipt({ hash, confirmations: this.config.confirmations, timeout: 180_000 })
      .then((receipt) => this.ledger.markReceipt(hash, receipt))
      .catch((error) => this.logger('sponsored_receipt_unresolved', { hash, code: error.name || 'receipt_timeout' }));
  }

  responseFor(record, duplicate) {
    return {
      digest: record.digest,
      hash: record.hash || null,
      status: record.status,
      duplicate,
      explorerUrl: record.hash && this.config.explorerUrl ? `${this.config.explorerUrl}/tx/${record.hash}` : null,
      estimatedGas: record.estimatedGas,
      reservedCostWei: record.reservedCostWei,
    };
  }

  transactionResponse(hash, transaction) {
    return {
      hash,
      ...transaction,
      explorerUrl: transaction && this.config.explorerUrl
        ? `${this.config.explorerUrl}/tx/${hash}`
        : null,
    };
  }
}

export function relayContractAction(action) {
  return jsonSafeAction(action);
}
