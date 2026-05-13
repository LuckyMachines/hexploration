export default function MoveControl({
  currentLocation,
  movement,
  path = [],
  validation,
  routeStatus,
  onSubmit,
  onClear,
  onBacktrack,
  disabled,
}) {
  const status = routeStatus || {
    used: path.length,
    budget: movement,
    remaining: Math.max(0, Number(movement || 0) - path.length),
    isValid: validation?.ok !== false,
    invalidReason: validation?.reason || '',
    label: `${path.length}/${movement} steps planned`,
    inventoryNote: 'No route item equipped.',
    companionNote: 'No crew signal near intent.',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-exp-text-dim">
          Click reachable tiles on the map to build your route. Movement: <span className="text-compass">{movement}</span>.
        </p>
        <span className="font-mono text-xs text-compass tabular-nums">
          {status.used}/{status.budget}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-exp-text-dim">
            Route
          </p>
          <p className={`mt-1 font-mono text-xs ${status.isValid ? 'text-compass-bright' : 'text-signal-red'}`}>
            {status.label}
          </p>
        </div>
        <div className="rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-blueprint">
            Gear
          </p>
          <p className="mt-1 font-mono text-xs text-exp-text-dim">
            {status.inventoryNote}
          </p>
        </div>
        <div className="rounded border border-oxide-green/25 bg-oxide-green/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-oxide-green">
            Crew
          </p>
          <p className="mt-1 font-mono text-xs text-exp-text-dim">
            {status.companionNote}
          </p>
        </div>
      </div>

      {/* Current path display */}
      {path.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-mono text-xs text-exp-text-dim uppercase tracking-wider">Path:</span>
          <span className="font-mono text-xs text-compass">{currentLocation}</span>
          {path.map((alias, i) => (
            <span key={i} className="flex items-center gap-1">
              <svg className="w-3 h-3 text-exp-text-dim" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 2l4 4-4 4" />
              </svg>
              <span className="font-mono text-xs text-compass">{alias}</span>
            </span>
          ))}
        </div>
      )}

      {path.length > 0 && validation && (
        <div className={`rounded border px-3 py-2 font-mono text-[11px] ${
          validation.ok
            ? 'border-oxide-green/30 bg-oxide-green/5 text-oxide-green'
            : 'border-signal-red/30 bg-signal-red/5 text-signal-red'
        }`}>
          {validation.reason}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={disabled || path.length === 0 || !status.isValid}
          className="alive-commit-button px-4 py-2 bg-compass/10 border border-compass/40 rounded text-compass text-xs font-mono tracking-widest uppercase
                     hover:bg-compass/20 hover:border-compass/60 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Move
        </button>
        {path.length > 0 && (
          <button
            onClick={onBacktrack}
            className="alive-cancel-button px-3 py-2 border border-blueprint/35 rounded text-blueprint text-xs font-mono tracking-wider uppercase
                       hover:border-blueprint/60 transition-colors"
          >
            Undo Step
          </button>
        )}
        {path.length > 0 && (
          <button
            onClick={onClear}
            className="alive-cancel-button px-3 py-2 border border-exp-border rounded text-exp-text-dim text-xs font-mono tracking-wider uppercase
                       hover:border-exp-text-dim/40 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
