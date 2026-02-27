export default function SpectatorBanner() {
  return (
    <div className="border border-blueprint/30 rounded bg-blueprint/5 p-3">
      <h3 className="font-mono text-[10px] tracking-[0.3em] text-blueprint uppercase mb-1">
        Spectator Mode
      </h3>
      <p className="font-mono text-xs text-exp-text-dim">
        You can watch the expedition live, replay events, and inspect state. Join this game from staging to submit actions.
      </p>
    </div>
  );
}
