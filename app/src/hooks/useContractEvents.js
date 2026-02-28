import { useEffect, useMemo } from 'react';
import { getPublicClient } from '../config/clients';
import { useWallet } from '../contexts/WalletContext';

export function usePublicClient() {
  const { chainId } = useWallet();
  return useMemo(() => getPublicClient(chainId), [chainId]);
}

export function useWatchContractEvent({ address, abi, eventName, enabled = true, onLogs }) {
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!enabled || !publicClient || !address) return;

    const unwatch = publicClient.watchContractEvent({
      address,
      abi,
      eventName,
      onLogs,
    });

    return unwatch;
  }, [publicClient, address, abi, eventName, enabled, onLogs]);
}
