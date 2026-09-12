import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  keccak256,
  stringToHex,
} from 'viem';
import { nonceManager, privateKeyToAccount } from 'viem/accounts';
import {
  actionDigest,
  CONTROLLER_FORWARDER_ABI,
  jsonSafeAction,
  KeyedMutex,
  normalizeSignedAction,
  recoverActionSigner,
  RelayError,
  SESSION_FORWARDER_ABI,
} from './sponsor-relay-core.mjs';

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
        perSignerHourlyActions: this.config.perSignerHourlyActions,
        perPlayerDailyActions: this.config.perPlayerDailyActions,
        globalDailyActions: this.config.globalDailyActions,
        maxGasPerAction: this.config.maxGasPerAction.toString(),
        maxSponsoredCostWei: this.config.maxSponsoredCostWei.toString(),
      },
      paused: this.config.forcedPaused || this.ledger.snapshot().paused,
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
      let estimatedGas;
      let maxFeePerGas;
      try {
        simulation = await this.publicClient.simulateContract({
          address: this.config.forwarderAddress,
          abi: SESSION_FORWARDER_ABI,
          functionName: 'submitActionWithSignature',
          args: [action],
          account: this.account,
        });
        [estimatedGas, maxFeePerGas] = await Promise.all([
          this.publicClient.estimateContractGas(simulation.request),
          this.publicClient.estimateFeesPerGas().then((fees) => fees.maxFeePerGas || fees.gasPrice),
        ]);
      } catch (error) {
        throw new RelayError(422, 'simulation_failed', error.shortMessage || 'The signed action no longer succeeds against current chain state');
      }
      const costWei = estimatedGas * maxFeePerGas;
      const reservation = await this.ledger.reserve({ digest, player: action.player, signer, gas: estimatedGas, costWei });
      if (reservation.duplicate) return this.responseFor(reservation.record, true);

      try {
        const hash = await this.walletClient.writeContract(simulation.request);
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
      let estimatedGas;
      let maxFeePerGas;
      try {
        simulation = await this.publicClient.simulateContract({
          address: this.config.forwarderAddress,
          abi: SESSION_FORWARDER_ABI,
          functionName: 'submitActionsWithSignatures',
          args: [actions],
          account: this.account,
        });
        [estimatedGas, maxFeePerGas] = await Promise.all([
          this.publicClient.estimateContractGas(simulation.request),
          this.publicClient.estimateFeesPerGas().then((fees) => fees.maxFeePerGas || fees.gasPrice),
        ]);
      } catch (error) {
        throw new RelayError(422, 'simulation_failed', error.shortMessage || 'The signed batch no longer succeeds against current chain state');
      }
      const reservation = await this.ledger.reserve({
        digest: batchDigest,
        player: actions[0].player,
        signer,
        gas: estimatedGas,
        costWei: estimatedGas * maxFeePerGas,
        actionCount: actions.length,
      });
      if (reservation.duplicate) return this.responseFor(reservation.record, true);
      try {
        const hash = await this.walletClient.writeContract(simulation.request);
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
