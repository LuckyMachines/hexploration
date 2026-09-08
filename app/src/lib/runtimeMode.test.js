import { describe, expect, it } from 'vitest';
import { foundry, sepolia } from '../config/chains';
import { resolveTargetChain } from './runtimeMode';

describe('resolveTargetChain', () => {
  it('always prefers Sepolia in production when both endpoints are present', () => {
    const chain = resolveTargetChain({
      appEnv: 'production',
      rpcUrls: {
        [foundry.id]: 'http://127.0.0.1:9955',
        [sepolia.id]: 'https://ethereum-sepolia-rpc.publicnode.com',
      },
    });

    expect(chain.id).toBe(sepolia.id);
  });

  it('keeps the local chain available during local development', () => {
    const chain = resolveTargetChain({
      appEnv: 'development',
      rpcUrls: {
        [foundry.id]: 'http://127.0.0.1:9955',
        [sepolia.id]: 'https://ethereum-sepolia-rpc.publicnode.com',
      },
    });

    expect(chain.id).toBe(foundry.id);
  });
});
