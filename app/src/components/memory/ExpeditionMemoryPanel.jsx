import { useEffect, useMemo, useState } from 'react';
import { deriveNextChallenge } from '../../lib/expeditionChallenges';
import { loadExpeditionMemory, memoryStats, summarizeExpeditionMemory } from '../../lib/expeditionMemory';
import BadgeShelf from './BadgeShelf';
import BeatThisChallenge from './BeatThisChallenge';
import MemoryCard from './MemoryCard';

export default function ExpeditionMemoryPanel({ initialMemory = null, latestMemory = null, compact = false, title = 'Expedition Memory' }) {
  const [memory, setMemory] = useState(() => initialMemory || loadExpeditionMemory());

  useEffect(() => {
    if (initialMemory) {
      setMemory(initialMemory);
      return;
    }
    setMemory(loadExpeditionMemory());
  }, [initialMemory]);

  const summary = useMemo(() => summarizeExpeditionMemory(memory), [memory]);
  const stats = useMemo(() => memoryStats(memory), [memory]);
  const challenge = useMemo(() => deriveNextChallenge(memory, latestMemory || stats.latest), [latestMemory, memory, stats.latest]);
  const latest = latestMemory || stats.latest;

  return (
    <section className="rounded border border-exp-border bg-exp-panel/90 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-compass">{title}</p>
          <h2 className="mt-1 font-display text-2xl uppercase tracking-[0.14em] text-exp-text">{summary.headline}</h2>
          <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{summary.body}</p>
        </div>
        <div className="grid min-w-44 grid-cols-2 gap-2">
          <div className="rounded border border-exp-border/60 bg-exp-dark/45 px-2 py-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Escapes</p>
            <p className="font-mono text-lg text-oxide-green">{stats.escapes}</p>
          </div>
          <div className="rounded border border-exp-border/60 bg-exp-dark/45 px-2 py-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Best</p>
            <p className="font-mono text-lg text-compass-bright">{stats.bestScore}</p>
          </div>
        </div>
      </div>
      <div className={`mt-4 grid gap-3 ${compact ? '' : 'lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,0.7fr)]'}`}>
        <div className="space-y-3">
          <MemoryCard memory={latest} label="Latest Memory" compact={compact} />
          {!compact && stats.best && stats.best.id !== latest?.id && <MemoryCard memory={stats.best} label="Best Memory" compact />}
        </div>
        <div className="space-y-3">
          <BeatThisChallenge challenge={challenge} compact={compact} />
          <div className="rounded border border-exp-border/70 bg-exp-dark/35 px-3 py-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Unlocked Badges</p>
            <BadgeShelf badges={stats.badges} limit={compact ? 5 : 10} />
          </div>
        </div>
      </div>
    </section>
  );
}
