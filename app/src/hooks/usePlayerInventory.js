import { useReadContracts } from 'wagmi';
import { playerSummaryRead } from '../config/contracts';

export function usePlayerInventory(gameId, playerID) {
  const gid = BigInt(gameId || 0);
  const pid = BigInt(playerID || 0);

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      playerSummaryRead('activeInventory', [gid, pid]),
      playerSummaryRead('inactiveInventory', [gid, pid]),
    ],
    query: {
      enabled: !!gameId && !!playerID,
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
