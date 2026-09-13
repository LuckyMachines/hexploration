import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ThreeBoard from '../components/board/ThreeBoard';
import AftermathMoment from '../components/resolution/AftermathMoment';
import { deriveBoardViewModel } from '../components/board/boardViewModel';
import { presentationDurationMs } from '../components/board/premiumPresentation';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { emitFeedbackEvent } from '../lib/feedbackEvents';
import { emitMusicDirectorState } from '../lib/musicDirector';
import {
  GUEST_TERRAIN,
  canDepartGuestExpedition,
  clearGuestExpedition,
  commitGuestMove,
  createGuestExpedition,
  departGuestExpedition,
  emergencyExtractGuestExpedition,
  guestBoardInput,
  guestCrewBark,
  guestDistanceToLanding,
  guestEmotionalBeat,
  guestReachableAliases,
  guestRouteRecommendation,
  guestTerrainLabel,
  loadGuestExpedition,
  saveGuestExpedition,
  selectGuestTile,
} from '../lib/guestExpedition';

function StatCard({ label, value, detail, tone = 'text-exp-text' }) {
  return (
    <div className="rounded border border-exp-border bg-exp-dark/45 p-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-exp-text-dim">{label}</p>
      <p className={`mt-1 font-display text-xl uppercase tracking-[0.1em] ${tone}`}>{value}</p>
      <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">{detail}</p>
    </div>
  );
}

