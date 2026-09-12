import { useQuery } from '@tanstack/react-query';
import { getPublicClient } from '../config/clients';
import { useWallet } from '../contexts/WalletContext';

export async function readContractsInParallel(client, contracts, allowFailure = true) {
  return Promise.all(contracts.map(async (contract) => {
    try {
      return {
        result: await client.readContract(contract),
        status: 'success',
      };
    } catch (error) {
      if (!allowFailure) throw error;

      return {
        error,
        result: undefined,
        status: 'failure',
      };
    }
  }));
}

export function useReadContracts({ contracts, query = {} }) {
  const { readChainId: chainId } = useWallet();
  const { enabled = true, refetchInterval, ...restQuery } = query;

  const result = useQuery({
    queryKey: [
      'readContracts',
      chainId,
      contracts.map((c) => `${c.address}-${c.functionName}-${c.args?.map(String)}`),
    ],
    queryFn: async () => {
      const client = getPublicClient(chainId);
      // Custom and local chains do not always publish a Multicall3 address. Direct,
      // concurrent reads avoid an RPC request that can wait indefinitely for a
      // non-existent aggregate contract while retaining viem's result envelope.
      return readContractsInParallel(client, contracts, true);
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
