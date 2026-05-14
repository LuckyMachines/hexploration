export default function UXStatusPanel({ guidance, suggestion, onSuggestion }) {
  if (!guidance) return null;

  const toneClass = {
    gold: 'border-compass/35 bg-compass/5 text-compass-bright',
    green: 'border-oxide-green/35 bg-oxide-green/5 text-oxide-green',
    blue: 'border-blueprint/35 bg-blueprint/5 text-blueprint',
    red: 'border-signal-red/35 bg-signal-red/5 text-signal-red',
  }[guidance.tone] || 'border-exp-border bg-exp-dark/35 text-exp-text-dim';

  return (
    <div className={`rounded border px-4 py-3 ${toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em]">
            What can I do now?
          </p>
          <h3 className="mt-1 font-display text-lg uppercase tracking-[0.12em] text-exp-text">
            {guidance.title}
          </h3>
          <p className="mt-1 max-w-3xl font-mono text-xs leading-relaxed text-exp-text-dim">
            {guidance.body}
          </p>
        </div>
        {suggestion?.label && (
          <button
            type="button"
            onClick={onSuggestion}
            disabled={!suggestion.action}
            className="rounded border border-current/35 bg-exp-dark/25 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors hover:bg-exp-dark/45 disabled:cursor-not-allowed disabled:opacity-60"
            title={suggestion.reason}
          >
            {suggestion.label}
          </button>
        )}
      </div>
      {suggestion?.reason && (
        <p className="mt-2 font-mono text-[11px] text-exp-text-dim">
          Suggestion: {suggestion.reason}
        </p>
      )}
    </div>
  );
}

