import { useReadContract, useReadContracts } from 'wagmi';
import {
  gameSummaryRead,
  GAME_QUEUE_ADDRESS,
  QueueABI,
} from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function useQueueTelemetry(gameId) {
  const gid = parseUintId(gameId);

  const { data: queueData, isLoading: loadingQueueID } = useReadContract({
    ...gameSummaryRead('currentGameplayQueue', [safeUintId(gid)]),
    query: {
      enabled: gid !== null,
      refetchInterval: 3000,
    },
  });

  const queueID = queueData ?? 0n;
  const hasActiveQueue = queueID > 0n;

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      {
        address: GAME_QUEUE_ADDRESS,
        abi: QueueABI,
        functionName: 'currentPhase',
        args: [queueID],
      },
      {
        address: GAME_QUEUE_ADDRESS,
        abi: QueueABI,
        functionName: 'totalPlayers',
        args: [queueID],
      },
      {
        address: GAME_QUEUE_ADDRESS,
        abi: QueueABI,
        functionName: 'getAllPlayers',
        args: [queueID],
      },
      {
        address: GAME_QUEUE_ADDRESS,
        abi: QueueABI,
        functionName: 'getRandomness',
        args: [queueID],
      },
    ],
    query: {
      enabled: gid !== null && hasActiveQueue,
      refetchInterval: 3000,
    },
  });

  const phase = data?.[0]?.result !== undefined ? Number(data[0].result) : 0;
  const totalPlayers = data?.[1]?.result !== undefined ? Number(data[1].result) : 0;
  const submittedPlayers = data?.[2]?.result ?? [];
  const randomness = data?.[3]?.result ?? [];

  return {
    queueID,
    phase,
    totalPlayers,
    submittedPlayers,
    submittedCount: submittedPlayers.length,
    randomnessCount: randomness.length,
    hasActiveQueue,
    hasRandomness: randomness.length > 0,
    isLoading: loadingQueueID || isLoading,
    error,
    refetch,
  };
}
