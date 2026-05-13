import { useReadContract } from './useContractRead';
import { BOARD_ADDRESS, BoardABI } from '../config/contracts';
import { parseUintId, safeUintId } from '../lib/ids';

export function useGameOver(gameId) {
  const gid = parseUintId(gameId);
  const { data, isLoading, error, refetch } = useReadContract({
    address: BOARD_ADDRESS,
    abi: BoardABI,
    functionName: 'gameOver',
    args: [safeUintId(gid)],
    query: {
      enabled: gid !== null,
      refetchInterval: 5000,
    },
  });

  return {
    isGameOver: !!data,
    isLoading,
    error,
    refetch,
  };
}
