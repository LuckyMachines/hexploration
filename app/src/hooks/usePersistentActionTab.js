import { useCallback, useEffect, useState } from 'react';
import { Action } from '../lib/constants';

const STORAGE_PREFIX = 'xenovoya:action-tab:';

function storageKey(gameId, playerID) {
  return `${STORAGE_PREFIX}${gameId || 'unknown'}:${playerID || 'spectator'}`;
}

export function usePersistentActionTab(gameId, playerID) {
  const [activeTab, setActiveTabState] = useState(Action.MOVE);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(storageKey(gameId, playerID));
    const numeric = Number(saved);
    if (Number.isFinite(numeric) && Object.values(Action).includes(numeric)) {
      setActiveTabState(numeric);
    } else {
      setActiveTabState(Action.MOVE);
    }
  }, [gameId, playerID]);

  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey(gameId, playerID), String(tab));
    }
  }, [gameId, playerID]);

  return [activeTab, setActiveTab];
}

