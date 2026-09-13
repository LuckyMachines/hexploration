const ACTIVE_TRANSACTION_STATES = new Set([
  'simulating',
  'awaiting_signature',
  'submitted',
  'confirming',
  'replaced',
  'unresolved',
]);

export const TRANSACTION_PHASES = Object.freeze({
  IDLE: 'idle',
  SIMULATING: 'simulating',
  READY: 'ready',
  AWAITING_SIGNATURE: 'awaiting_signature',
  SUBMITTED: 'submitted',
  CONFIRMING: 'confirming',
  REPLACED: 'replaced',
  CONFIRMED: 'confirmed',
  REVERTED: 'reverted',
  FAILED: 'failed',
  UNRESOLVED: 'unresolved',
});

export function transactionRequestKey(request = {}) {
  return JSON.stringify({
    address: request.address || '',
    functionName: request.functionName || '',
    args: request.args || [],
    value: request.value ?? 0n,
  }, (_key, value) => typeof value === 'bigint' ? value.toString() : value);
}

export function normalizeTransactionError(error) {
  if (!error) return null;
  const raw = [
    error.shortMessage,
    error.reason,
    error.cause?.reason,
    error.cause?.shortMessage,
    error.details,
    error.message,
  ].find((value) => typeof value === 'string' && value.trim());
  const message = String(raw || error).replace(/^execution reverted:\s*/i, '').trim();
  const lower = message.toLowerCase();

  if (lower.includes('user rejected') || lower.includes('user denied')) {
    return { code: 'rejected', title: 'Signature cancelled', message: 'Nothing was submitted. Review the action and try again when ready.', retryable: true };
  }
  if (lower.includes('wrong network') || lower.includes('unsupported chain') || lower.includes('chain mismatch') || lower.includes('chain id')) {
    return { code: 'wrong-network', title: 'Switch expedition network', message: 'Your planned action is preserved. Switch to the expedition network, then try the same action again.', retryable: true };
  }
  if (lower.includes('expired') || lower.includes('deadline')) {
    return { code: 'expired', title: 'Authorization expired safely', message: 'Nothing new was submitted. Renew the scoped authorization or use a direct wallet action.', retryable: true };
  }
  if (lower.includes('relay') || lower.includes('sponsor')) {
    return { code: 'relay', title: 'Sponsored route unavailable', message: 'The action was not sponsored. Your intent is preserved and a direct wallet action remains available.', retryable: true };
  }
  if (lower.includes('insufficient funds')) {
    return { code: 'funds', title: 'Not enough network funds', message: 'This account cannot currently cover the network fee.', retryable: false };
  }
  if (lower.includes('nonce')) {
    return { code: 'nonce', title: 'Wallet sequence changed', message: 'Refresh the wallet state and retry this action.', retryable: true };
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return { code: 'timeout', title: 'Confirmation is taking longer', message: 'The action may still be on-chain. Its receipt remains recoverable after reload.', retryable: false };
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('rpc')) {
    return { code: 'network', title: 'Network connection interrupted', message: 'Your intent is preserved. Reconnect before sending or checking the receipt.', retryable: true };
  }
  if (lower.includes('revert') || lower.includes('invalid action') || lower.includes('cannot submit')) {
    return { code: 'reverted', title: 'Chain rules blocked this action', message: message || 'The action no longer matches authoritative chain state.', retryable: true };
  }
  return { code: 'unknown', title: 'Action could not be submitted', message: message || 'The wallet or network returned an unknown error.', retryable: true };
}

export function transactionExplorerUrl(chain, hash) {
  const base = chain?.blockExplorers?.default?.url;
  return base && hash ? `${base.replace(/\/$/, '')}/tx/${hash}` : '';
}

export function isTransactionActive(status) {
  return ACTIVE_TRANSACTION_STATES.has(status);
}

function capabilityEnabled(value) {
  if (value === true || value === 'supported') return true;
  if (!value || typeof value !== 'object') return false;
  if (value.supported === true || value.status === 'supported') return true;
  return Object.values(value).some(capabilityEnabled);
}

export function deriveWalletAcceleration(capabilities = {}, chainId, permissions = []) {
  const chainHex = chainId ? `0x${Number(chainId).toString(16)}` : '';
  const scoped = capabilities?.[chainHex] || capabilities?.[String(chainId)] || capabilities || {};
  const canBatch = capabilityEnabled(scoped.atomicBatch) || capabilityEnabled(scoped.wallet_sendCalls);
  const canSponsor = capabilityEnabled(scoped.paymasterService) || capabilityEnabled(scoped.paymaster);
  const canDelegate = capabilityEnabled(scoped.permissions) || permissions.some((permission) => (
    /session|delegate/i.test(String(permission?.parentCapability || permission?.invoker || ''))
  ));

  return {
    canBatch,
    canSponsor,
    canDelegate,
    mode: canDelegate ? 'delegated' : canSponsor ? 'sponsored' : canBatch ? 'batched' : 'direct',
  };
}

export function formatEstimatedGas(value) {
  if (value === null || value === undefined) return 'Estimating';
  return `${Number(value).toLocaleString()} gas`;
}

const SIGNAL_STAGES = Object.freeze([
  { id: 'preflight', label: 'Read the world', detail: 'Check the action against current expedition state.' },
  { id: 'authorization', label: 'Authorize intent', detail: 'Your wallet approves only this prepared action.' },
  { id: 'transmission', label: 'Transmit signal', detail: 'The action is traveling to the expedition contract.' },
  { id: 'memory', label: 'Write memory', detail: 'Confirmation makes the result authoritative and recoverable.' },
]);

const SIGNAL_PHASE_INDEX = Object.freeze({
  idle: 0,
  simulating: 0,
  ready: 1,
  awaiting_signature: 1,
  submitted: 2,
  confirming: 2,
  replaced: 2,
  unresolved: 2,
  confirmed: 3,
  reverted: 2,
  failed: 1,
});

export function transactionSignalSequence(phase = 'idle', { hasError = false } = {}) {
  const activeIndex = SIGNAL_PHASE_INDEX[phase] ?? 0;
  const failed = hasError || phase === 'failed' || phase === 'reverted';
  return SIGNAL_STAGES.map((stage, index) => ({
    ...stage,
    state: failed && index === activeIndex
      ? 'failed'
      : index < activeIndex || phase === 'confirmed'
        ? 'complete'
        : index === activeIndex
          ? 'active'
          : 'upcoming',
  }));
}
