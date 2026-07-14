import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import {
  RETURN_ROLES,
  clearReturnLoop,
  loadReturnLoop,
  mergeReturnLoops,
  recordReturnEvent,
  returnRecommendation,
  saveReturnLoop,
  selectRole,
  startReturnableExpedition,
  updateExpeditionReturn,
} from '../../lib/returnLoop';
import { trackJourneyEvent } from '../../lib/analytics';
import {
  ReturnServiceError,
  authenticateReturnService,
  clearReturnSession,
  deleteCloudProfile,
  exportCloudProfile,
  getCloudReturnState,
  loadReturnSession,
  logoutReturnService,
  putCloudReturnState,
  recordRetentionEvent,
  returnServiceEnabled,
  updateCloudProfile,
} from '../../lib/returnService';

const lifecycleLabel = { preparing: 'Preparing', active: 'Active', 'waiting-on-crew': 'Waiting on crew', 'at-risk': 'At risk', 'extraction-window': 'Extraction window', complete: 'Complete', recoverable: 'Recoverable' };
const terminalLifecycles = new Set(['complete', 'recoverable']);
const returnInterval = (updatedAt) => {
  const elapsedHours = Math.max(0, (Date.now() - (Date.parse(updatedAt) || Date.now())) / 3_600_000);
  if (elapsedHours < 1) return 'same_session';
  if (elapsedHours < 24) return 'same_day';
  if (elapsedHours < 72) return 'd1_d3';
  if (elapsedHours < 168) return 'd3_d7';
  return 'd7_plus';
};

export function ReturnLoopSync({ gameId, isGameOver = false }) {
  useEffect(() => {
    if (!gameId) return;
    const current = loadReturnLoop();
    const next = current.expedition?.gameId === String(gameId)
      ? updateExpeditionReturn(current, {
        lifecycle: isGameOver ? 'recoverable' : 'active',
        nextAction: isGameOver ? 'Review the expedition record and follow the unresolved clue.' : 'Resume the expedition and read the board.',
        nextReason: isGameOver ? 'The expedition record preserves what the crew learned.' : 'Your crew needs the next decision.',
      })
      : startReturnableExpedition(current, { gameId, name: `Expedition ${gameId}` });
    saveReturnLoop(next);
  }, [gameId, isGameOver]);
  return null;
}

