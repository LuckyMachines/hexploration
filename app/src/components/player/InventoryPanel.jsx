export default function InventoryPanel({ active, inactive }) {
  const hasArtifact = active?.artifact && active.artifact !== '';
  const hasRelic = active?.relic && active.relic !== '';

  return (
    <div className="border border-exp-border rounded bg-exp-dark/40 p-3">
      <h4 className="font-mono text-[10px] tracking-[0.3em] text-exp-text-dim uppercase mb-2">
        Inventory
      </h4>

      {/* Active inventory */}
      <div className="space-y-1 mb-2">
        {hasArtifact && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-compass shrink-0" />
            <span className="font-mono text-xs text-compass">{active.artifact}</span>
            {active.status && (
              <span className="font-mono text-[10px] text-exp-text-dim">({active.status})</span>
            )}
          </div>
        )}
        {hasRelic && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-relic shrink-0" />
            <span className="font-mono text-xs text-relic">{active.relic}</span>
          </div>
        )}
        {active?.shield && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blueprint shrink-0" />
            <span className="font-mono text-xs text-blueprint">Shield Active</span>
          </div>
        )}
        {active?.campsite && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-oxide-green shrink-0" />
            <span className="font-mono text-xs text-oxide-green">Campsite Kit</span>
          </div>
        )}
      </div>

      {/* Inactive inventory (bag) */}
      {inactive?.itemTypes?.length > 0 && (
        <div className="border-t border-exp-border/50 pt-2">
          <span className="font-mono text-[10px] text-exp-text-dim uppercase tracking-wider">Bag</span>
          <div className="mt-1 space-y-0.5">
            {inactive.itemTypes.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-exp-text-dim">{item}</span>
                <span className="font-mono text-[10px] text-exp-text tabular-nums">
                  x{Number(inactive.itemBalances[i] || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasArtifact && !hasRelic && !active?.shield && !active?.campsite && inactive?.itemTypes?.length === 0 && (
        <p className="font-mono text-[10px] text-exp-text-dim italic">Empty</p>
      )}
    </div>
  );
}
