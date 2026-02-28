import { useReadContracts } from './useContractReads';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function useGameState(gameId) {
  const gid = parseUintId(gameId);
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      gameSummaryRead('gameStarted', [safeUintId(gid)]),
      gameSummaryRead('currentPhase', [safeUintId(gid)]),
    ],
    query: {
      enabled: gid !== null,
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
