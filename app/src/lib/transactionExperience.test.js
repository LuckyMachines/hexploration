import { describe, expect, it } from 'vitest';
import {
  deriveWalletAcceleration,
  isTransactionActive,
  normalizeTransactionError,
  transactionExplorerUrl,
  transactionRequestKey,
  transactionSignalSequence,
} from './transactionExperience';

describe('transaction experience', () => {
  it('builds stable keys for bigint contract requests', () => {
    const request = { address: '0xabc', functionName: 'move', args: [1n, ['2,3']] };
    expect(transactionRequestKey(request)).toBe(transactionRequestKey({ ...request }));
  });

  it('turns wallet and chain errors into useful recovery language', () => {
    expect(normalizeTransactionError({ shortMessage: 'User rejected the request.' })).toMatchObject({ code: 'rejected', retryable: true });
    expect(normalizeTransactionError({ message: 'execution reverted: Invalid action submitted' })).toMatchObject({ code: 'reverted', title: 'Chain rules blocked this action' });
    expect(normalizeTransactionError({ message: 'RPC request timed out' })).toMatchObject({ code: 'timeout', retryable: false });
    expect(normalizeTransactionError({ message: 'Unsupported chain ID' })).toMatchObject({ code: 'wrong-network', title: 'Switch expedition network' });
    expect(normalizeTransactionError({ message: 'Sponsor relay deadline expired' })).toMatchObject({ code: 'expired', title: 'Authorization expired safely' });
  });

  it('detects optional wallet acceleration without claiming support', () => {
    expect(deriveWalletAcceleration({}, 11155111).mode).toBe('direct');
    expect(deriveWalletAcceleration({ '0xaa36a7': { atomicBatch: { supported: true }, paymasterService: { supported: true } } }, 11155111)).toMatchObject({ canBatch: true, canSponsor: true, mode: 'sponsored' });
  });

  it('builds explorer links and recognizes recoverable states', () => {
    expect(transactionExplorerUrl({ blockExplorers: { default: { url: 'https://scan.test/' } } }, '0x123')).toBe('https://scan.test/tx/0x123');
    expect(isTransactionActive('confirming')).toBe(true);
    expect(isTransactionActive('confirmed')).toBe(false);
  });

  it('keeps confirmation readable as an expedition signal', () => {
    const sequence = transactionSignalSequence('confirming');
    expect(sequence.map((stage) => stage.state)).toEqual(['complete', 'complete', 'active', 'upcoming']);
    expect(sequence[2].label).toBe('Transmit signal');
  });

  it('marks an interrupted stage without claiming later completion', () => {
    const sequence = transactionSignalSequence('failed', { hasError: true });
    expect(sequence.map((stage) => stage.state)).toEqual(['complete', 'failed', 'upcoming', 'upcoming']);
  });
});
