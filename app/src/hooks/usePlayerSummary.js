import { useReadContracts } from 'wagmi';
import { playerSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function usePlayerSummary(gameId, playerID) {
  const gid = parseUintId(gameId);
  const pid = parseUintId(playerID);
  const hasPlayerID = pid !== null && pid > 0n;

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      playerSummaryRead('isRegistered', [safeUintId(gid)]),
      playerSummaryRead('isActive', [safeUintId(gid), safeUintId(pid)]),
      playerSummaryRead('currentLocation', [safeUintId(gid), safeUintId(pid)]),
      playerSummaryRead('currentPlayerStats', [safeUintId(gid), safeUintId(pid)]),
      playerSummaryRead('activeAction', [safeUintId(gid), safeUintId(pid)]),
    ],
    query: {
      enabled: gid !== null && hasPlayerID,
      refetchInterval: 5000,
    },
  });

  const stats = data?.[3]?.result;

  return {
    isRegistered: data?.[0]?.result ?? false,
    isActive: data?.[1]?.result ?? false,
    location: data?.[2]?.result ?? '',
    stats: stats ? {
      movement: Number(stats[0] ?? 0),
      agility: Number(stats[1] ?? 0),
      dexterity: Number(stats[2] ?? 0),
    } : { movement: 0, agility: 0, dexterity: 0 },
    action: data?.[4]?.result ?? '',
    isLoading,
    error,
    refetch,
  };
}
