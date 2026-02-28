import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

/**
 * @typedef {{ zones: string[], tiles: bigint[], campsites: boolean[], isLoading: boolean, error: Error|null, refetch: Function }} ActiveZonesResult
 */

/** @returns {ActiveZonesResult} */
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
    zones: Array.isArray(data?.[0]) ? data[0] : [],
    tiles: Array.isArray(data?.[1]) ? data[1] : [],
    campsites: Array.isArray(data?.[2]) ? data[2] : [],
    isLoading,
    error,
    refetch,
  };
}
