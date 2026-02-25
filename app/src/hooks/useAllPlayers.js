import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';

export function useAllPlayers(gameId) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('allPlayers', [BigInt(gameId || 0)]),
    query: {
      enabled: !!gameId,
      refetchInterval: 5000,
    },
  });

  return {
    players: data?.[0] ?? [],
    isLoading,
    error,
    refetch,
  };
}
