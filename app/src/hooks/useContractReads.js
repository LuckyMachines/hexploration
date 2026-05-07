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
      const results = await Promise.allSettled(
        contracts.map((contract) =>
          client.readContract(contract).then((result) => ({
            status: 'success',
            result,
          })),
        ),
      );

      return results.map((settled) => {
        if (settled.status === 'fulfilled') {
          return settled.value;
        }

        return {
          status: 'failure',
          result: undefined,
          error: settled.reason,
        };
      });
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
