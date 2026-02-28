import { useReadContract } from 'wagmi';
import { gameSummaryRead, GAME_REGISTRY_ADDRESS } from '../config/contracts';

/**
 * @typedef {{ gameIDs: bigint[], maxPlayers: bigint[], currentRegistrations: bigint[], isLoading: boolean, error: Error|null, refetch: Function }} AvailableGamesResult
 */

/** @returns {AvailableGamesResult} */
export function useAvailableGames() {
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('getAvailableGames', [GAME_REGISTRY_ADDRESS]),
    query: { refetchInterval: 10000 },
  });

  // getAvailableGames returns (uint256[], uint256[], uint256[]) — 3 parallel arrays
  return {
    gameIDs: Array.isArray(data?.[0]) ? data[0] : [],
    maxPlayers: Array.isArray(data?.[1]) ? data[1] : [],
    currentRegistrations: Array.isArray(data?.[2]) ? data[2] : [],
    isLoading,
    error,
    refetch,
  };
}
