import { useMemo } from 'react';
import { useReadContracts } from './useContractReads';
import { playerSummaryRead } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function useCrewStats(gameId, playerIDs = []) {
  const gid = parseUintId(gameId);
  const normalizedPlayerIDs = useMemo(
    () => playerIDs
      .map((playerID) => parseUintId(playerID))
      .filter((playerID) => playerID !== null && playerID > 0n),
    [playerIDs],
  );
  const contracts = useMemo(
    () => normalizedPlayerIDs.map((playerID) => (
      playerSummaryRead('currentPlayerStats', [safeUintId(gid), playerID])
    )),
    [gid, normalizedPlayerIDs],
  );
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: gid !== null && contracts.length > 0,
      refetchInterval: 3000,
    },
  });

  const statsByPlayerID = useMemo(() => {
    const result = {};
    normalizedPlayerIDs.forEach((playerID, index) => {
      const stats = data?.[index]?.result;
      result[playerID.toString()] = {
        movement: Number(stats?.[0] ?? 0),
        agility: Number(stats?.[1] ?? 0),
        dexterity: Number(stats?.[2] ?? 0),
      };
    });
    return result;
  }, [data, normalizedPlayerIDs]);

  return { statsByPlayerID, isLoading, error, refetch };
}
