import { createPublicClient, http } from 'viem';
import { SUPPORTED_CHAINS, RPC_URLS } from './chains';

const clientCache = new Map();

function getDefaultChainId() {
  const preferredChain = SUPPORTED_CHAINS.find((chain) => {
    const rpcUrl = RPC_URLS[chain.id];
    return typeof rpcUrl === 'string' && rpcUrl.length > 0;
  });

  return preferredChain?.id;
}

export function getPublicClient(chainId) {
  const id = chainId ?? getDefaultChainId() ?? SUPPORTED_CHAINS[0].id;
  if (clientCache.has(id)) return clientCache.get(id);

  const chain = SUPPORTED_CHAINS.find((c) => c.id === id);
  if (!chain) throw new Error(`Unsupported chain: ${id}`);

  const rpcUrl = RPC_URLS[id];
  if (!rpcUrl) {
    throw new Error(`Missing RPC URL for chain: ${id}`);
  }

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
    batch: { multicall: true },
  });

  clientCache.set(id, client);
  return client;
}
