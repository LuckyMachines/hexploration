export const foundry = {
  id: 31337,
  name: 'Foundry',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
  testnet: true,
};

export const sepolia = {
  id: 11155111,
  name: 'Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.sepolia.org'] } },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://sepolia.etherscan.io' },
  },
  testnet: true,
};

export const SUPPORTED_CHAINS = [foundry, sepolia];

export const RPC_URLS = {
  [foundry.id]:
    import.meta.env.VITE_FOUNDRY_RPC_URL ||
    import.meta.env.VITE_LOCAL_RPC_URL ||
    (import.meta.env.DEV ? 'http://127.0.0.1:9955' : undefined),
  [sepolia.id]: import.meta.env.VITE_RPC_URL || undefined,
};

export function getChainById(chainId) {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId);
}
