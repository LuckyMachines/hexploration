import { useReadContract } from './useContractRead';
import { playerSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function usePlayerStats(gameId, playerID) {
  const gid = parseUintId(gameId);
  const pid = parseUintId(playerID);
  const hasPlayerID = pid !== null && pid > 0n;
  const { data, isLoading, error, refetch } = useReadContract({
    ...playerSummaryRead('currentPlayerStats', [safeUintId(gid), safeUintId(pid)]),
    query: {
      enabled: gid !== null && hasPlayerID,
      refetchInterval: 5000,
    },
  });

  return {
    movement: data ? Number(data[0]) : 0,
    agility: data ? Number(data[1]) : 0,
    dexterity: data ? Number(data[2]) : 0,
    isLoading,
    error,
    refetch,
  };
}
