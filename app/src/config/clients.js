import { createPublicClient, http } from 'viem';
import { SUPPORTED_CHAINS, RPC_URLS } from './chains';

const clientCache = new Map();

export function getPublicClient(chainId) {
  const id = chainId ?? SUPPORTED_CHAINS[0].id;
  if (clientCache.has(id)) return clientCache.get(id);

  const chain = SUPPORTED_CHAINS.find((c) => c.id === id);
  if (!chain) throw new Error(`Unsupported chain: ${id}`);

  const client = createPublicClient({
    chain,
    transport: http(RPC_URLS[id]),
    batch: { multicall: true },
  });

  clientCache.set(id, client);
  return client;
}
