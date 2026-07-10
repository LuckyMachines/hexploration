export default function BadgeShelf({ badges = [], limit = 8 }) {
  const visible = badges.slice(0, limit);
  if (visible.length === 0) {
    return (
      <div className="rounded border border-exp-border/70 bg-exp-dark/40 px-3 py-2 font-mono text-[11px] text-exp-text-dim">
        No memory badges yet.
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((badge) => (
        <span
          key={badge}
          className="rounded border border-oxide-green/35 bg-oxide-green/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-oxide-green"
        >
          {badge}
        </span>
      ))}
      {badges.length > visible.length && (
        <span className="rounded border border-exp-border bg-exp-dark/55 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-exp-text-dim">
          +{badges.length - visible.length}
        </span>
      )}
    </div>
  );
}
