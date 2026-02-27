import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function useGamePhase(gameId) {
  const gid = parseUintId(gameId);
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('currentPhase', [safeUintId(gid)]),
    query: {
      enabled: gid !== null,
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
