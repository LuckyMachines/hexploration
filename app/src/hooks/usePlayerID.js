import { useReadContract } from 'wagmi';
import { playerSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function usePlayerID(gameId, playerAddress) {
  const gid = parseUintId(gameId);
  const { data, isLoading, error, refetch } = useReadContract({
    ...playerSummaryRead('getPlayerID', [safeUintId(gid), playerAddress]),
    query: {
      enabled: gid !== null && !!playerAddress,
      refetchInterval: 3000,
    },
  });

  return {
    playerID: data,
    isLoading,
    error,
    refetch,
  };
}
