import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function useAllPlayerLocations(gameId) {
  const gid = parseUintId(gameId);
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('allPlayerLocations', [safeUintId(gid)]),
    query: {
      enabled: gid !== null,
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
