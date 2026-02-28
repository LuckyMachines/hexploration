import { useReadContracts } from './useContractReads';
import {
  GAME_SETUP_ADDRESS,
  GAME_QUEUE_ADDRESS,
  GameSetupABI,
  QueueABI,
} from '../config/contracts';

export function useAutomationStatus() {
  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: GAME_SETUP_ADDRESS,
        abi: GameSetupABI,
        functionName: 'useMockVRF',
      },
      {
        address: GAME_QUEUE_ADDRESS,
        abi: QueueABI,
        functionName: 'useMockVRF',
      },
      {
        address: GAME_SETUP_ADDRESS,
        abi: GameSetupABI,
        functionName: 'getMockRequests',
      },
      {
        address: GAME_QUEUE_ADDRESS,
        abi: QueueABI,
        functionName: 'getMockRequests',
      },
    ],
    query: { refetchInterval: 10000 },
  });

  const setupMock = data?.[0]?.result ?? false;
  const queueMock = data?.[1]?.result ?? false;
  const setupReqs = Array.isArray(data?.[2]?.result) ? data[2].result : [];
  const queueReqs = Array.isArray(data?.[3]?.result) ? data[3].result : [];

  const pendingRequests =
    setupReqs.filter((r) => r > 0n).length +
    queueReqs.filter((r) => r > 0n).length;

  let mode = 'mismatch';
  if (setupMock && queueMock) mode = 'mock';
  if (setupMock && !queueMock) mode = 'external-queue';
  if (!setupMock && !queueMock) mode = 'external';

  return { mode, pendingRequests, isLoading };
}
