import { foundry, sepolia } from 'viem/chains';

export { foundry, sepolia };

export const SUPPORTED_CHAINS = [foundry, sepolia];

export const RPC_URLS = {
  [foundry.id]:
    import.meta.env.VITE_FOUNDRY_RPC_URL ||
    import.meta.env.VITE_LOCAL_RPC_URL ||
    'http://127.0.0.1:9955',
  [sepolia.id]: import.meta.env.VITE_RPC_URL || undefined,
};

export function getChainById(chainId) {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId);
}
