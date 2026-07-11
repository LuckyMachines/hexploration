import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RETURN_ROLES, loadReturnLoop, recordReturnEvent, returnRecommendation, saveReturnLoop, selectRole, startReturnableExpedition, updateExpeditionReturn } from '../../lib/returnLoop';

const lifecycleLabel = { preparing: 'Preparing', active: 'Active', 'waiting-on-crew': 'Waiting on crew', 'at-risk': 'At risk', 'extraction-window': 'Extraction window', complete: 'Complete', recoverable: 'Recoverable' };

export function ReturnLoopSync({ gameId, isGameOver = false }) {
  useEffect(() => {
    if (!gameId) return;
    const current = loadReturnLoop();
    const next = current.expedition?.gameId === String(gameId)
      ? updateExpeditionReturn(current, { lifecycle: isGameOver ? 'recoverable' : 'active', nextAction: isGameOver ? 'Review the expedition record and follow the unresolved clue.' : 'Resume the expedition and read the board.', nextReason: isGameOver ? 'The expedition record preserves what the crew learned.' : 'Your crew needs the next decision.' })
      : startReturnableExpedition(current, { gameId, name: `Expedition ${gameId}` });
    saveReturnLoop(next);
  }, [gameId, isGameOver]);
  return null;
}

export default function ReturnLoopPanel() {
  const [state, setState] = useState(() => loadReturnLoop());
  const [copied, setCopied] = useState(false);
  const recommendation = useMemo(() => returnRecommendation(state), [state]);
  const expedition = state.expedition;
  const persist = (next) => { const saved = saveReturnLoop(next); setState(saved); return saved; };
  const markReady = () => expedition && persist(updateExpeditionReturn(state, { lifecycle: 'waiting-on-crew', lastConsequence: `${state.player.callsign} marked a ${state.player.role} decision ready.`, nextAction: 'Return when the crew is ready to commit.', nextReason: 'Vex is holding the crossing until your decision resolves.' }));
  const copyInvite = async () => { try { await navigator.clipboard.writeText(`${state.player.callsign} is assembling a Xenovoya crew. Join the expedition and help resolve the next shared decision.`); persist(recordReturnEvent(state, 'crew_invite_copied')); setCopied(true); } catch { setCopied(false); } };

  return <section id="return-loop" className="rounded border border-compass/35 bg-exp-panel/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" data-testid="return-loop-panel">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-compass">Return to the crew</p><h2 className="mt-2 font-display text-2xl uppercase tracking-[0.14em] text-exp-text">{expedition ? expedition.name : 'Start a story worth returning to'}</h2><p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-exp-text-dim">{expedition ? expedition.lastConsequence : 'Choose a role, make a contribution the crew can feel, and keep one unresolved clue for the next session.'}</p></div>{expedition && <span className="rounded border border-compass/40 bg-compass/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-compass-bright">{lifecycleLabel[expedition.lifecycle]}</span>}</div>
    {!state.player.role ? <div className="mt-5 grid gap-3 md:grid-cols-3">{Object.entries(RETURN_ROLES).map(([id, role]) => <button key={id} onClick={() => persist(selectRole(state, id))} className="rounded border border-exp-border bg-exp-dark/40 p-4 text-left transition hover:border-compass/50 hover:bg-compass/5"><p className="font-mono text-xs uppercase tracking-[0.18em] text-exp-text">{role.label}</p><p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">{role.contribution}.</p></button>)}</div> : <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.55fr)]"><div className="rounded border border-exp-border bg-exp-dark/35 p-4"><p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Next best action</p><p className="mt-2 font-display text-lg uppercase tracking-[0.1em] text-exp-text">{recommendation.action}</p><p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{recommendation.reason}</p>{recommendation.href.startsWith('/') ? <Link to={recommendation.href} onClick={() => persist(recordReturnEvent(state, 'expedition_resumed', { gameId: expedition?.gameId }))} className="mt-4 inline-flex rounded border border-compass/50 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-compass-bright">{recommendation.action}</Link> : <button onClick={expedition ? markReady : () => persist(startReturnableExpedition(state, { name: 'Sector 0 signal' }))} className="mt-4 rounded border border-compass/50 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-compass-bright">{expedition ? 'Mark decision ready' : 'Create expedition thread'}</button>}</div><div className="rounded border border-exp-border bg-exp-dark/35 p-4"><p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Your contribution</p><p className="mt-2 font-mono text-sm text-compass-bright">{RETURN_ROLES[state.player.role].label}</p><p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">{RETURN_ROLES[state.player.role].contribution}.</p>{expedition && <><p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">Unresolved clue</p><p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">{expedition.clue}</p></>}</div></div>}
    {state.player.role && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-exp-border pt-4"><p className="font-mono text-xs text-exp-text-dim">Crew: {state.crew.map((member) => member.callsign).join(' · ') || 'Invite a second crew member to make the route shared.'}</p><button onClick={copyInvite} className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">{copied ? 'Invite copied' : 'Copy crew invite'}</button></div>}
  </section>;
}
