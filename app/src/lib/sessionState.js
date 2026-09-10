export const SESSION_PHASES = Object.freeze(['booting', 'hydrating', 'lobby', 'ready', 'active', 'backgrounded', 'reconnecting', 'resumed', 'terminal']);

export const initialSessionState = Object.freeze({
  schemaVersion: 1,
  phase: 'booting',
  online: true,
  visible: true,
  softPaused: false,
  wallet: null,
  activeGameId: null,
  saveStatus: 'local',
  lastSavedAt: null,
  lastResumedAt: null,
  pendingTransactions: [],
  resumeSteps: [],
});

export function normalizeSessionState(value = {}) {
  const phase = SESSION_PHASES.includes(value.phase) ? value.phase : 'booting';
  return {
    ...initialSessionState,
    ...value,
    schemaVersion: 1,
    phase,
    wallet: typeof value.wallet === 'string' ? value.wallet.toLowerCase() : null,
    activeGameId: value.activeGameId ? String(value.activeGameId) : null,
    pendingTransactions: Array.isArray(value.pendingTransactions) ? value.pendingTransactions.slice(-20) : [],
    resumeSteps: Array.isArray(value.resumeSteps) ? value.resumeSteps.slice(-8) : [],
  };
}

export function sessionReducer(state, action) {
  const at = action.at || new Date().toISOString();
  switch (action.type) {
    case 'RESTORE': {
      const restored = normalizeSessionState(action.value);
      const wallet = action.wallet?.toLowerCase() || restored.wallet;
      const walletChanged = Boolean(restored.wallet && action.wallet && restored.wallet !== action.wallet.toLowerCase());
      const value = walletChanged ? { ...initialSessionState, wallet } : { ...restored, wallet };
      return { ...value, online: action.online, visible: action.visible, phase: action.online ? 'resumed' : 'reconnecting', lastResumedAt: at };
    }
    case 'WALLET': {
      const wallet = action.wallet?.toLowerCase() || null;
      if (!wallet || wallet === state.wallet) return state;
      if (!state.wallet) return { ...state, wallet };
      return { ...initialSessionState, wallet, online: state.online, visible: state.visible, phase: 'resumed', lastResumedAt: at };
    }
    case 'BEGIN_GAME': return { ...state, activeGameId: String(action.gameId), phase: action.online ? 'hydrating' : 'reconnecting', resumeSteps: ['identity', 'party', 'chain'] };
    case 'HYDRATED': return { ...state, phase: action.started ? 'active' : 'lobby', resumeSteps: [] };
    case 'READY': return { ...state, phase: 'ready' };
    case 'TERMINAL': return { ...state, phase: 'terminal', softPaused: false };
    case 'ONLINE': return { ...state, online: true, phase: state.activeGameId ? 'reconnecting' : state.phase };
    case 'OFFLINE': return { ...state, online: false, phase: state.activeGameId ? 'reconnecting' : state.phase, saveStatus: 'queued' };
    case 'HIDDEN': return { ...state, visible: false, phase: state.activeGameId ? 'backgrounded' : state.phase };
    case 'VISIBLE': return { ...state, visible: true, phase: state.activeGameId ? 'reconnecting' : state.phase };
    case 'PAUSE': return { ...state, softPaused: true };
    case 'RESUME': return { ...state, softPaused: false, phase: state.activeGameId ? 'resumed' : state.phase, lastResumedAt: at };
    case 'SAVE_STATUS': return { ...state, saveStatus: action.status, lastSavedAt: action.status === 'cloud' || action.status === 'local' ? at : state.lastSavedAt };
    case 'PENDING_TRANSACTIONS': return { ...state, pendingTransactions: action.transactions.slice(-20) };
    default: return state;
  }
}
