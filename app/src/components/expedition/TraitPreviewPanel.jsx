import { traitToneClass } from '../../lib/tileTraits';

export default function TraitPreviewPanel({ preview, compact = false }) {
  if (!preview?.trait) return null;
  const { trait, effect } = preview;
  const toneClass = traitToneClass(trait);

  return (
    <div className={`rounded border px-3 py-2 ${toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-75">
            Tile trait
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-exp-text">
            {trait.label}
          </p>
        </div>
        <span className="rounded border border-current/30 bg-exp-dark/25 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
          {preview.preferredActionLabel}
        </span>
      </div>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">
        {preview.body}
      </p>
      {!compact && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded border border-current/20 bg-exp-dark/25 px-2 py-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">Pressure</p>
            <p className="mt-1 font-mono text-xs text-exp-text">{signed(effect?.pressureDelta)}</p>
          </div>
          <div className="rounded border border-current/20 bg-exp-dark/25 px-2 py-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">Cost</p>
            <p className="mt-1 font-mono text-xs text-exp-text">{signed(effect?.costDelta)}</p>
          </div>
          <div className="rounded border border-current/20 bg-exp-dark/25 px-2 py-1.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">Route</p>
            <p className="mt-1 font-mono text-xs text-exp-text">{signed(effect?.routeDelta)}</p>
          </div>
        </div>
      )}
      {preview.warning && (
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-signal-red">
          {preview.warning}
        </p>
      )}
      <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
        {preview.routeNote}
      </p>
    </div>
  );
}

function signed(value = 0) {
  const number = Number(value || 0);
  if (number > 0) return `+${number}`;
  return String(number);
}
