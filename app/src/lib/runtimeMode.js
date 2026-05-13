import { RPC_URLS, SUPPORTED_CHAINS, foundry } from '../config/chains';

export function getRuntimeMode() {
  const targetChain = SUPPORTED_CHAINS.find((chain) => RPC_URLS[chain.id]) || SUPPORTED_CHAINS[0];
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