export default function ReturnLoopPanel() {
  const { address, isConnected, chainId, connect } = useWallet();
  const [state, setState] = useState(() => loadReturnLoop());
  const [copied, setCopied] = useState(false);
  const [cloud, setCloud] = useState({ status: 'local', message: 'Saved on this device.', version: 0 });
  const [privacy, setPrivacy] = useState({ status: 'idle', message: '' });
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [localClearArmed, setLocalClearArmed] = useState(false);
  const initialState = useRef(state);
  const recommendation = useMemo(() => returnRecommendation(state), [state]);
  const expedition = state.expedition;

  useEffect(() => {
    trackJourneyEvent('starter_opened', { persona: 'first-player-v1' });
    const initialExpedition = initialState.current.expedition;
    if (initialExpedition) {
      trackJourneyEvent('resume', {
        has_expedition: true,
        lifecycle: initialExpedition.lifecycle,
        resume_source: 'local',
      }, { dedupeKey: initialExpedition.gameId });
    }
  }, []);

  useEffect(() => {
    if (!state.player.role) return;
    trackJourneyEvent('cloud_save_offered', {
      has_expedition: Boolean(expedition),
      role: state.player.role,
    });
  }, [expedition?.gameId, state.player.role]);

  useEffect(() => {
    if (!expedition || !terminalLifecycles.has(expedition.lifecycle)) return;
    trackJourneyEvent('recap', {
      lifecycle: expedition.lifecycle,
      outcome: expedition.lifecycle === 'complete' ? 'completed' : 'recoverable',
    }, { dedupeKey: expedition.gameId });
  }, [expedition?.gameId, expedition?.lifecycle]);

  useEffect(() => {
    const session = loadReturnSession();
    if (session && address && session.wallet !== address.toLowerCase()) {
      clearReturnSession();
      setCloud({ status: 'local', message: 'Wallet changed. Cloud history is disconnected.', version: 0 });
    }
  }, [address]);

  const persist = (next) => {
    const saved = saveReturnLoop(next);
    setState(saved);
    return saved;
  };

  const chooseRole = (role) => {
    const next = persist(selectRole(state, role));
    trackJourneyEvent('role_selected', { role });
    trackJourneyEvent('meaningful_choice', { choice: 'crew_role', role });
    return next;
  };

  const startThread = () => {
    const next = persist(startReturnableExpedition(state, { name: 'Sector 0 signal' }));
    trackJourneyEvent('visible_consequence', { outcome: 'route_charted', lifecycle: next.expedition.lifecycle }, { dedupeKey: next.expedition.gameId });
    return next;
  };

  const startNextThread = () => {
    const interval = returnInterval(expedition?.updatedAt);
    const next = persist(startReturnableExpedition(state, { name: `Sector ${state.player.records.expeditions} signal` }));
    trackJourneyEvent('second_expedition_start', { return_interval: interval, role: state.player.role }, { dedupeKey: next.expedition.gameId });
    return next;
  };

  const markReady = () => {
    if (!expedition) return null;
    const next = persist(updateExpeditionReturn(state, {
      lifecycle: 'waiting-on-crew',
      lastConsequence: `${state.player.callsign} marked a ${state.player.role} decision ready.`,
      nextAction: 'Return when the crew is ready to commit.',
      nextReason: 'Vex is holding the crossing until your decision resolves.',
    }));
    trackJourneyEvent('starter_completed', { outcome: 'decision_ready', role: state.player.role }, { dedupeKey: expedition.gameId });
    return next;
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${state.player.callsign} is assembling a Xenovoya crew. Join the expedition and help resolve the next shared decision.`);
      persist(recordReturnEvent(state, 'crew_invite_copied'));
      trackJourneyEvent('share', { share_type: 'crew_invite' }, { dedupeKey: expedition?.gameId || 'starter' });
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const saveAcrossDevices = async () => {
    if (!returnServiceEnabled()) {
      setCloud({ status: 'error', message: 'Cloud return history is not configured in this release.', version: 0 });
      return;
    }
    setCloud((current) => ({ ...current, status: 'authenticating', message: 'Preparing wallet-secured history…' }));
    try {
      let activeWallet = address;
      if (!activeWallet) activeWallet = await connect();
      if (!activeWallet) throw new Error('Wallet connection did not return an account.');
      const activeChainId = chainId || Number(await window.ethereum.request({ method: 'eth_chainId' }));
      let session = loadReturnSession();
      if (!session || session.wallet !== activeWallet.toLowerCase()) session = await authenticateReturnService(activeWallet, activeChainId);
      setCloud((current) => ({ ...current, status: 'syncing', message: 'Reconciling this device with cloud history…' }));
      let remote = null;
      try {
        remote = await getCloudReturnState(session.token);
      } catch (error) {
        if (!(error instanceof ReturnServiceError) || error.status !== 404) throw error;
      }
      let merged = mergeReturnLoops(state, remote?.state || {});
      let expectedVersion = Number(remote?.version || 0);
      let saved;
      let conflictResolved = false;
      try {
        saved = await putCloudReturnState(merged, expectedVersion, session.token);
      } catch (error) {
        if (!(error instanceof ReturnServiceError) || error.status !== 409 || !error.payload.current) throw error;
        merged = mergeReturnLoops(merged, error.payload.current.state);
        expectedVersion = Number(error.payload.current.version);
        saved = await putCloudReturnState(merged, expectedVersion, session.token);
        conflictResolved = true;
      }
      await updateCloudProfile({ callsign: merged.player.callsign, role: merged.player.role }, session.token);
      persist(merged);
      setCloud({
        status: 'synced',
        message: conflictResolved ? `Conflict resolved safely · cloud version ${saved.version}` : `Synced securely · cloud version ${saved.version}`,
        version: Number(saved.version),
      });
      if (remote?.state?.expedition) {
        trackJourneyEvent('resume', {
          has_expedition: true,
          lifecycle: merged.expedition?.lifecycle || 'active',
          resume_source: 'cloud',
        }, { dedupeKey: merged.expedition?.gameId || 'cloud' });
      }
      trackJourneyEvent('cloud_save_completed', {
        has_expedition: Boolean(merged.expedition),
        role: merged.player.role || 'none',
        cloud_version: Number(saved.version),
        sync_result: conflictResolved ? 'conflict_resolved' : 'synced',
      }, { dedupeKey: merged.expedition?.gameId || merged.player.role || 'profile' });
      recordRetentionEvent('cloud_return_saved', { has_expedition: Boolean(merged.expedition), role: merged.player.role || 'none' }, { gameId: merged.expedition?.gameId, token: session.token }).catch(() => {});
    } catch (error) {
      const expired = error instanceof ReturnServiceError && error.status === 401;
      if (expired) clearReturnSession();
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setCloud({
        status: expired ? 'expired' : offline ? 'offline' : 'error',
        message: expired ? 'Session expired. Sign again to reconnect cloud history.' : offline ? 'Offline. Your expedition remains safe on this device.' : (error.message || 'Cloud history could not sync.'),
        version: 0,
      });
    }
  };

  const disconnectCloud = async () => {
    await logoutReturnService();
    setCloud({ status: 'local', message: 'Cloud session removed. Local history is unchanged.', version: 0 });
  };

  const downloadCloudData = async () => {
    setPrivacy({ status: 'working', message: 'Preparing your off-chain data export...' });
    try {
      const exported = await exportCloudProfile();
      const blob = new Blob([`${JSON.stringify(exported, null, 2)}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `xenovoya-player-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setPrivacy({ status: 'done', message: 'Export downloaded. It contains wallet-linked off-chain data, so store it carefully.' });
    } catch (error) {
      setPrivacy({ status: 'error', message: error.message || 'The export could not be prepared.' });
    }
  };

  const eraseCloudData = async () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      setPrivacy({ status: 'confirm', message: 'Press confirm delete to erase wallet-linked off-chain history and invalidate every cloud session.' });
      return;
    }
    setPrivacy({ status: 'working', message: 'Erasing wallet-linked off-chain history...' });
    try {
      await deleteCloudProfile();
      setDeleteArmed(false);
      setCloud({ status: 'local', message: 'Cloud profile erased. Local expedition history remains on this device.', version: 0 });
      setPrivacy({ status: 'done', message: 'Cloud profile erased. Public blockchain history is unchanged and cannot be deleted by this service.' });
    } catch (error) {
      setPrivacy({ status: 'error', message: error.message || 'Cloud profile deletion failed safely.' });
    }
  };

  const eraseLocalHistory = () => {
    if (!localClearArmed) {
      setLocalClearArmed(true);
      setPrivacy({ status: 'confirm', message: 'Press confirm local clear to remove expedition return history from this browser.' });
      return;
    }
    setState(clearReturnLoop());
    setLocalClearArmed(false);
    setPrivacy({ status: 'done', message: 'Local expedition history cleared. Interface preferences and anonymous analytics identifiers were left unchanged.' });
  };

  return <section id="return-loop" className="rounded border border-compass/35 bg-exp-panel/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" data-testid="return-loop-panel">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-compass">Return to the crew</p>
        <h2 className="mt-2 font-display text-2xl uppercase tracking-[0.14em] text-exp-text">{expedition ? expedition.name : 'Start a story worth returning to'}</h2>
        <p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-exp-text-dim">{expedition ? expedition.lastConsequence : 'Choose a role, make a contribution the crew can feel, and keep one unresolved clue for the next session.'}</p>
      </div>
      {expedition && <span className="rounded border border-compass/40 bg-compass/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-compass-bright">{lifecycleLabel[expedition.lifecycle]}</span>}
    </div>
    {!state.player.role ? <div className="mt-5 grid gap-3 md:grid-cols-3">
      {Object.entries(RETURN_ROLES).map(([id, role]) => <button key={id} onClick={() => chooseRole(id)} className="rounded border border-exp-border bg-exp-dark/40 p-4 text-left transition hover:border-compass/50 hover:bg-compass/5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-exp-text">{role.label}</p>
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">{role.contribution}.</p>
      </button>)}
    </div> : <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.55fr)]">
      <div className="rounded border border-exp-border bg-exp-dark/35 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Next best action</p>
        <p className="mt-2 font-display text-lg uppercase tracking-[0.1em] text-exp-text">{recommendation.action}</p>
        <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{recommendation.reason}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!expedition && <button onClick={startThread} className="rounded border border-compass/50 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-compass-bright">Create expedition thread</button>}
          {expedition && terminalLifecycles.has(expedition.lifecycle) && <button onClick={startNextThread} className="rounded border border-compass/50 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-compass-bright">Start next expedition thread</button>}
          {expedition && !terminalLifecycles.has(expedition.lifecycle) && /^\d+$/.test(expedition.gameId) && <Link to={recommendation.href} onClick={() => {
            persist(recordReturnEvent(state, 'expedition_resumed', { gameId: expedition.gameId }));
            trackJourneyEvent('resume', { has_expedition: true, lifecycle: expedition.lifecycle, resume_source: 'local' }, { dedupeKey: expedition.gameId });
          }} className="inline-flex rounded border border-compass/50 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-compass-bright">{recommendation.action}</Link>}
          {expedition && !terminalLifecycles.has(expedition.lifecycle) && !/^\d+$/.test(expedition.gameId) && expedition.lifecycle === 'waiting-on-crew' && <a href="#live-expedition" className="inline-flex rounded border border-compass/50 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-compass-bright">Find a live expedition</a>}
          {expedition && !terminalLifecycles.has(expedition.lifecycle) && expedition.lifecycle !== 'waiting-on-crew' && <button onClick={markReady} className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-blueprint">Mark decision ready</button>}
        </div>
      </div>
      <div className="rounded border border-exp-border bg-exp-dark/35 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Your contribution</p>
        <p className="mt-2 font-mono text-sm text-compass-bright">{RETURN_ROLES[state.player.role].label}</p>
        <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">{RETURN_ROLES[state.player.role].contribution}.</p>
        {expedition && <><p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">Unresolved clue</p><p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">{expedition.clue}</p></>}
      </div>
    </div>}
    {state.player.role && <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-exp-border pt-4">
        <p className="font-mono text-xs text-exp-text-dim">Crew: {state.crew.map((member) => member.callsign).join(' · ') || 'Invite a second crew member to make the route shared.'}</p>
        <button onClick={copyInvite} className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">{copied ? 'Invite copied' : 'Copy crew invite'}</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-exp-border bg-exp-dark/35 p-4" data-testid="cloud-return-controls">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-compass">Cross-device history</p>
          <p className="mt-1 font-mono text-xs text-exp-text-dim" aria-live="polite">{cloud.message}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={['authenticating', 'syncing'].includes(cloud.status)} onClick={saveAcrossDevices} className="rounded border border-compass/50 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright disabled:cursor-wait disabled:opacity-60">{cloud.status === 'synced' ? 'Sync changes' : isConnected ? 'Save across devices' : 'Connect to save'}</button>
          {loadReturnSession() && <button onClick={disconnectCloud} className="rounded border border-exp-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Remove cloud session</button>}
        </div>
      </div>
      <div className="mt-3 rounded border border-exp-border bg-exp-dark/35 p-4" data-testid="privacy-controls">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim">Your expedition data</p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">Export or erase optional cloud history, or clear this browser's local expedition thread. On-chain records remain public and immutable.</p>
            {privacy.message && <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text" aria-live="polite">{privacy.message}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {loadReturnSession() && <button disabled={privacy.status === 'working'} onClick={downloadCloudData} className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint disabled:opacity-60">Export cloud data</button>}
            {loadReturnSession() && <button disabled={privacy.status === 'working'} onClick={eraseCloudData} className="rounded border border-signal-red/45 bg-signal-red/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal-red disabled:opacity-60">{deleteArmed ? 'Confirm cloud delete' : 'Delete cloud data'}</button>}
            <button disabled={privacy.status === 'working'} onClick={eraseLocalHistory} className="rounded border border-exp-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim disabled:opacity-60">{localClearArmed ? 'Confirm local clear' : 'Clear local history'}</button>
            <Link to="/privacy" className="inline-flex rounded border border-exp-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">How data works</Link>
          </div>
        </div>
      </div>
    </>}
  </section>;
}
