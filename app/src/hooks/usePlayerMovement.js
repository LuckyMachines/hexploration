import { useReadContract } from 'wagmi';
import { playerSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function usePlayerMovement(gameId, playerID) {
  const gid = parseUintId(gameId);
  const pid = parseUintId(playerID);
  const hasPlayerID = pid !== null && pid > 0n;
  const { data, isLoading, error, refetch } = useReadContract({
    ...playerSummaryRead('availableMovement', [safeUintId(gid), safeUintId(pid)]),
    query: {
      enabled: gid !== null && hasPlayerID,
      refetchInterval: 5000,
    },
  });

  return {
    movement: data !== undefined ? Number(data) : 0,
    isLoading,
    error,
    refetch,
  };
}
