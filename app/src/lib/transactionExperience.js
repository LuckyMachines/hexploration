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
