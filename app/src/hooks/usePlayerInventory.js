import { useReadContracts } from './useContractReads';
import { playerSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function usePlayerInventory(gameId, playerID) {
  const gid = parseUintId(gameId);
  const pid = parseUintId(playerID);
  const hasPlayerID = pid !== null && pid > 0n;

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      playerSummaryRead('activeInventory', [safeUintId(gid), safeUintId(pid)]),
      playerSummaryRead('inactiveInventory', [safeUintId(gid), safeUintId(pid)]),
    ],
    query: {
      enabled: gid !== null && hasPlayerID,
      refetchInterval: 5000,
    },
  });

  const active = data?.[0]?.result;
  const inactive = data?.[1]?.result;

  return {
    active: active ? {
      artifact: active[0] || '',
      status: active[1] || '',
      relic: active[2] || '',
      shield: active[3] ?? false,
      campsite: active[4] ?? false,
      leftHandItem: active[5] || '',
      rightHandItem: active[6] || '',
    } : {
      artifact: '', status: '', relic: '',
      shield: false, campsite: false,
      leftHandItem: '', rightHandItem: '',
    },
    inactive: inactive ? {
      itemTypes: inactive[0] ?? [],
      itemBalances: inactive[1] ?? [],
    } : {
      itemTypes: [],
      itemBalances: [],
    },
    isLoading,
    error,
    refetch,
  };
}
