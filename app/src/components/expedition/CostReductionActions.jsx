import { escapeCostToneClass } from '../../lib/escapeCostPreview';

export default function CostReductionActions({
  preview,
  onAction,
  compact = false,
  activeAction = null,
}) {
  const mitigations = preview?.mitigations || [];
  if (mitigations.length === 0) return null;

  const visible = compact ? mitigations.slice(0, 1) : mitigations.slice(0, 3);

  return (
    <div className={`rounded border px-3 py-2 ${escapeCostToneClass(preview)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-75">
          Reduce this cost
        </p>
        {preview.bestMitigation && (
          <span className="rounded border border-current/30 bg-exp-dark/25 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]">
            Best: {preview.bestMitigation.label}
          </span>
        )}
      </div>
      <div className="mt-2 grid gap-2">
        {visible.map((mitigation) => {
          const active = activeAction !== null && mitigation.action === activeAction;
          const canClick = mitigation.available && mitigation.actionable && typeof onAction === 'function';
          return (
            <div key={mitigation.id} className="rounded border border-current/20 bg-exp-dark/25 px-3 py-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-exp-text">
                    {mitigation.label}
                  </p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
                    {mitigation.available ? mitigation.effect : mitigation.requirement}
                  </p>
                </div>
                {canClick ? (
                  <button
                    type="button"
                    onClick={() => onAction(mitigation.action)}
                    className="shrink-0 rounded border border-current/35 bg-exp-dark/35 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] hover:bg-exp-dark/55"
                  >
                    {active ? 'Selected' : mitigation.actionLabel}
                  </button>
                ) : (
                  <span className="shrink-0 rounded border border-current/25 bg-exp-dark/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] opacity-70">
                    {mitigation.available ? mitigation.actionLabel || 'Guidance' : 'Blocked'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
