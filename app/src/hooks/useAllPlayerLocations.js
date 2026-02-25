import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';

export function useAllPlayerLocations(gameId) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('allPlayerLocations', [BigInt(gameId || 0)]),
    query: {
      enabled: !!gameId,
      refetchInterval: 5000,
    },
  });

  return {
    playerIDs: data?.[0] ?? [],
    playerZones: data?.[1] ?? [],
    isLoading,
    error,
    refetch,
  };
}
