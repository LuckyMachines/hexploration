import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';

export function useLastPlayerActions(gameId) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('lastPlayerActions', [BigInt(gameId || 0)]),
    query: {
      enabled: !!gameId,
      refetchInterval: 5000,
    },
  });

  return {
    playerActions: data?.[0] ?? [],
    isLoading,
    error,
    refetch,
  };
}
