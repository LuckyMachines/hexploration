export const foundry = {
  id: 31337,
  name: 'Foundry',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
  testnet: true,
};

export const sepolia = {
  id: 11155111,
  name: 'Xenovoya Live',
  nativeCurrency: { name: 'World Credit', symbol: 'XC', decimals: 18 },
  rpcUrls: { default: { http: [] } },
  testnet: true,
};

export const SUPPORTED_CHAINS = [foundry, sepolia];

export const RPC_URLS = {
  [foundry.id]:
    import.meta.env.VITE_FOUNDRY_RPC_URL ||
    import.meta.env.VITE_LOCAL_RPC_URL ||
    (import.meta.env.DEV ? 'http://127.0.0.1:9955' : undefined),
  [sepolia.id]: undefined,
};

export function getChainById(chainId) {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId);
}

export function resolveReadChainId({ isConnected = false, walletChainId, requestedChainId, fallbackChainId = sepolia.id } = {}) {
  if (isConnected && getChainById(walletChainId)) return Number(walletChainId);
  if (getChainById(Number(requestedChainId))) return Number(requestedChainId);
  return getChainById(fallbackChainId)?.id ?? SUPPORTED_CHAINS[0].id;
}
