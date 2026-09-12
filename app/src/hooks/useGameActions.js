import { useState } from 'react';
import { useContractWrite } from './useContractWrite';
import {
  ControllerABI,
  CONTROLLER_ADDRESS,
  BOARD_ADDRESS,
  GAME_REGISTRY_ADDRESS,
} from '../config/contracts';
import { getActionMeta } from '../lib/actionMeta';

export function useGameActions({ sponsoredSession } = {}) {
  const [submissionMode, setSubmissionMode] = useState('direct');
  const {
    writeContractAsync,
    simulateContractAsync,
    resetSimulation,
    simulation,
    lifecycle,
    data: hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  } = useContractWrite();

  const newGameRequest = (totalPlayers) => ({
    address: CONTROLLER_ADDRESS,
    abi: ControllerABI,
    functionName: 'requestNewGame',
    args: [GAME_REGISTRY_ADDRESS, BOARD_ADDRESS, BigInt(totalPlayers)],
  });

  const registrationRequest = (gameId) => ({
    address: CONTROLLER_ADDRESS,
    abi: ControllerABI,
    functionName: 'registerForGame',
    args: [BigInt(gameId), BOARD_ADDRESS],
  });

  const actionRequest = (playerID, actionIndex, options = [], leftHand = '', rightHand = '', gameID) => ({
    address: CONTROLLER_ADDRESS,
    abi: ControllerABI,
    functionName: 'submitAction',
    args: [BigInt(playerID), actionIndex, options, leftHand, rightHand, BigInt(gameID), BOARD_ADDRESS],
  });

  const requestNewGame = (totalPlayers) => {
    setSubmissionMode('direct');
    return writeContractAsync(newGameRequest(totalPlayers), { actionLabel: 'Create expedition' });
  };

  const registerForGame = (gameId) => {
    setSubmissionMode('direct');
    return writeContractAsync(registrationRequest(gameId), { gameId: String(gameId), actionLabel: 'Join expedition' });
  };

  const submitAction = (playerID, actionIndex, options = [], leftHand = '', rightHand = '', gameID) => {
    if (sponsoredSession?.isReady) {
      setSubmissionMode('sponsored');
      return sponsoredSession.submitAction(actionIndex, options, leftHand, rightHand);
    }
    setSubmissionMode('direct');
    return writeContractAsync(
      actionRequest(playerID, actionIndex, options, leftHand, rightHand, gameID),
      { gameId: String(gameID), playerID: String(playerID), actionIndex, actionLabel: getActionMeta(actionIndex).label },
    );
  };

  const simulateAction = (playerID, actionIndex, options = [], leftHand = '', rightHand = '', gameID) =>
    simulateContractAsync(actionRequest(playerID, actionIndex, options, leftHand, rightHand, gameID));

  const sponsoredSubmission = sponsoredSession?.submission;
  const selected = submissionMode === 'sponsored' && sponsoredSubmission
    ? sponsoredSubmission
    : { lifecycle, hash, isPending, isConfirming, isSuccess, error };

  return {
    requestNewGame,
    registerForGame,
    submitAction,
    simulateAction,
    resetSimulation,
    simulation,
    lifecycle: selected.lifecycle,
    hash: selected.hash,
    isPending: selected.isPending,
    isConfirming: selected.isConfirming,
    isSuccess: selected.isSuccess,
    error: selected.error,
    submissionMode,
  };
}
