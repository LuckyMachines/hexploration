import { useReadContracts } from 'wagmi';
import { playerSummaryRead } from '../config/contracts';

export function usePlayerSummary(gameId, playerID) {
  const gid = BigInt(gameId || 0);
  const pid = BigInt(playerID || 0);

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      playerSummaryRead('isRegistered', [gid]),
      playerSummaryRead('isActive', [gid, pid]),
      playerSummaryRead('currentLocation', [gid, pid]),
      playerSummaryRead('currentPlayerStats', [gid, pid]),
      playerSummaryRead('activeAction', [gid, pid]),
    ],
    query: {
      enabled: !!gameId && !!playerID,
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
