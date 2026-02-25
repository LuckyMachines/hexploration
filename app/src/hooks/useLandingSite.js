import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';

export function useLandingSite(gameId) {
  const { data, isLoading, error } = useReadContract({
    ...gameSummaryRead('landingSite', [BigInt(gameId || 0)]),
    query: {
      enabled: !!gameId,
    },
  });

  return {
    zoneAlias: data ?? '',
    isLoading,
    error,
  };
}
