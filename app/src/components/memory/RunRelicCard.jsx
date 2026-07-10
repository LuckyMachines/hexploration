export default function RunRelicCard({ card, compact = false }) {
  if (!card) {
    return (
      <div className="rounded border border-exp-border bg-exp-dark/35 px-4 py-4 font-mono text-xs text-exp-text-dim">
        Complete an expedition to create a Run Relic Card.
      </div>
    );
  }
  const p = card.palette;
  const badges = card.badges.length ? card.badges : ['Unbadged Legend'];
  return (
    <article
      className={`overflow-hidden rounded border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${compact ? '' : 'mx-auto max-w-xl'}`}
      style={{
        borderColor: `${p.accent}99`,
        background: `linear-gradient(145deg, ${p.bg}, ${p.panel} 55%, #070907)`,
      }}
      aria-label={`${card.title} Run Relic Card`}
    >
      <div className="rounded border p-4" style={{ borderColor: `${p.route}66`, backgroundColor: `${p.panel}d9` }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: p.accent }}>
              {card.eyebrow}
            </p>
            <h3 className="mt-2 font-display text-2xl uppercase tracking-[0.1em] text-exp-text sm:text-3xl">
              {card.title}
            </h3>
            <p className="mt-1 font-mono text-[11px] leading-relaxed" style={{ color: p.dim }}>
              {card.subtitle}
            </p>
          </div>
          <span className="rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]" style={{ borderColor: `${p.accent2}88`, color: p.accent2 }}>
            {card.stamp}
          </span>
        </div>
        <p className="mt-4 font-mono text-sm leading-relaxed text-exp-text">
          &quot;{card.quote}&quot;
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Score', card.score],
          ['Arc', card.arc],
          ['Pressure', card.pressure],
          ['Crew', card.crew],
        ].map(([label, value]) => (
          <div key={label} className="min-h-20 rounded border border-exp-border/60 bg-exp-dark/45 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">{label}</p>
            <p className="mt-1 break-words font-mono text-sm text-exp-text">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim">Route Memory</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: p.accent2 }}>
            {card.outcome}
          </p>
        </div>
        <div className="grid grid-cols-9 gap-1.5">
          {card.routeMarks.map((mark, index) => {
            const fill = mark.danger ? p.danger : mark.value ? p.accent2 : mark.active ? p.route : p.panel;
            return (
              <div
                key={`${card.id}-route-${index}`}
                className="aspect-square border border-exp-border/50"
                style={{
                  backgroundColor: fill,
                  opacity: mark.active || mark.danger || mark.value ? 0.9 : 0.45,
                  clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)',
                }}
              />
            );
          })}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-exp-text-dim">Cost: <span className="text-exp-text">{card.cost}</span></p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-exp-text-dim">Value: <span className="text-exp-text">{card.value}</span></p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {badges.slice(0, compact ? 4 : 6).map((badge) => (
          <span key={badge} className="rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: `${p.accent}88`, color: p.accent }}>
            {badge}
          </span>
        ))}
      </div>

      <div className="mt-3 rounded border px-3 py-3" style={{ borderColor: `${p.accent2}77`, backgroundColor: `${p.panel}cc` }}>
        {card.fingerprint && (
          <div className="mb-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim">Fingerprint</p>
            <p className="mt-1 font-display text-lg uppercase tracking-[0.12em] text-exp-text">{card.fingerprint.title}</p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">{card.fingerprint.replayHook}</p>
          </div>
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.22em]" style={{ color: p.accent2 }}>
          {card.challengeTitle}
        </p>
        <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">{card.challengeTarget}</p>
      </div>
    </article>
  );
}
