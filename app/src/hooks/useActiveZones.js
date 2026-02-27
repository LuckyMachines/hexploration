import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function useActiveZones(gameId) {
  const gid = parseUintId(gameId);
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('activeZones', [safeUintId(gid)]),
    query: {
      enabled: gid !== null,
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
