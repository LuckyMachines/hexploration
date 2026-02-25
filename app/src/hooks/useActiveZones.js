import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';

export function useActiveZones(gameId) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('activeZones', [BigInt(gameId || 0)]),
    query: {
      enabled: !!gameId,
      refetchInterval: 5000,
    },
  });

  return {
    zones: data?.[0] ?? [],
    tiles: data?.[1] ?? [],
    campsites: data?.[2] ?? [],
    isLoading,
    error,
    refetch,
  };
}
