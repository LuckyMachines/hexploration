import { RPC_URLS, SUPPORTED_CHAINS, foundry, sepolia } from '../config/chains';

export function resolveTargetChain({
  rpcUrls = RPC_URLS,
  appEnv = import.meta.env.VITE_APP_ENV,
} = {}) {
  if (appEnv === 'production' && rpcUrls[sepolia.id]) return sepolia;
  return SUPPORTED_CHAINS.find((chain) => rpcUrls[chain.id]) || SUPPORTED_CHAINS[0];
}

export function getRuntimeMode() {
  const targetChain = resolveTargetChain();
  const targetRpc = RPC_URLS[targetChain.id];
  const isLocal = targetChain.id === foundry.id;

  return {
    key: isLocal ? 'local' : 'testnet',
    label: isLocal ? 'Local demo' : 'Testnet',
    chain: targetChain,
    chainId: targetChain.id,
    rpcUrl: targetRpc,
    features: {
      localAutomation: isLocal,
      explorerLinks: !isLocal,
      sponsoredPreview: false,
    },
  };
}
