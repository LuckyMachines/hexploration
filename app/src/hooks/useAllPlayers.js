import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function useAllPlayers(gameId) {
  const gid = parseUintId(gameId);
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('allPlayers', [safeUintId(gid)]),
    query: {
      enabled: gid !== null,
      refetchInterval: 5000,
    },
  });

  return {
    players: data?.[0] ?? [],
    isLoading,
    error,
    refetch,
  };
}
