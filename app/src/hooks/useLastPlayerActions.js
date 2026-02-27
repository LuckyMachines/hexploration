import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

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
    playerActions: data?.[0] ?? [],
    isLoading,
    error,
    refetch,
  };
}
