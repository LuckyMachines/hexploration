import { createConfig, http } from 'wagmi';
import { sepolia, foundry } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

export const config = createConfig({
  chains: [foundry, sepolia],
  connectors: [
    injected(),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [sepolia.id]: http(import.meta.env.VITE_RPC_URL || undefined),
    [foundry.id]: http('http://127.0.0.1:9955'),
  },
});
