import { useReadContract } from 'wagmi';
import { gameSummaryRead, GAME_REGISTRY_ADDRESS } from '../config/contracts';

export function useAvailableGames() {
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('getAvailableGames', [GAME_REGISTRY_ADDRESS]),
    query: { refetchInterval: 10000 },
  });

  return {
    gameIDs: data?.[0] ?? [],
    maxPlayers: data?.[1] ?? [],
    currentRegistrations: data?.[2] ?? [],
    isLoading,
    error,
    refetch,
  };
}
