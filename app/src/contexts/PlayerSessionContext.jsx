import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { getPublicClient } from '../config/clients';
import { useWallet } from './WalletContext';
import {
  loadPendingTransactions,
  readSessionSnapshot,
  savePendingTransaction,
  saveSessionDocument,
  settlePendingTransaction,
  subscribeSessionChanges,
} from '../lib/sessionPersistence';
import { initialSessionState, normalizeSessionState, sessionReducer } from '../lib/sessionState';
import { isTransactionActive, TRANSACTION_PHASES } from '../lib/transactionExperience';

const PlayerSessionContext = createContext(null);

export function PlayerSessionProvider({ children }) {
  const { address } = useWallet();
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const skipNextSave = useRef(false);

  const restore = useCallback(async (fromAnotherTab = false) => {
    const snapshot = await readSessionSnapshot('player-session');
    if (fromAnotherTab) skipNextSave.current = true;
    dispatch({
      type: 'RESTORE',
      value: normalizeSessionState(snapshot || {}),
      wallet: address,
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      visible: typeof document === 'undefined' ? true : !document.hidden,
    });
    dispatch({ type: 'PENDING_TRANSACTIONS', transactions: loadPendingTransactions() });
  }, [address]);

  useEffect(() => {
    restore();
    const online = () => dispatch({ type: 'ONLINE' });
    const offline = () => dispatch({ type: 'OFFLINE' });
    const visibility = () => dispatch({ type: document.hidden ? 'HIDDEN' : 'VISIBLE' });
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visibility);
    const unsubscribe = subscribeSessionChanges((event) => {
      if (event.data?.type === 'snapshot' && event.data.key === 'player-session') restore(true);
      if (event.data?.type === 'transactions') {
        dispatch({ type: 'PENDING_TRANSACTIONS', transactions: loadPendingTransactions() });
      }
    });
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visibility);
      unsubscribe();
    };
  }, [restore]);

  useEffect(() => {
    if (state.phase === 'booting') return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveSessionDocument('player-session', state).catch(() => {});
  }, [state]);

  useEffect(() => {
    if (!address) return;
    dispatch({ type: 'WALLET', wallet: address });
  }, [address]);

  useEffect(() => {
    if (!state.online || !state.visible) return;
    let cancelled = false;
    const recover = async () => {
      const pending = loadPendingTransactions();
      for (const transaction of pending.filter((item) => (
        isTransactionActive(item.status)
        && item.hash
      ))) {
        try {
          const client = getPublicClient(transaction.chainId);
          const receipt = await client.getTransactionReceipt({ hash: transaction.hash });
          const latestBlock = await client.getBlockNumber();
          const confirmations = latestBlock >= receipt.blockNumber
            ? latestBlock - receipt.blockNumber + 1n
            : 0n;
          if (confirmations < 2n) continue;
          settlePendingTransaction(
            transaction.hash,
            receipt.status === 'success' ? TRANSACTION_PHASES.CONFIRMED : TRANSACTION_PHASES.REVERTED,
            undefined,
            { blockNumber: receipt.blockNumber?.toString?.(), confirmations: Number(confirmations), recovered: true },
          );
        } catch {
          const submittedAt = Date.parse(transaction.submittedAt || transaction.recordedAt || 0);
          if (submittedAt && Date.now() - submittedAt > 120_000 && transaction.status !== TRANSACTION_PHASES.UNRESOLVED) {
            settlePendingTransaction(transaction.hash, TRANSACTION_PHASES.UNRESOLVED, undefined, { recovered: true });
          }
        }
      }
      if (!cancelled) {
        dispatch({ type: 'PENDING_TRANSACTIONS', transactions: loadPendingTransactions() });
        if (state.phase === 'reconnecting') dispatch({ type: 'RESUME', preservePause: true });
      }
    };
    recover();
    const interval = window.setInterval(recover, 15_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [state.online, state.phase, state.visible]);

  const actions = useMemo(() => ({
    beginGame: (gameId) => dispatch({ type: 'BEGIN_GAME', gameId, online: state.online }),
    hydrated: (started) => dispatch({ type: 'HYDRATED', started }),
    ready: () => dispatch({ type: 'READY' }),
    terminal: () => dispatch({ type: 'TERMINAL' }),
    pause: () => dispatch({ type: 'PAUSE' }),
    resume: () => dispatch({ type: 'RESUME' }),
    setSaveStatus: (status) => dispatch({ type: 'SAVE_STATUS', status }),
    recordPendingTransaction: (transaction) => dispatch({ type: 'PENDING_TRANSACTIONS', transactions: savePendingTransaction(transaction) }),
    settleTransaction: (hash, status, details = {}) => dispatch({
      type: 'PENDING_TRANSACTIONS',
      transactions: settlePendingTransaction(hash, status, undefined, details),
    }),
  }), [state.online]);

  const value = useMemo(() => ({ state, ...actions }), [actions, state]);
  return <PlayerSessionContext.Provider value={value}>{children}</PlayerSessionContext.Provider>;
}

export function usePlayerSession() {
  const value = useContext(PlayerSessionContext);
  if (!value) throw new Error('usePlayerSession must be used within PlayerSessionProvider');
  return value;
}
