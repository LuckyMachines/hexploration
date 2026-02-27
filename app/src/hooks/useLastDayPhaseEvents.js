import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function useLastDayPhaseEvents(gameId) {
  const gid = parseUintId(gameId);
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('lastDayPhaseEvents', [safeUintId(gid)]),
    query: {
      enabled: gid !== null,
      refetchInterval: 5000,
    },
  });

  return {
    playerIDs: data?.[0] ?? [],
    cardTypes: data?.[1] ?? [],
    cardsDrawn: data?.[2] ?? [],
    cardResults: data?.[3] ?? [],
    inventoryChanges: data?.[4] ?? [],
    statUpdates: data?.[5] ?? [],
    isLoading,
    error,
    refetch,
  };
}