function GuestTacticalBoard({ expedition, reachableAliases, recommendation, onSelect }) {
  const revealed = new Set(expedition.revealedAliases);
  return (
    <div className="absolute inset-0 overflow-auto bg-[radial-gradient(circle_at_center,rgba(76,145,219,0.08),transparent_55%),#0d0f0a] p-4 sm:p-8" data-testid="guest-tactical-board">
      <div className="mx-auto grid min-h-full max-w-3xl grid-cols-5 grid-rows-4 gap-2" role="grid" aria-label="Tactical guest expedition map">
        {GUEST_TERRAIN.map((cell) => {
          const [column, row] = cell.alias.split(',').map(Number);
          const canSelect = reachableAliases.includes(cell.alias);
          const isCurrent = expedition.currentLocation === cell.alias;
          const isSelected = expedition.selectedAlias === cell.alias;
          const isRecommended = recommendation?.alias === cell.alias;
          return (
            <button
              key={cell.alias}
              type="button"
              role="gridcell"
              disabled={!canSelect}
              onClick={() => onSelect(cell.alias)}
              aria-label={`${cell.alias} ${revealed.has(cell.alias) ? guestTerrainLabel(cell.alias, expedition) : 'Uncharted'}${isCurrent ? ', current position' : ''}${isRecommended ? ', recommended route' : ''}`}
              aria-pressed={isSelected}
              style={{ gridColumn: column + 1, gridRow: row + 1, transform: column % 2 ? 'translateY(1.25rem)' : undefined }}
              className={`relative min-h-20 rounded-lg border p-2 font-mono text-[11px] transition-colors ${isCurrent ? 'border-oxide-green bg-oxide-green/15 text-oxide-green' : isSelected ? 'border-blueprint bg-blueprint/20 text-blueprint' : isRecommended ? 'border-compass bg-compass/10 text-compass-bright' : revealed.has(cell.alias) ? 'border-exp-border bg-exp-panel text-exp-text' : 'border-exp-border/70 bg-exp-dark/70 text-exp-text-dim'} disabled:cursor-default disabled:opacity-75`}
            >
              <span className="block text-xs">{isCurrent ? 'YOU' : cell.alias}</span>
              <span className="mt-1 block normal-case leading-tight tracking-normal">{revealed.has(cell.alias) ? guestTerrainLabel(cell.alias, expedition) : 'Fog'}</span>
              {isRecommended && <span className="mt-1 block text-[10px] uppercase text-compass-bright">Recommended</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function GuestExpeditionPage() {
  const [searchParams] = useSearchParams();
  const { preferences, setPreference } = useUserPreferences();
  const [expedition, setExpedition] = useState(loadGuestExpedition);
  const [isResolving, setIsResolving] = useState(false);
  const [rendererState, setRendererState] = useState('building');
  const [focusMode, setFocusMode] = useState(false);
  const resolveTimer = useRef(null);
  const awaitingWorld = useRef(false);

  useEffect(() => {
    saveGuestExpedition(expedition);
  }, [expedition]);

  useEffect(() => () => {
    if (resolveTimer.current) window.clearTimeout(resolveTimer.current);
  }, []);

  useEffect(() => {
    if (!focusMode) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setFocusMode(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [focusMode]);

  useEffect(() => {
    const director = expedition.status === 'complete'
      ? expedition.result === 'safe'
        ? { trackId: 'xenovoya-victory-extraction', state: 'Victory', reason: 'The guest expedition returned safely.' }
        : { trackId: 'xenovoya-defeat-lost', state: 'Recovery', reason: 'Emergency extraction protected the crew.' }
      : expedition.lastEvent === 'relic'
        ? { trackId: 'xenovoya-relic-discovery', state: 'Relic Discovery', reason: 'The Tideglass Cradle answered.' }
        : expedition.pressure >= 65
          ? { trackId: 'xenovoya-expedition-danger', state: 'Danger', reason: 'Storm pressure crossed the safe band.' }
          : { trackId: 'xenovoya-expedition-calm', state: 'Expedition Calm', reason: 'The crew is surveying the route.' };
    emitMusicDirectorState(director);
  }, [expedition.lastEvent, expedition.pressure, expedition.result, expedition.status]);

  const boardViewModel = useMemo(
    () => deriveBoardViewModel(guestBoardInput(expedition, { isResolving })),
    [expedition, isResolving],
  );
  const reachableAliases = guestReachableAliases(expedition);
  const distanceHome = guestDistanceToLanding(expedition);
  const canDepart = canDepartGuestExpedition(expedition);
  const recommendation = useMemo(() => guestRouteRecommendation(expedition), [expedition]);
  const emotionalBeat = useMemo(() => guestEmotionalBeat(expedition), [expedition]);
  const crewBark = useMemo(() => guestCrewBark(expedition), [expedition]);
  const isPractice = searchParams.get('mode') === 'practice';
  const tacticalBoard = preferences.tacticalBoard || rendererState === 'unavailable';
  const pressureTone = expedition.pressure >= 65 ? 'text-signal-red' : expedition.pressure >= 40 ? 'text-compass-bright' : 'text-oxide-green';

  const commitRoute = () => {
    if (!expedition.selectedAlias || isResolving || expedition.status !== 'exploring') return;
    setIsResolving(true);
    resolveTimer.current = window.setTimeout(() => {
      setExpedition((current) => {
        const next = commitGuestMove(current);
        const soundCue = next.lastEvent === 'relic'
          ? 'board.relic.resonate'
          : next.lastEvent === 'danger'
            ? 'board.danger'
            : next.lastEvent === 'return'
              ? 'board.return'
              : 'board.discovery';
        emitFeedbackEvent({ source: 'guest-expedition', kind: 'board-beat', soundCue, motionCue: next.lastEvent });
        return next;
      });
      if (tacticalBoard) setIsResolving(false);
      else awaitingWorld.current = true;
      resolveTimer.current = null;
    }, presentationDurationMs());
  };

  const worldReady = () => {
    setRendererState('ready');
    if (!awaitingWorld.current) return;
    awaitingWorld.current = false;
    resolveTimer.current = window.setTimeout(() => {
      setIsResolving(false);
      resolveTimer.current = null;
    }, presentationDurationMs());
  };

  const restart = () => {
    if (resolveTimer.current) window.clearTimeout(resolveTimer.current);
    resolveTimer.current = null;
    awaitingWorld.current = false;
    setIsResolving(false);
    clearGuestExpedition();
    setExpedition(createGuestExpedition());
    setFocusMode(false);
  };

  const depart = () => {
    setExpedition((current) => departGuestExpedition(current));
    emitFeedbackEvent({ source: 'guest-expedition', kind: 'board-beat', soundCue: 'board.escape.commit', motionCue: 'extraction' });
  };

  const emergencyExtract = () => {
    setExpedition((current) => emergencyExtractGuestExpedition(current));
    emitFeedbackEvent({ source: 'guest-expedition', kind: 'board-beat', soundCue: 'board.emergency', motionCue: 'recovery' });
  };

  return (
    <section data-testid="guest-expedition" data-focus-mode={focusMode ? 'active' : 'standard'} className={`player-readable mx-auto w-full max-w-[110rem] px-3 py-4 sm:px-5 sm:py-5 2xl:px-6 ${focusMode ? 'guest-focus-shell' : ''}`}>
      <div className={`overflow-hidden rounded-xl border border-exp-border bg-[radial-gradient(circle_at_72%_8%,rgba(76,145,219,0.12),transparent_30%),linear-gradient(180deg,rgba(25,31,21,0.96),rgba(10,14,10,0.98))] shadow-[0_24px_90px_rgba(0,0,0,0.35)] ${focusMode ? 'flex h-full flex-col' : ''}`}>
        <header className={`border-b border-exp-border px-4 py-4 sm:px-6 ${focusMode ? 'hidden' : ''}`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-blueprint">{isPractice ? 'Always-available practice expedition' : 'Wallet-free 3D expedition'}</p>
              <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text sm:text-4xl">Explore the living survey</h1>
              <p className="mt-2 font-mono text-sm leading-relaxed text-exp-text-dim">
                Reveal terrain, recover a relic, and return to the landing beacon before the storm closes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
              <span className="rounded border border-blueprint/35 bg-blueprint/10 px-3 py-2 text-blueprint">Production 3D</span>
              <span className="rounded border border-oxide-green/35 bg-oxide-green/10 px-3 py-2 text-oxide-green">Saved locally</span>
              <span className="rounded border border-exp-border bg-exp-dark/50 px-3 py-2 text-exp-text-dim">No wallet needed</span>
            </div>
          </div>
        </header>

        <div className={`grid gap-4 p-3 sm:p-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(300px,0.62fr)] ${focusMode ? 'min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}>
          <div className={`min-w-0 ${focusMode ? 'min-h-0' : 'xl:sticky xl:top-20 xl:self-start'}`}>
            <div className={`relative overflow-hidden rounded-xl border border-exp-border bg-exp-dark ${focusMode ? 'h-full min-h-[28rem]' : 'h-[66svh] min-h-[34rem] max-h-[54rem]'}`}>
              {tacticalBoard ? (
                <GuestTacticalBoard expedition={expedition} reachableAliases={reachableAliases} recommendation={recommendation} onSelect={(alias) => setExpedition((current) => selectGuestTile(current, alias))} />
              ) : (
                <ThreeBoard
                  viewModel={boardViewModel}
                  onTileClick={(alias) => setExpedition((current) => selectGuestTile(current, alias))}
                  onTileHover={() => {}}
                  onReady={worldReady}
                  onUnavailable={() => setRendererState('unavailable')}
                  onBeat={(beat) => emitFeedbackEvent({ source: 'guest-board', kind: 'board-beat', beatId: beat.id, soundCue: beat.soundCue, motionCue: beat.motionCue })}
                  ariaLabel="Interactive 3D guest expedition board"
                />
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-[11px] uppercase tracking-[0.12em] text-exp-text-dim">
              <span>{tacticalBoard ? rendererState === 'unavailable' ? 'Tactical fallback - 3D unavailable' : 'Tactical map ready' : rendererState === 'ready' ? 'World ready' : 'Building terrain'}</span>
              <button type="button" onClick={() => { setRendererState('building'); setPreference('tacticalBoard', !tacticalBoard); }} className="min-h-11 rounded border border-exp-border bg-exp-dark/70 px-3 py-2 text-exp-text hover:border-blueprint/50">{tacticalBoard ? 'Try 3D diorama' : 'Use tactical map'}</button>
              <button type="button" aria-pressed={focusMode} onClick={() => setFocusMode((active) => !active)} className="hidden min-h-11 rounded border border-compass/35 bg-compass/10 px-3 py-2 text-compass-bright hover:border-compass sm:inline-flex sm:items-center">{focusMode ? 'Exit focus' : 'Focus world'}</button>
              {!tacticalBoard && <span>Drag to orbit / right-drag to pan / scroll to zoom</span>}
            </div>
          </div>

          <aside className="space-y-4" aria-label="Guest expedition controls">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Pressure" value={`${expedition.pressure}%`} detail="Redline at 100" tone={pressureTone} />
              <StatCard label="Supplies" value={expedition.supplies} detail="One used per move" tone={expedition.supplies <= 2 ? 'text-signal-red' : 'text-exp-text'} />
              <StatCard label="Relics" value={expedition.relics} detail="Carry them home" tone="text-relic-bright" />
              <StatCard label="Route home" value={distanceHome === 0 ? 'Here' : `${distanceHome} step${distanceHome === 1 ? '' : 's'}`} detail={`Turn ${expedition.turns}`} tone={distanceHome === 0 ? 'text-oxide-green' : 'text-compass-bright'} />
            </div>

            {emotionalBeat ? (
              <div key={emotionalBeat.id} className="guest-emotional-beat" data-guest-beat={emotionalBeat.category} aria-live="polite">
                <AftermathMoment moment={emotionalBeat} />
              </div>
            ) : (
              <div className="rounded border border-blueprint/40 bg-blueprint/5 p-4" role="status" aria-live="polite">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blueprint">First signal</p>
                <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">{expedition.message}</p>
                {recommendation && <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim"><span className="text-blueprint">Recommended {recommendation.alias}:</span> {recommendation.reason}</p>}
              </div>
            )}

            <div className="rounded border border-exp-border/75 bg-exp-dark/50 px-4 py-3" aria-live="polite" data-testid="guest-crew-bark">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-oxide-green">Field comms / {crewBark.speaker}</p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text">"{crewBark.line}"</p>
            </div>

            {expedition.status === 'exploring' && (
              <div className="rounded border border-exp-border bg-exp-panel/75 p-4">
                <h2 className="font-display text-lg uppercase tracking-[0.12em] text-exp-text">Choose the next crossing</h2>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">Select an adjacent hex in the world or use a route control below. The recommendation is guidance, not an automatic move.</p>
                <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Reachable routes">
                  {reachableAliases.map((alias) => (
                    <button
                      key={alias}
                      type="button"
                      onClick={() => setExpedition((current) => selectGuestTile(current, alias))}
                      aria-pressed={expedition.selectedAlias === alias}
                      className={`min-h-11 rounded border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${expedition.selectedAlias === alias ? 'border-blueprint bg-blueprint/15 text-blueprint' : recommendation?.alias === alias ? 'border-compass/60 bg-compass/10 text-compass-bright' : 'border-exp-border bg-exp-dark/45 text-exp-text hover:border-blueprint/50'}`}
                    >
                      <span className="flex items-center justify-between gap-2"><span>{alias}</span>{recommendation?.alias === alias && <span className="text-[10px] tracking-[0.08em]">Recommended</span>}</span>
                      <span className="mt-1 block text-exp-text-dim">{guestTerrainLabel(alias, expedition)}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  data-testid="commit-guest-route"
                  onClick={commitRoute}
                  disabled={!expedition.selectedAlias || isResolving}
                  className="mt-3 min-h-12 w-full rounded border border-compass bg-compass px-4 py-3 font-display text-sm font-semibold uppercase tracking-[0.14em] text-exp-dark transition hover:bg-compass-bright disabled:cursor-not-allowed disabled:border-exp-border disabled:bg-exp-dark disabled:text-exp-text-dim"
                >
                  {isResolving ? 'World resolving...' : expedition.selectedAlias ? `Commit route to ${expedition.selectedAlias}` : 'Select a reachable route'}
                </button>
                {canDepart && (
                  <button type="button" onClick={depart} className="mt-2 min-h-11 w-full rounded border border-oxide-green/55 bg-oxide-green/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-oxide-green hover:bg-oxide-green/20">
                    {expedition.relics ? `Depart with ${expedition.relics} relic${expedition.relics === 1 ? '' : 's'}` : 'Depart with the completed map'}
                  </button>
                )}
              </div>
            )}

            {expedition.status === 'redline' && (
              <button type="button" onClick={emergencyExtract} className="min-h-12 w-full rounded border border-signal-red bg-signal-red/15 px-4 py-3 font-display text-sm font-semibold uppercase tracking-[0.14em] text-signal-red hover:bg-signal-red/25">
                Call emergency extraction
              </button>
            )}

            {expedition.status === 'complete' && (
              <div className="rounded border border-oxide-green/35 bg-oxide-green/5 p-4">
                <p className="font-display text-xl uppercase tracking-[0.12em] text-oxide-green">{expedition.result === 'safe' ? 'Findings secured' : 'Crew recovered'}</p>
                <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">Your local run is complete. A live expedition adds a shared crew and persistent on-chain actions only when you choose to join.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/?mode=join" className="inline-flex min-h-11 items-center rounded border border-compass/50 bg-compass/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-compass-bright">Find a live crew</Link>
                  <button type="button" onClick={restart} className="min-h-11 rounded border border-exp-border bg-exp-dark/45 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-exp-text">Explore another route</button>
                </div>
              </div>
            )}

            {expedition.status !== 'complete' && (
              <button type="button" onClick={restart} className="min-h-11 w-full rounded border border-exp-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim hover:border-compass/40 hover:text-exp-text">
                Restart local expedition
              </button>
            )}
          </aside>
        </div>

        <footer className={`grid gap-3 border-t border-exp-border px-4 py-5 font-mono text-xs leading-relaxed text-exp-text-dim sm:grid-cols-3 sm:px-6 ${focusMode ? 'hidden' : ''}`}>
          <p><span className="text-blueprint">Reveal:</span> move into fog to discover terrain and relics.</p>
          <p><span className="text-compass-bright">Read:</span> every move consumes supplies and raises pressure.</p>
          <p><span className="text-oxide-green">Depart:</span> return to the blue landing beacon and leave before redline.</p>
        </footer>
      </div>
    </section>
  );
}
