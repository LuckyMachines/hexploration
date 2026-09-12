import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createWalletClient, custom } from 'viem';
import { getPublicClient } from '../config/clients';
import { useWallet } from '../contexts/WalletContext';
import { getChainById } from '../config/chains';
import { usePlayerSession } from '../contexts/PlayerSessionContext';
import {
  normalizeTransactionError,
  TRANSACTION_PHASES,
  transactionRequestKey,
} from '../lib/transactionExperience';

const freshEnough = (prepared) => prepared && Date.now() - prepared.preparedAt < 15_000;

export function useContractWrite() {
  const { address, chainId } = useWallet();
  const { recordPendingTransaction, settleTransaction } = usePlayerSession();
  const queryClient = useQueryClient();
  const [hash, setHash] = useState(undefined);
  const [isPending, setIsPending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [simulation, setSimulation] = useState({ status: 'idle', estimatedGas: null, error: null });
  const [lifecycle, setLifecycle] = useState({ phase: TRANSACTION_PHASES.IDLE, updatedAt: null });
  const preparedRef = useRef(null);
  const simulationSequence = useRef(0);

  const simulateContractAsync = useCallback(async (request) => {
    if (!address) throw new Error('Connect the registered player wallet before preparing this action.');
    if (!chainId) throw new Error('Select the expedition network before preparing this action.');

    const sequence = ++simulationSequence.current;
    const requestKey = transactionRequestKey(request);
    setSimulation({ status: 'checking', requestKey, estimatedGas: null, error: null });
    setLifecycle({ phase: TRANSACTION_PHASES.SIMULATING, updatedAt: Date.now() });

    try {
      const publicClient = getPublicClient(chainId);
      const prepared = await publicClient.simulateContract({ ...request, account: address });
      let estimatedGas = null;
      try {
        estimatedGas = await publicClient.estimateContractGas({ ...request, account: address });
      } catch { /* simulation already proves execution; gas is optional */ }

      const value = { ...prepared, requestKey, estimatedGas, preparedAt: Date.now() };
      if (sequence === simulationSequence.current) {
        preparedRef.current = value;
        setSimulation({ status: 'ready', requestKey, estimatedGas, error: null, preparedAt: value.preparedAt });
        setLifecycle({ phase: TRANSACTION_PHASES.READY, updatedAt: Date.now() });
      }
      return value;
    } catch (simulationError) {
      if (sequence === simulationSequence.current) {
        preparedRef.current = null;
        setSimulation({
          status: 'blocked',
          requestKey,
          estimatedGas: null,
          error: normalizeTransactionError(simulationError),
        });
        setLifecycle({ phase: TRANSACTION_PHASES.FAILED, updatedAt: Date.now() });
      }
      throw simulationError;
    }
  }, [address, chainId]);

  const resetSimulation = useCallback(() => {
    simulationSequence.current += 1;
    preparedRef.current = null;
    setSimulation({ status: 'idle', estimatedGas: null, error: null });
    setLifecycle((current) => current.phase === TRANSACTION_PHASES.CONFIRMING
      ? current
      : { phase: TRANSACTION_PHASES.IDLE, updatedAt: Date.now() });
  }, []);

  const writeContractAsync = useCallback(async (request, metadata = {}) => {
    setError(null);
    setIsSuccess(false);
    setHash(undefined);
    setIsPending(true);

    let txHash;
    const requestKey = transactionRequestKey(request);
    try {
      const chain = getChainById(chainId);
      if (!chain || !address || !window.ethereum) throw new Error('Connect the registered wallet on the expedition network.');
      const cached = preparedRef.current;
      const prepared = cached?.requestKey === requestKey && freshEnough(cached)
        ? cached
        : await simulateContractAsync(request);

      setLifecycle({ phase: TRANSACTION_PHASES.AWAITING_SIGNATURE, updatedAt: Date.now() });
      const walletClient = createWalletClient({
        account: address,
        chain,
        transport: custom(window.ethereum),
      });

      txHash = await walletClient.writeContract(prepared.request || request);
      const submittedAt = new Date().toISOString();
      setHash(txHash);
      setLifecycle({ phase: TRANSACTION_PHASES.SUBMITTED, hash: txHash, chainId, updatedAt: Date.now() });
      recordPendingTransaction({
        hash: txHash,
        originalHash: txHash,
        chainId,
        account: address.toLowerCase(),
        action: request.functionName,
        status: TRANSACTION_PHASES.CONFIRMING,
        submittedAt,
        estimatedGas: prepared.estimatedGas?.toString?.() || null,
        ...metadata,
      });
      setIsPending(false);
      setIsConfirming(true);
      setLifecycle({ phase: TRANSACTION_PHASES.CONFIRMING, hash: txHash, chainId, updatedAt: Date.now() });

      const publicClient = getPublicClient(chainId);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 2,
        timeout: 120_000,
        onReplaced: ({ reason, transaction: replacement }) => {
          const replacementHash = replacement?.hash;
          if (!replacementHash) return;
          const previousHash = txHash;
          settleTransaction(previousHash, TRANSACTION_PHASES.REPLACED, { replacementHash, replacementReason: reason });
          txHash = replacementHash;
          setHash(txHash);
          setLifecycle({ phase: TRANSACTION_PHASES.REPLACED, hash: txHash, replacedHash: previousHash, chainId, updatedAt: Date.now() });
          recordPendingTransaction({
            hash: txHash,
            originalHash: previousHash,
            chainId,
            account: address.toLowerCase(),
            action: request.functionName,
            status: TRANSACTION_PHASES.CONFIRMING,
            submittedAt,
            replacementReason: reason,
            ...metadata,
          });
        },
      });

      if (receipt.status !== 'success') throw new Error('Transaction reverted before confirmation.');

      setIsConfirming(false);
      setIsSuccess(true);
      settleTransaction(txHash, TRANSACTION_PHASES.CONFIRMED, {
        blockNumber: receipt.blockNumber?.toString?.(),
        transactionIndex: receipt.transactionIndex,
        confirmedAt: new Date().toISOString(),
      });
      setLifecycle({ phase: TRANSACTION_PHASES.CONFIRMED, hash: txHash, blockNumber: receipt.blockNumber, chainId, updatedAt: Date.now() });
      preparedRef.current = null;
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'readContract' || query.queryKey[0] === 'readContracts' });
      return txHash;
    } catch (caught) {
      setIsPending(false);
      setIsConfirming(false);
      setError(caught);
      const normalized = normalizeTransactionError(caught);
      const recoverableBroadcast = Boolean(txHash && ['timeout', 'network'].includes(normalized?.code));
      const failurePhase = recoverableBroadcast
        ? TRANSACTION_PHASES.UNRESOLVED
        : normalized?.code === 'reverted'
          ? TRANSACTION_PHASES.REVERTED
          : TRANSACTION_PHASES.FAILED;
      if (txHash) settleTransaction(txHash, failurePhase, { error: normalized });
      setLifecycle({
        phase: failurePhase,
        hash: txHash,
        chainId,
        error: normalized,
        updatedAt: Date.now(),
      });
      throw caught;
    }
  }, [address, chainId, queryClient, recordPendingTransaction, settleTransaction, simulateContractAsync]);

  return {
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
  };
}
