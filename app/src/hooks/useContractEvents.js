import { useEffect, useMemo, useState } from 'react';
import { getPublicClient } from '../config/clients';
import { useWallet } from '../contexts/WalletContext';

export function usePublicClient() {
  const { readChainId: chainId } = useWallet();
  return useMemo(() => getPublicClient(chainId), [chainId]);
}

export function useWatchContractEvent({ address, abi, eventName, events, args, enabled = true, onLogs, onError }) {
  const publicClient = usePublicClient();
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (!enabled || !visible || !publicClient || !address) return;

    const shared = { address, onLogs, onError, poll: true, pollingInterval: 4_000 };
    const unwatch = events?.length
      ? publicClient.watchEvent({ ...shared, events })
      : publicClient.watchContractEvent({ ...shared, abi, eventName, args });

    return unwatch;
  }, [publicClient, address, abi, eventName, events, args, enabled, visible, onLogs, onError]);
}
