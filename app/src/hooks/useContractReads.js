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
      const results = await client.multicall({ contracts });
      return results.map((r) => ({
        result: r.status === 'success' ? r.result : undefined,
        status: r.status,
        error: r.status === 'failure' ? r.error : undefined,
      }));
    },
    enabled: enabled && contracts.length > 0,
    refetchInterval,
    ...restQuery,
  });

  return {
    data: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}
