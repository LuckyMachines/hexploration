export default function EmptyState({
  title,
  body,
  action,
  onAction,
  tone = 'neutral',
}) {
  const toneClass = {
    neutral: 'border-exp-border bg-exp-dark/35 text-exp-text-dim',
    gold: 'border-compass/30 bg-compass/5 text-compass-bright',
    blue: 'border-blueprint/30 bg-blueprint/5 text-blueprint',
    red: 'border-signal-red/30 bg-signal-red/5 text-signal-red',
  }[tone] || 'border-exp-border bg-exp-dark/35 text-exp-text-dim';

  return (
    <div className={`rounded border px-4 py-3 ${toneClass}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.28em]">
        {title}
      </p>
      {body && (
        <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">
          {body}
        </p>
      )}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded border border-current/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors hover:bg-exp-dark/35"
        >
          {action}
        </button>
      )}
    </div>
  );
}

