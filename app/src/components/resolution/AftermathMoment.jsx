import { aftermathToneClass } from '../../lib/turnAftermath';

export default function AftermathMoment({ moment, departPressure, escapeCostPreview, expeditionArc }) {
  if (!moment) return null;

  return (
    <div className={`rounded border px-4 py-3 ${aftermathToneClass(moment.tone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] opacity-75">
            Turn aftermath
          </p>
          <h4 className="mt-1 font-display text-lg uppercase tracking-[0.14em] text-exp-text">
            {moment.title}
          </h4>
        </div>
        <span className="rounded border border-current/30 bg-exp-dark/25 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em]">
          {moment.category.replace(/-/g, ' ')}
        </span>
      </div>

      <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">
        {moment.summary}
      </p>

      <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr]">
        <div className="rounded border border-current/20 bg-exp-dark/25 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
            Why it matters
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {moment.whyItMatters}
          </p>
        </div>
        <div className="rounded border border-current/20 bg-exp-dark/25 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
            Next turn
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {moment.nextPrompt}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {expeditionArc && (
          <div className="rounded border border-current/20 bg-exp-dark/30 px-2 py-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
              Run chapter
            </p>
            <p className="mt-1 font-mono text-xs text-exp-text">
              {expeditionArc.label}
            </p>
          </div>
        )}
        {(moment.receipts || []).map((item) => (
          <div key={`${item.label}-${item.value}`} className="rounded border border-current/20 bg-exp-dark/30 px-2 py-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
              {item.label}
            </p>
            <p className="mt-1 font-mono text-xs text-exp-text">
              {item.value}
            </p>
          </div>
        ))}
        {(departPressure || escapeCostPreview) && (
          <div className="rounded border border-current/20 bg-exp-dark/30 px-2 py-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
              Pressure read
            </p>
            <p className="mt-1 font-mono text-xs text-exp-text">
              {escapeCostPreview?.headline || (departPressure ? `${departPressure.pressure} ${departPressure.band.label}` : 'Unknown')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
