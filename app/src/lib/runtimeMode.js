import { RPC_URLS, SUPPORTED_CHAINS, foundry, sepolia } from '../config/chains';

export function resolveTargetChain({
  rpcUrls = RPC_URLS,
  appEnv = import.meta.env.VITE_APP_ENV,
} = {}) {
  if (appEnv === 'production') return sepolia;
  return SUPPORTED_CHAINS.find((chain) => rpcUrls[chain.id]) || SUPPORTED_CHAINS[0];
}

export function getRuntimeMode() {
  const targetChain = resolveTargetChain();
  const targetRpc = RPC_URLS[targetChain.id];
  const isLocal = targetChain.id === foundry.id;

  return {
    key: isLocal ? 'local' : 'live',
    label: isLocal ? 'Local demo' : 'Live service',
    chain: targetChain,
    chainId: targetChain.id,
    rpcUrl: targetRpc,
    features: {
      localAutomation: isLocal,
      explorerLinks: false,
      sponsoredPreview: false,
    },
  };
}
