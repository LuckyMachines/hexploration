const TONE_CLASS = {
  red: 'border-signal-red/30 text-signal-red',
  gold: 'border-compass/30 text-compass-bright',
  green: 'border-oxide-green/30 text-oxide-green',
  blue: 'border-blueprint/30 text-blueprint',
  neutral: 'border-exp-border/60 text-exp-text-dim',
};

function toneClass(tone) {
  return TONE_CLASS[tone] || TONE_CLASS.neutral;
}

export default function DiscoveryJournal({ entries = [] }) {
  if (entries.length === 0) return null;

  return (
    <div className="rounded border border-exp-border bg-exp-panel p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
            Field journal
          </p>
          <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
            Named moments, omens, and chain scars.
          </p>
        </div>
        <span className="rounded border border-compass/30 bg-compass/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-compass">
          {entries.length} notes
        </span>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`rounded border bg-exp-dark/35 px-3 py-2 ${toneClass(entry.tone)}`}
          >
            <p className="font-mono text-xs uppercase tracking-[0.16em]">
              {entry.title}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
              {entry.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
