import { describe, expect, it } from 'vitest';
import { foundry, resolveReadChainId, sepolia } from './chains';

describe('read chain resolution', () => {
  it('keeps public observation on a supported chain when an unconnected wallet extension reports another network', () => {
    expect(resolveReadChainId({ isConnected: false, walletChainId: 1, requestedChainId: sepolia.id })).toBe(sepolia.id);
  });

  it('uses the connected wallet network only when the game supports it', () => {
    expect(resolveReadChainId({ isConnected: true, walletChainId: foundry.id, requestedChainId: sepolia.id })).toBe(foundry.id);
    expect(resolveReadChainId({ isConnected: true, walletChainId: 1, requestedChainId: sepolia.id })).toBe(sepolia.id);
  });
});
