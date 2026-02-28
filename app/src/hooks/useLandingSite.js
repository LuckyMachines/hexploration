import { useReadContract } from './useContractRead';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function useLandingSite(gameId) {
  const gid = parseUintId(gameId);
  const { data, isLoading, error } = useReadContract({
    ...gameSummaryRead('landingSite', [safeUintId(gid)]),
    query: {
      enabled: gid !== null,
    },
  });

  return {
    zoneAlias: data ?? '',
    isLoading,
    error,
  };
}
