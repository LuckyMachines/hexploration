import { useQuery } from '@tanstack/react-query';
import { getPublicClient } from '../config/clients';
import { useWallet } from '../contexts/WalletContext';

export function useReadContract({ address, abi, functionName, args, query = {} }) {
  const { chainId } = useWallet();
  const { enabled = true, refetchInterval, ...restQuery } = query;

  const result = useQuery({
    queryKey: ['readContract', chainId, address, functionName, args?.map(String)],
    queryFn: async () => {
      const client = getPublicClient(chainId);
      return client.readContract({ address, abi, functionName, args });
    },
    enabled: enabled && !!address,
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
