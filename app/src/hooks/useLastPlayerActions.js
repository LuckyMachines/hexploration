import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

/** @returns {{ playerActions: any[], isLoading: boolean, error: Error|null, refetch: Function }} */
export function useLastPlayerActions(gameId) {
  const gid = parseUintId(gameId);
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('lastPlayerActions', [safeUintId(gid)]),
    query: {
      enabled: gid !== null,
      refetchInterval: 5000,
    },
  });

  return {
    playerActions: Array.isArray(data?.[0]) ? data[0] : [],
    isLoading,
    error,
    refetch,
  };
}
