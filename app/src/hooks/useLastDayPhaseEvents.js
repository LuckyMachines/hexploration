import { useReadContract } from './useContractRead';
import { gameSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

/** @returns {{ playerIDs: bigint[], cardTypes: any[], cardsDrawn: any[], cardResults: any[], inventoryChanges: any[], statUpdates: any[], isLoading: boolean, error: Error|null, refetch: Function }} */
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
    playerIDs: Array.isArray(data?.[0]) ? data[0] : [],
    cardTypes: Array.isArray(data?.[1]) ? data[1] : [],
    cardsDrawn: Array.isArray(data?.[2]) ? data[2] : [],
    cardResults: Array.isArray(data?.[3]) ? data[3] : [],
    inventoryChanges: Array.isArray(data?.[4]) ? data[4] : [],
    statUpdates: Array.isArray(data?.[5]) ? data[5] : [],
    isLoading,
    error,
    refetch,
  };
}
