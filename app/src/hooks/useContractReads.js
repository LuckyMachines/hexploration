import { useQuery } from '@tanstack/react-query';
import { getPublicClient } from '../config/clients';
import { useWallet } from '../contexts/WalletContext';

export function useReadContracts({ contracts, query = {} }) {
  const { chainId } = useWallet();
  const { enabled = true, refetchInterval, ...restQuery } = query;

  const result = useQuery({
    queryKey: [
      'readContracts',
      chainId,
      contracts.map((c) => `${c.address}-${c.functionName}-${c.args?.map(String)}`),
    ],
    queryFn: async () => {
      const client = getPublicClient(chainId);
      return client.multicall({ contracts, allowFailure: true });
    },
    enabled: enabled && contracts.length > 0,
    refetchInterval: typeof refetchInterval === 'number'
      ? () => typeof document !== 'undefined' && document.hidden ? false : Math.max(refetchInterval, 15_000)
      : refetchInterval,
    ...restQuery,
  });

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}
