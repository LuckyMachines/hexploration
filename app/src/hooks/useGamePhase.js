import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';

export function useGamePhase(gameId) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('currentPhase', [BigInt(gameId || 0)]),
    query: {
      enabled: !!gameId,
      refetchInterval: 5000,
    },
  });

  return {
    phase: data ?? '',
    isDay: data === 'Day',
    isNight: data === 'Night',
    isLoading,
    error,
    refetch,
  };
}
