import { useReadContract } from 'wagmi';
import { playerSummaryRead } from '../config/contracts';

export function usePlayerID(gameId, playerAddress) {
  const { data, isLoading, error } = useReadContract({
    ...playerSummaryRead('getPlayerID', [BigInt(gameId || 0), playerAddress]),
    query: {
      enabled: !!gameId && !!playerAddress,
    },
  });

  return {
    playerID: data,
    isLoading,
    error,
  };
}
