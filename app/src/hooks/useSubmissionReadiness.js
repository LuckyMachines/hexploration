import { useMemo } from 'react';
import { useReadContracts } from './useContractReads';
import { GAME_QUEUE_ADDRESS, QueueABI } from '../config/contracts';
import { parseUintId } from '../lib/ids';

export function useSubmissionReadiness(queueID, playerIDs = []) {
  const qid = parseUintId(queueID);
  const normalizedPlayerIDs = useMemo(
    () => playerIDs
      .map((pid) => parseUintId(pid))
      .filter((pid) => pid !== null),
    [playerIDs],
  );

  const contracts = useMemo(
    () => (qid !== null && qid > 0n
      ? normalizedPlayerIDs.map((pid) => ({
        address: GAME_QUEUE_ADDRESS,
        abi: QueueABI,
        functionName: 'playerSubmitted',
        args: [qid, pid],
      }))
      : []),
    [qid, normalizedPlayerIDs],
  );

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: contracts.length > 0
      ? contracts
      : [{
        address: GAME_QUEUE_ADDRESS,
        abi: QueueABI,
        functionName: 'playerSubmitted',
        args: [0n, 0n],
      }],
    query: {
      enabled: contracts.length > 0,
      refetchInterval: 3000,
    },
  });

  const readinessByPlayerID = useMemo(() => {
    const map = {};
    normalizedPlayerIDs.forEach((pid, index) => {
      map[pid.toString()] = data?.[index]?.result ?? false;
    });
    return map;
  }, [normalizedPlayerIDs, data]);

  return {
    readinessByPlayerID,
    isLoading,
    error,
    refetch,
  };
}
