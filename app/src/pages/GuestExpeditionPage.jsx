import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ThreeBoard from '../components/board/ThreeBoard';
import { deriveBoardViewModel } from '../components/board/boardViewModel';
import {
  canDepartGuestExpedition,
  clearGuestExpedition,
  commitGuestMove,
  createGuestExpedition,
  departGuestExpedition,
  emergencyExtractGuestExpedition,
  guestBoardInput,
  guestDistanceToLanding,
  guestReachableAliases,
  guestTerrainLabel,
  loadGuestExpedition,
  saveGuestExpedition,
  selectGuestTile,
} from '../lib/guestExpedition';

function StatCard({ label, value, detail, tone = 'text-exp-text' }) {
  return (
    <div className="rounded border border-exp-border bg-exp-dark/45 p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-exp-text-dim">{label}</p>
      <p className={`mt-1 font-display text-xl uppercase tracking-[0.1em] ${tone}`}>{value}</p>
      <p className="mt-1 font-mono text-[10px] leading-relaxed text-exp-text-dim">{detail}</p>
    </div>
  );
}

export default function GuestExpeditionPage() {
  const [expedition, setExpedition] = useState(loadGuestExpedition);
  const [isResolving, setIsResolving] = useState(false);
  const [rendererState, setRendererState] = useState('building');
  const resolveTimer = useRef(null);

  useEffect(() => {
    saveGuestExpedition(expedition);
  }, [expedition]);

  useEffect(() => () => {
    if (resolveTimer.current) window.clearTimeout(resolveTimer.current);
  }, []);

  const boardViewModel = useMemo(
    () => deriveBoardViewModel(guestBoardInput(expedition, { isResolving })),
    [expedition, isResolving],
  );
  const reachableAliases = guestReachableAliases(expedition);
  const distanceHome = guestDistanceToLanding(expedition);
  const canDepart = canDepartGuestExpedition(expedition);
  const pressureTone = expedition.pressure >= 65 ? 'text-signal-red' : expedition.pressure >= 40 ? 'text-compass-bright' : 'text-oxide-green';

  const commitRoute = () => {
    if (!expedition.selectedAlias || isResolving || expedition.status !== 'exploring') return;
    setIsResolving(true);
    resolveTimer.current = window.setTimeout(() => {
      setExpedition((current) => commitGuestMove(current));
      setIsResolving(false);
      resolveTimer.current = null;
    }, 620);
  };

  const restart = () => {
    if (resolveTimer.current) window.clearTimeout(resolveTimer.current);
    resolveTimer.current = null;
    setIsResolving(false);
    clearGuestExpedition();
    setExpedition(createGuestExpedition());
  };

  return (
    <section data-testid="guest-expedition" className="mx-auto w-full max-w-[100rem] px-3 py-5 sm:px-5 sm:py-8 2xl:px-6">
      <div className="rounded-xl border border-exp-border bg-[radial-gradient(circle_at_72%_8%,rgba(76,145,219,0.12),transparent_30%),linear-gradient(180deg,rgba(25,31,21,0.96),rgba(10,14,10,0.98))] shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        <header className="border-b border-exp-border px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-blueprint">Wallet-free 3D expedition</p>
              <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text sm:text-5xl">Explore the living survey</h1>
              <p className="mt-3 font-mono text-sm leading-relaxed text-exp-text-dim">
                Play a complete local route on the production 3D board. Reveal terrain, recover relics, manage pressure, and return to the landing beacon before the storm closes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-[9px] uppercase tracking-[0.16em]">
              <span className="rounded border border-blueprint/35 bg-blueprint/10 px-3 py-2 text-blueprint">Production 3D</span>
              <span className="rounded border border-oxide-green/35 bg-oxide-green/10 px-3 py-2 text-oxide-green">Saved locally</span>
              <span className="rounded border border-exp-border bg-exp-dark/50 px-3 py-2 text-exp-text-dim">No wallet needed</span>
            </div>
          </div>
        </header>

        <div className="grid gap-5 p-3 sm:p-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(310px,0.65fr)]">
          <div>
            <div className="relative h-[58svh] min-h-[32rem] max-h-[48rem] overflow-hidden rounded-xl border border-exp-border bg-exp-dark">
              <ThreeBoard
                viewModel={boardViewModel}
                onTileClick={(alias) => setExpedition((current) => selectGuestTile(current, alias))}
                onTileHover={() => {}}
                onReady={() => setRendererState('ready')}
                onUnavailable={() => setRendererState('unavailable')}
                ariaLabel="Interactive 3D guest expedition board"
              />
              {rendererState === 'unavailable' && (
                <div className="absolute inset-x-4 bottom-4 z-40 rounded border border-signal-red/45 bg-exp-dark/95 p-4 text-center" role="alert">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal-red">3D renderer unavailable</p>
                  <p className="mt-2 font-mono text-xs text-exp-text-dim">Enable hardware acceleration or try a current browser to enter the world.</p>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-[10px] uppercase tracking-[0.15em] text-exp-text-dim">
              <span>{rendererState === 'ready' ? 'World ready' : rendererState === 'unavailable' ? 'Renderer unavailable' : 'Building terrain'}</span>
              <span>Drag to orbit / right-drag to pan / scroll to zoom</span>
            </div>
          </div>

          <aside className="space-y-4" aria-label="Guest expedition controls">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Pressure" value={`${expedition.pressure}%`} detail="Redline at 100" tone={pressureTone} />
              <StatCard label="Supplies" value={expedition.supplies} detail="One used per move" tone={expedition.supplies <= 2 ? 'text-signal-red' : 'text-exp-text'} />
              <StatCard label="Relics" value={expedition.relics} detail="Carry them home" tone="text-relic-bright" />
              <StatCard label="Route home" value={distanceHome === 0 ? 'Here' : `${distanceHome} step${distanceHome === 1 ? '' : 's'}`} detail={`Turn ${expedition.turns}`} tone={distanceHome === 0 ? 'text-oxide-green' : 'text-compass-bright'} />
            </div>

            <div className={`rounded border p-4 ${expedition.status === 'redline' ? 'border-signal-red/45 bg-signal-red/5' : expedition.status === 'complete' ? 'border-oxide-green/40 bg-oxide-green/5' : 'border-compass/35 bg-compass/5'}`} role="status" aria-live="polite">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass-bright">
                {expedition.status === 'complete' ? 'Expedition complete' : expedition.status === 'redline' ? 'Emergency' : 'Crew signal'}
              </p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">{expedition.message}</p>
            </div>

            {expedition.status === 'exploring' && (
              <div className="rounded border border-exp-border bg-exp-panel/75 p-4">
                <h2 className="font-display text-lg uppercase tracking-[0.12em] text-exp-text">Choose the next crossing</h2>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">Select an adjacent hex in the world or use a route control below. Unknown ground is a real risk.</p>
                <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Reachable routes">
                  {reachableAliases.map((alias) => (
                    <button
                      key={alias}
                      type="button"
                      onClick={() => setExpedition((current) => selectGuestTile(current, alias))}
                      aria-pressed={expedition.selectedAlias === alias}
                      className={`min-h-11 rounded border px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${expedition.selectedAlias === alias ? 'border-blueprint bg-blueprint/15 text-blueprint' : 'border-exp-border bg-exp-dark/45 text-exp-text hover:border-blueprint/50'}`}
                    >
                      <span className="block">{alias}</span>
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
                  <button type="button" onClick={() => setExpedition((current) => departGuestExpedition(current))} className="mt-2 min-h-11 w-full rounded border border-oxide-green/55 bg-oxide-green/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-oxide-green hover:bg-oxide-green/20">
                    Depart with findings
                  </button>
                )}
              </div>
            )}

            {expedition.status === 'redline' && (
              <button type="button" onClick={() => setExpedition((current) => emergencyExtractGuestExpedition(current))} className="min-h-12 w-full rounded border border-signal-red bg-signal-red/15 px-4 py-3 font-display text-sm font-semibold uppercase tracking-[0.14em] text-signal-red hover:bg-signal-red/25">
                Call emergency extraction
              </button>
            )}

            {expedition.status === 'complete' && (
              <div className="rounded border border-oxide-green/35 bg-oxide-green/5 p-4">
                <p className="font-display text-xl uppercase tracking-[0.12em] text-oxide-green">{expedition.result === 'safe' ? 'Findings secured' : 'Crew recovered'}</p>
                <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">Your local run is complete. A live expedition adds a shared crew and persistent on-chain actions only when you choose to join.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/#live-expedition" className="inline-flex min-h-11 items-center rounded border border-compass/50 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-compass-bright">Find a live crew</Link>
                  <button type="button" onClick={restart} className="min-h-11 rounded border border-exp-border bg-exp-dark/45 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-exp-text">Explore again</button>
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

        <footer className="grid gap-3 border-t border-exp-border px-4 py-5 font-mono text-xs leading-relaxed text-exp-text-dim sm:grid-cols-3 sm:px-6">
          <p><span className="text-blueprint">Reveal:</span> move into fog to discover terrain and relics.</p>
          <p><span className="text-compass-bright">Read:</span> every move consumes supplies and raises pressure.</p>
          <p><span className="text-oxide-green">Depart:</span> return to the blue landing beacon and leave before redline.</p>
        </footer>
      </div>
    </section>
  );
}
