import { Link } from 'react-router-dom';
import BadgeShelf from './BadgeShelf';
import ExpeditionFingerprintCard from '../expedition/ExpeditionFingerprintCard';

function memoryTone(memory = {}) {
  if (memory.outcome === 'escaped' && memory.escapeCostLevel === 'clean') return 'border-oxide-green/35 bg-oxide-green/5';
  if ((memory.finalPressure || 0) >= 75 || String(memory.outcome || '').includes('collapsed')) return 'border-signal-red/35 bg-signal-red/5';
  return 'border-compass/30 bg-compass/5';
}

export default function MemoryCard({ memory, label = 'Memory', compact = false }) {
  if (!memory) {
    return (
      <div className="rounded border border-exp-border bg-exp-dark/35 px-3 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">{label}</p>
        <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">Finish an expedition to create a record here.</p>
      </div>
    );
  }
  const targetPath = memory.replayPath || memory.reportPath || null;
  return (
    <article className={`rounded border px-3 py-3 ${memoryTone(memory)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">{label}</p>
          <h3 className="mt-1 font-display text-lg uppercase tracking-[0.12em] text-exp-text">{memory.title}</h3>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {memory.scenarioName} / {memory.outcomeLabel}
          </p>
        </div>
        <div className="min-w-20 rounded border border-exp-border/70 bg-exp-dark/45 px-2 py-1 text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">Score</p>
          <p className="font-mono text-lg text-compass-bright">{memory.score}</p>
        </div>
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : 'sm:grid-cols-4'}`}>
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-2 py-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Pressure</p>
          <p className="font-mono text-xs text-exp-text">{memory.finalPressure}</p>
        </div>
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-2 py-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Cost</p>
          <p className="font-mono text-xs text-exp-text">{memory.escapeCostLabel}</p>
        </div>
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-2 py-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Value</p>
          <p className="font-mono text-xs text-exp-text">{memory.artifacts}</p>
        </div>
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-2 py-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Crew</p>
          <p className="font-mono text-xs text-exp-text">{memory.survivors}/{memory.crew}</p>
        </div>
      </div>
      {memory.fingerprint && (
        <div className="mt-3">
          <ExpeditionFingerprintCard fingerprint={memory.fingerprint} compact label="Memory Fingerprint" />
        </div>
      )}
      {!compact && memory.insight && (
        <p className="mt-3 font-mono text-xs leading-relaxed text-exp-text">{memory.insight}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <BadgeShelf badges={memory.badges || []} limit={compact ? 3 : 6} />
        {targetPath && (
          <Link to={targetPath} className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">
            Open record
          </Link>
        )}
      </div>
    </article>
  );
}
