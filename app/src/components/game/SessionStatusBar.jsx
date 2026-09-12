import { usePlayerSession } from '../../contexts/PlayerSessionContext';
import TransactionRecoveryCenter from '../shared/TransactionRecoveryCenter';

const labels = {
  booting: 'Restoring player', hydrating: 'Loading expedition', lobby: 'Lobby ready', ready: 'Crew ready', active: 'Expedition live',
  backgrounded: 'Running in background', reconnecting: 'Reconnecting safely', resumed: 'Session restored', terminal: 'Expedition recorded',
};

export default function SessionStatusBar() {
  const { state, pause, resume } = usePlayerSession();
  const saveLabel = state.saveStatus === 'cloud' ? 'Cloud confirmed' : state.saveStatus === 'syncing' ? 'Syncing' : state.saveStatus === 'queued' ? 'Saved locally - sync queued' : 'Saved locally';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-exp-border bg-exp-dark/45 px-4 py-3" role="status" aria-live="polite">
      <div className="flex min-w-0 flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em]">
        <span className={state.online ? 'text-oxide-green' : 'text-signal-red'}>{state.online ? 'Online' : 'Offline'}</span>
        <span className="text-exp-text">{state.softPaused ? 'Focus paused - world continues' : labels[state.phase]}</span>
        <span className="text-exp-text-dim">{saveLabel}</span>
        {state.pendingTransactions.some((item) => item.status === 'confirming') && <span className="text-compass-bright">Action confirming</span>}
      </div>
      {state.activeGameId && state.phase !== 'terminal' && (
        <button type="button" onClick={state.softPaused ? resume : pause} className="min-h-11 rounded border border-exp-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim hover:border-compass/50 hover:text-exp-text">
          {state.softPaused ? 'Resume focus' : 'Pause focus'}
        </button>
      )}
      <TransactionRecoveryCenter />
    </div>
  );
}
