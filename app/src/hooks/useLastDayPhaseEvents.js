import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../config/contracts';

export function useLastDayPhaseEvents(gameId) {
  const { data, isLoading, error, refetch } = useReadContract({
    ...gameSummaryRead('lastDayPhaseEvents', [BigInt(gameId || 0)]),
    query: {
      enabled: !!gameId,
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
