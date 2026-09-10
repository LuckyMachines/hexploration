import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import boardSystem from '../board-system/board-system.json';
import { BOARD_LAB_STATES, BOARD_LAB_STRESS_CELLS, boardLabState } from '../board-system/boardLabFixtures';
import ThreeBoard from '../components/board/ThreeBoard';
import { deriveBoardViewModel } from '../components/board/boardViewModel';
import { resolveBoardBeat } from '../components/board/boardBeatDirector';

function readReplayFrame(replay, turn) {
  if (!replay?.frames?.length) return null;
  const index = Math.max(0, Math.min(replay.frames.length - 1, Number(turn || 0)));
  return replay.frames[index];
}

export default function BoardLabPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const stateId = searchParams.get('state') || 'ready';
  const replayId = searchParams.get('scenario') || '';
  const fullBoard = searchParams.get('density') === 'full';
  const turn = Number(searchParams.get('turn') || 0);
  const quality = searchParams.get('quality') || 'auto';
  const [replays, setReplays] = useState([]);
  const [rendererGeneration, setRendererGeneration] = useState(0);
  const [lastInputAlias, setLastInputAlias] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/board-system/replays.json')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Replay evidence is unavailable.')))
      .then((payload) => { if (active) setReplays(payload.replays || []); })
      .catch(() => { if (active) setReplays([]); });
    return () => { active = false; };
  }, []);

  const replay = replays.find((item) => item.scenarioId === replayId) || null;
  const replayFrame = readReplayFrame(replay, turn);
  const fixture = boardLabState(stateId);
  const viewModel = useMemo(
    () => deriveBoardViewModel(replayFrame?.viewModel || (fullBoard ? { ...fixture.input, cells: BOARD_LAB_STRESS_CELLS } : fixture.input)),
    [fixture, fullBoard, replayFrame],
  );
  const beat = resolveBoardBeat(viewModel);

  const updateParams = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  return (
    <section className="mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-6" data-testid="board-lab" data-board-state={replayFrame ? replayFrame.id : fixture.id} data-last-input-alias={lastInputAlias}>
      <header className="grid gap-5 border-b border-exp-border/70 pb-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-compass">Internal tool / board system {boardSystem.version}</p>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.12em] text-exp-text">Board Lab</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-exp-text-dim">
            One canvas, one canonical view model, and deterministic contract or exact-engine frames. Inspect state, camera, assets, performance, and beat direction without multiplying 3D worlds.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 font-mono text-[9px] uppercase tracking-[0.14em]">
          <div className="rounded border border-exp-border bg-exp-panel px-3 py-2 text-exp-text-dim">State <strong className="mt-1 block text-exp-text" data-testid="board-lab-state-label">{replayFrame?.id || fixture.id}</strong></div>
          <div className="rounded border border-exp-border bg-exp-panel px-3 py-2 text-exp-text-dim">Beat <strong className="mt-1 block text-compass-bright">{beat.id}</strong></div>
          <div className="rounded border border-exp-border bg-exp-panel px-3 py-2 text-exp-text-dim">Source <strong className="mt-1 block text-blueprint">{viewModel.source.kind}</strong></div>
        </div>
      </header>

      <div className="mt-5 grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_19rem]">
        <aside className="rounded-xl border border-exp-border/70 bg-exp-panel/80 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-exp-text-dim">Contract states</p>
          <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-1">
            {BOARD_LAB_STATES.map((state) => (
              <button
                key={state.id}
                type="button"
                className={`min-h-11 rounded border px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.13em] ${!replay && fixture.id === state.id ? 'border-compass bg-compass/10 text-compass-bright' : 'border-exp-border bg-exp-dark/45 text-exp-text-dim hover:border-compass/45 hover:text-exp-text'}`}
                onClick={() => updateParams({ state: state.id, scenario: null, turn: null })}
              >
                {state.label}
              </button>
            ))}
          </div>
          <label className="mt-5 block font-mono text-[9px] uppercase tracking-[0.18em] text-exp-text-dim" htmlFor="board-quality">Renderer quality</label>
          <select id="board-quality" value={quality} onChange={(event) => updateParams({ quality: event.target.value })} className="mt-2 min-h-11 w-full rounded border border-exp-border bg-exp-dark px-3 font-mono text-xs text-exp-text">
            <option value="auto">Auto</option>
            <option value="high">High</option>
            <option value="balanced">Balanced</option>
            <option value="efficient">Efficient</option>
          </select>
        </aside>

        <div className="min-w-0">
          <div className="h-[34rem] overflow-hidden rounded-xl border border-exp-border/80 bg-[#050805] shadow-[0_28px_90px_rgba(0,0,0,0.48)] xl:h-[46rem]" data-testid="board-lab-stage">
            <ThreeBoard
              key={rendererGeneration}
              viewModel={viewModel}
              performanceMode={quality}
              ariaLabel={`${replay ? replay.label : fixture.label} board evidence`}
              onTileClick={(alias) => setLastInputAlias(alias)}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 rounded border border-exp-border/70 bg-exp-dark/60 px-4 py-3">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.13em] text-exp-text">{replayFrame?.label || fixture.label}</p>
              <p className="mt-1 text-xs text-exp-text-dim">{replayFrame?.description || fixture.description}</p>
            </div>
            <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-exp-text-dim">Camera remains player controlled</p>
          </div>
        </div>

        <aside className="rounded-xl border border-exp-border/70 bg-exp-panel/80 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-exp-text-dim">Exact-engine replays</p>
          <select value={replayId} onChange={(event) => updateParams({ scenario: event.target.value, turn: 0 })} className="mt-3 min-h-11 w-full rounded border border-exp-border bg-exp-dark px-3 font-mono text-xs text-exp-text" aria-label="Exact-engine replay">
            <option value="">Contract fixtures</option>
            {replays.map((item) => <option key={item.scenarioId} value={item.scenarioId}>{item.label}</option>)}
          </select>
          {replay && (
            <>
              <label className="mt-5 block font-mono text-[9px] uppercase tracking-[0.18em] text-exp-text-dim" htmlFor="board-turn">Turn {turn + 1} / {replay.frames.length}</label>
              <input id="board-turn" className="mt-3 w-full accent-[#e8c860]" type="range" min="0" max={Math.max(0, replay.frames.length - 1)} value={Math.min(turn, replay.frames.length - 1)} onChange={(event) => updateParams({ turn: event.target.value })} />
              <p className="mt-3 break-all font-mono text-[8px] uppercase tracking-[0.08em] text-exp-text-dim">Trace {replay.traceHash || 'unavailable'}</p>
            </>
          )}
          <div className="mt-5 space-y-3 border-t border-exp-border/70 pt-4 text-xs text-exp-text-dim">
            <div><span className="font-mono text-[9px] uppercase tracking-[0.16em]">Audio</span><p className="mt-1 text-exp-text">{beat.soundCue}</p></div>
            <div><span className="font-mono text-[9px] uppercase tracking-[0.16em]">Motion</span><p className="mt-1 text-exp-text">{beat.motionCue}</p></div>
            <div><span className="font-mono text-[9px] uppercase tracking-[0.16em]">Reduced motion</span><p className="mt-1 text-exp-text">{beat.reducedMotion}</p></div>
            <div><span className="font-mono text-[9px] uppercase tracking-[0.16em]">Camera suggestion</span><p className="mt-1 text-exp-text">{beat.camera.suggestion} / never automatic</p></div>
          </div>
          <button type="button" className="mt-5 min-h-11 w-full rounded border border-exp-border bg-exp-dark/55 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim hover:border-compass/45 hover:text-exp-text" onClick={() => setRendererGeneration((value) => value + 1)}>
            Remount board renderer
          </button>
        </aside>
      </div>
    </section>
  );
}
