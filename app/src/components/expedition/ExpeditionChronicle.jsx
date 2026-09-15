import { useMemo, useState } from 'react';
import { buildExpeditionChronicle, buildExpeditionPassport } from '../../lib/expeditionChronicle';
import ShareGameLink from '../shared/ShareGameLink';

const TONES = {
  red: 'border-signal-red/35 text-signal-red',
  gold: 'border-compass/35 text-compass-bright',
  green: 'border-oxide-green/35 text-oxide-green',
  blue: 'border-blueprint/35 text-blueprint',
  neutral: 'border-exp-border/70 text-exp-text-dim',
};

export default function ExpeditionChronicle({ gameId, events = [], eventSyncStatus = 'restoring', confirmedBlock = 0 }) {
  const [exported, setExported] = useState(false);
  const resumeUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/game/${gameId}`;
    return `${window.location.origin}/game/${gameId}`;
  }, [gameId]);
  const entries = useMemo(
    () => buildExpeditionChronicle(events, { confirmedBlock }).slice(-12).reverse(),
    [confirmedBlock, events],
  );
  const passport = useMemo(() => buildExpeditionPassport({
    gameId,
    url: resumeUrl,
    events,
  }), [events, gameId, resumeUrl]);

  const downloadPassport = () => {
    const blob = new Blob([`${JSON.stringify(passport, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `xenovoya-expedition-${gameId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 1800);
  };

  return (
    <section className="rounded border border-compass/30 bg-exp-panel/80 p-4" aria-labelledby="chronicle-title" data-testid="expedition-chronicle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-compass">Expedition record</p>
          <h3 id="chronicle-title" className="mt-1 font-display text-lg uppercase tracking-[0.14em] text-exp-text">Expedition Chronicle</h3>
          <p className="mt-1 max-w-2xl font-mono text-[11px] leading-relaxed text-exp-text-dim">
            A human-readable record of the crew's discoveries, decisions, and outcomes.
          </p>
        </div>
        <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${eventSyncStatus === 'live' ? 'border-oxide-green/35 bg-oxide-green/5 text-oxide-green' : 'border-blueprint/35 bg-blueprint/5 text-blueprint'}`}>
          {eventSyncStatus === 'live' ? 'Up to date' : eventSyncStatus}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-y border-exp-border/60 py-3">
        <ShareGameLink label="Copy resume link" url={resumeUrl} shareText={`Resume or observe Xenovoya expedition #${gameId}`} />
        <button type="button" onClick={downloadPassport} className="min-h-11 rounded border border-exp-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim hover:border-blueprint/50 hover:text-blueprint">
          {exported ? 'Journal exported' : 'Export expedition journal'}
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 font-mono text-xs text-exp-text-dim">Restoring the first recorded chapter...</p>
      ) : (
        <ol className="mt-3 grid gap-2 md:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.id} className={`rounded border bg-exp-dark/35 px-3 py-2 ${TONES[entry.tone] || TONES.neutral}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.12em]">{entry.title}</p>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] opacity-70">{entry.finality}</span>
              </div>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">{entry.body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
