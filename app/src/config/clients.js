import { createPublicClient, custom, fallback, http } from 'viem';
import { SUPPORTED_CHAINS, RPC_URLS } from './chains';
import { gameAuthorityConfigured, requestGameState } from '../lib/gameAuthority';

const clientCache = new Map();

export function getDefaultChainId() {
  if (gameAuthorityConfigured()) return 11155111;
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
  const managed = gameAuthorityConfigured();
  if (!configured && !managed) {
    throw new Error(`Missing RPC URL for chain: ${id}`);
  }

  // The configured endpoint list is authoritative. Appending a chain default here can
  // silently route local/test reads to a different node (for example :8545 instead of
  // the dynamically allocated Anvil port) and leave a valid query waiting on retries.
  const rpcUrls = configured ? [...new Set(String(configured).split(',').map((value) => value.trim()).filter(Boolean))] : [];
  const transport = managed
    ? custom({ request: ({ method, params }) => requestGameState(method, params) }, { name: 'Xenovoya game state' })
    : fallback(rpcUrls.map((url) => http(url, { timeout: 8_000, retryCount: 2, retryDelay: 600 })), { rank: true });

  const client = createPublicClient({
    chain,
    transport,
    batch: { multicall: !managed },
  });

  clientCache.set(id, client);
  return client;
}
