import { useEffect, useMemo, useState } from 'react';

function replayLabel(event) {
  const gameID = event.args?.gameID !== undefined ? `G${event.args.gameID}` : '';
  return `${event.name}${gameID ? ` ${gameID}` : ''}`;
}

export default function MatchReplay({
  events = [],
  onLoadFullHistory,
  isLoadingFullHistory = false,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);

  const steps = useMemo(
    () => events.map((event, index) => ({
      index,
      blockNumber: event.blockNumber,
      label: replayLabel(event),
      event,
    })),
    [events],
  );

  useEffect(() => {
    if (!isPlaying || steps.length < 2) return undefined;
    const id = setInterval(() => {
      setCursor((prev) => {
        if (prev >= steps.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 900);
    return () => clearInterval(id);
  }, [isPlaying, steps.length]);

  useEffect(() => {
    if (cursor > steps.length - 1) {
      setCursor(Math.max(steps.length - 1, 0));
    }
  }, [steps.length, cursor]);

  const current = steps[cursor];

  return (
    <div className="border border-exp-border rounded bg-exp-panel p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
          Match Replay
        </h3>
        <button
          onClick={() => onLoadFullHistory?.()}
          disabled={!onLoadFullHistory || isLoadingFullHistory}
          className="px-2 py-1 border border-exp-border rounded text-xs font-mono uppercase tracking-wider text-exp-text-dim
                     hover:border-compass/40 hover:text-compass transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoadingFullHistory ? 'Loading history...' : 'Load Full History'}
        </button>
      </div>

      {steps.length === 0 ? (
        <p className="font-mono text-xs text-exp-text-dim italic">No replayable events yet.</p>
      ) : (
        <>
          <div className="border border-exp-border/60 rounded bg-exp-dark/40 p-2">
            <div className="font-mono text-xs text-exp-text-dim uppercase">
              Step {cursor + 1} / {steps.length}
            </div>
            <div className="font-mono text-xs text-compass">{current.label}</div>
            <div className="font-mono text-xs text-exp-text-dim">
              Block {current.blockNumber?.toString?.() || current.blockNumber}
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(steps.length - 1, 0)}
            value={cursor}
            onChange={(e) => setCursor(Number(e.target.value))}
            className="w-full accent-compass"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying((prev) => !prev)}
              className="px-3 py-1.5 bg-compass/10 border border-compass/40 rounded text-compass text-xs font-mono uppercase tracking-wider
                         hover:bg-compass/20 hover:border-compass/60 transition-colors"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setCursor(0);
              }}
              className="px-3 py-1.5 border border-exp-border rounded text-exp-text-dim text-xs font-mono uppercase tracking-wider
                         hover:border-exp-text-dim/40 transition-colors"
            >
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
}
