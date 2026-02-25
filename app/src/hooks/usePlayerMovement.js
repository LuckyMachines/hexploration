import { useReadContract } from 'wagmi';
import { playerSummaryRead } from '../config/contracts';

export function usePlayerMovement(gameId, playerID) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...playerSummaryRead('availableMovement', [BigInt(gameId || 0), BigInt(playerID || 0)]),
    query: {
      enabled: !!gameId && !!playerID,
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
