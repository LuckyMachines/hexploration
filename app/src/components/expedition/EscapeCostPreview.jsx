import { escapeCostToneClass } from '../../lib/escapeCostPreview';

export default function EscapeCostPreview({ preview, compact = false }) {
  if (!preview) return null;

  const toneClass = escapeCostToneClass(preview);
  if (compact) {
    return (
      <div className={`rounded border px-3 py-2 ${toneClass}`}>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-75">
          Escape cost
        </p>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-exp-text">
          {preview.headline}
        </p>
        <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
          {preview.nextDelayWarning}
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded border px-3 py-2 ${toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-75">
            Escape Cost Preview
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-exp-text">
            {preview.headline}
          </p>
        </div>
        <span className="rounded border border-current/30 bg-exp-dark/25 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em]">
          {preview.label}
        </span>
      </div>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">
        {preview.body}
      </p>
      <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
        {preview.nextDelayWarning}
      </p>
    </div>
  );
}
