import { useReadContract } from 'wagmi';
import { playerSummaryRead } from '../config/contracts';

export function usePlayerStats(gameId, playerID) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...playerSummaryRead('currentPlayerStats', [BigInt(gameId || 0), BigInt(playerID || 0)]),
    query: {
      enabled: !!gameId && !!playerID,
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
