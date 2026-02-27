import { createConfig, http } from 'wagmi';
import { sepolia, foundry } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
const sepoliaRpcUrl = import.meta.env.VITE_RPC_URL;
const foundryRpcUrl =
  import.meta.env.VITE_FOUNDRY_RPC_URL ||
  import.meta.env.VITE_LOCAL_RPC_URL ||
  'http://127.0.0.1:9955';

export const config = createConfig({
  chains: [foundry, sepolia],
  connectors: [
    injected(),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl || undefined),
    [foundry.id]: http(foundryRpcUrl),
  },
});
