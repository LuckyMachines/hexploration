import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getActionMeta } from '../lib/actionMeta';
import { getGameOperation, submitGameCommand } from '../lib/gameAuthority';

const idleSimulation = { status: 'idle', estimatedGas: null, error: null };

export function useGameActions() {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ lifecycle: { phase: 'idle' }, isPending: false, isConfirming: false, isSuccess: false, error: null });
  const [simulation, setSimulation] = useState(idleSimulation);
  const pollTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(pollTimer.current), []);

  const finishWhenReady = useCallback(async (operationId) => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const result = await getGameOperation(operationId);
      if (result.status === 'complete') {
        setState({ lifecycle: { phase: 'confirmed', updatedAt: Date.now() }, isPending: false, isConfirming: false, isSuccess: true, error: null });
        await queryClient.invalidateQueries({ predicate: (query) => ['readContract', 'readContracts'].includes(query.queryKey[0]) });
        return operationId;
      }
      if (result.status === 'failed') throw new Error('The game could not complete that command. Your previous state is safe.');
      await new Promise((resolve) => { pollTimer.current = window.setTimeout(resolve, 1500); });
    }
    throw new Error('The game is still processing. It is safe to return and check again shortly.');
  }, [queryClient]);

  const submit = useCallback(async (kind, payload) => {
    setState({ lifecycle: { phase: 'simulating', updatedAt: Date.now() }, isPending: true, isConfirming: false, isSuccess: false, error: null });
    try {
      const result = await submitGameCommand(kind, payload);
      setState({ lifecycle: { phase: 'confirming', updatedAt: Date.now() }, isPending: false, isConfirming: true, isSuccess: false, error: null });
      return await finishWhenReady(result.operationId);
    } catch (error) {
      setState({ lifecycle: { phase: 'failed', error, updatedAt: Date.now() }, isPending: false, isConfirming: false, isSuccess: false, error });
      throw error;
    }
  }, [finishWhenReady]);

  const requestNewGame = (totalPlayers) => submit('create', { totalPlayers, requestId: crypto.randomUUID() });
  const registerForGame = (gameId) => submit('join', { gameId: String(gameId) });
  const submitAction = (playerID, actionIndex, options = [], leftHand = '', rightHand = '', gameID) => submit('action', {
    playerID: String(playerID), actionIndex, options, leftHand, rightHand, gameID: String(gameID), actionLabel: getActionMeta(actionIndex).label,
  });
  const simulateAction = async () => {
    const value = { status: 'ready', estimatedGas: null, error: null, preparedAt: Date.now() };
    setSimulation(value);
    return value;
  };
  const resetSimulation = () => setSimulation(idleSimulation);

  return { requestNewGame, registerForGame, submitAction, simulateAction, resetSimulation, simulation, ...state, hash: undefined, submissionMode: 'managed' };
}
