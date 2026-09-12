import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { deriveWalletAcceleration } from '../lib/transactionExperience';

export function useWalletCapabilities() {
  const { address, chainId, isConnected } = useWallet();
  const [state, setState] = useState({ status: 'idle', capabilities: {}, permissions: [] });

  useEffect(() => {
    if (!isConnected || !address || !window.ethereum?.request) {
      setState({ status: 'idle', capabilities: {}, permissions: [] });
      return undefined;
    }

    let cancelled = false;
    setState((current) => ({ ...current, status: 'checking' }));
    Promise.allSettled([
      window.ethereum.request({ method: 'wallet_getCapabilities', params: [address] }),
      window.ethereum.request({ method: 'wallet_getPermissions' }),
    ]).then(([capabilities, permissions]) => {
      if (cancelled) return;
      setState({
        status: 'ready',
        capabilities: capabilities.status === 'fulfilled' ? capabilities.value || {} : {},
        permissions: permissions.status === 'fulfilled' && Array.isArray(permissions.value) ? permissions.value : [],
      });
    });

    return () => { cancelled = true; };
  }, [address, chainId, isConnected]);

  return useMemo(() => ({
    ...state,
    ...deriveWalletAcceleration(state.capabilities, chainId, state.permissions),
  }), [chainId, state]);
}
