import { useReadContracts } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';

export function useGameState(gameId) {
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      gameSummaryRead('gameStarted', [BigInt(gameId || 0)]),
      gameSummaryRead('currentPhase', [BigInt(gameId || 0)]),
    ],
    query: {
      enabled: !!gameId,
      refetchInterval: 5000,
    },
  });

  return {
    gameStarted: data?.[0]?.result ?? false,
    currentPhase: data?.[1]?.result ?? '',
    isLoading,
    error,
    refetch,
  };
}
