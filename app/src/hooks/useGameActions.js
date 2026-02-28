import { useContractWrite } from './useContractWrite';
import {
  ControllerABI,
  CONTROLLER_ADDRESS,
  BOARD_ADDRESS,
  GAME_REGISTRY_ADDRESS,
} from '../config/contracts';

export function useGameActions() {
  const { writeContractAsync, data: hash, isPending, isConfirming, isSuccess, error } = useContractWrite();

  const requestNewGame = (totalPlayers) =>
    writeContractAsync({
      address: CONTROLLER_ADDRESS,
      abi: ControllerABI,
      functionName: 'requestNewGame',
      args: [GAME_REGISTRY_ADDRESS, BOARD_ADDRESS, BigInt(totalPlayers)],
    });

  const registerForGame = (gameId) =>
    writeContractAsync({
      address: CONTROLLER_ADDRESS,
      abi: ControllerABI,
      functionName: 'registerForGame',
      args: [BigInt(gameId), BOARD_ADDRESS],
    });

  const submitAction = (playerID, actionIndex, options = [], leftHand = '', rightHand = '', gameID) =>
    writeContractAsync({
      address: CONTROLLER_ADDRESS,
      abi: ControllerABI,
      functionName: 'submitAction',
      args: [BigInt(playerID), actionIndex, options, leftHand, rightHand, BigInt(gameID), BOARD_ADDRESS],
    });

  return {
    requestNewGame,
    registerForGame,
    submitAction,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
