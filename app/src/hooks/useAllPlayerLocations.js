import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

/**
 * @typedef {{ playerIDs: bigint[], playerZones: string[], isLoading: boolean, error: Error|null, refetch: Function }} AllPlayerLocationsResult
 */

/** @returns {AllPlayerLocationsResult} */
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
    playerIDs: Array.isArray(data?.[0]) ? data[0] : [],
    playerZones: Array.isArray(data?.[1]) ? data[1] : [],
    isLoading,
    error,
    refetch,
  };
}
