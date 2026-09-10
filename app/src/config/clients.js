import { createPublicClient, fallback, http } from 'viem';
import { SUPPORTED_CHAINS, RPC_URLS } from './chains';

const clientCache = new Map();

function getDefaultChainId() {
  const preferredChain = [...SUPPORTED_CHAINS].sort((left, right) => (left.id === 11155111 ? -1 : right.id === 11155111 ? 1 : 0)).find((chain) => {
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

  const configured = RPC_URLS[id];
  if (!configured) {
    throw new Error(`Missing RPC URL for chain: ${id}`);
  }

  const rpcUrls = [...new Set([
    ...String(configured).split(',').map((value) => value.trim()).filter(Boolean),
    ...(chain.rpcUrls?.default?.http || []),
  ])];

  const client = createPublicClient({
    chain,
    transport: fallback(rpcUrls.map((url) => http(url, { timeout: 8_000, retryCount: 2, retryDelay: 600 })), { rank: true }),
    batch: { multicall: true },
  });

  clientCache.set(id, client);
  return client;
}
