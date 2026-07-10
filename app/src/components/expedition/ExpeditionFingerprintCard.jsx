const toneClasses = {
  compass: 'border-compass/40 bg-compass/10 text-compass-bright',
  blueprint: 'border-blueprint/40 bg-blueprint/10 text-blueprint',
  oxide: 'border-oxide-green/40 bg-oxide-green/10 text-oxide-green',
  signal: 'border-signal-red/40 bg-signal-red/10 text-signal-red',
};

export default function ExpeditionFingerprintCard({ fingerprint = null, compact = false, label = 'Run Fingerprint' }) {
  if (!fingerprint) return null;
  const tone = toneClasses[fingerprint.tone] || toneClasses.compass;
  return (
    <article className={`rounded border ${tone} ${compact ? 'p-3' : 'p-4'} shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-80">{label}</p>
          <h3 className={`${compact ? 'mt-1 text-lg' : 'mt-2 text-2xl'} font-display uppercase tracking-[0.12em] text-exp-text`}>
            {fingerprint.title}
          </h3>
          {fingerprint.subtitle && (
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">{fingerprint.subtitle}</p>
          )}
        </div>
        <span className="rounded border border-current/40 bg-exp-dark/35 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
          Turn {fingerprint.createdTurn || 1}
        </span>
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : 'sm:grid-cols-3'}`}>
        {[
          ['Route', fingerprint.routeShape],
          ['Temptation', fingerprint.temptation],
          ['Danger', fingerprint.danger],
        ].map(([metric, value]) => (
          <div key={metric} className="rounded border border-exp-border/60 bg-exp-dark/35 px-2 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">{metric}</p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text">{value}</p>
          </div>
        ))}
      </div>
      {!compact && (
        <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/30 px-3 py-2">
          <p className="font-mono text-xs leading-relaxed text-exp-text">{fingerprint.replayHook}</p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">Benchmark: {fingerprint.beatTarget}</p>
        </div>
      )}
    </article>
  );
}
