import { useReadContract } from 'wagmi';
import { GameSummaryABI, GAME_SUMMARY_ADDRESS, BOARD_ADDRESS } from '../config/contracts';

export function useBoardSize() {
  const { data, isLoading, error } = useReadContract({
    address: GAME_SUMMARY_ADDRESS,
    abi: GameSummaryABI,
    functionName: 'boardSize',
    args: [BOARD_ADDRESS],
  });

  return {
    rows: data ? Number(data[0]) : 0,
    columns: data ? Number(data[1]) : 0,
    isLoading,
    error,
  };
}
