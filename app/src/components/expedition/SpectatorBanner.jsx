export default function SpectatorBanner() {
  return (
    <div className="border border-blueprint/30 rounded bg-blueprint/5 p-3">
      <h3 className="font-mono text-xs tracking-[0.3em] text-blueprint uppercase mb-1">
        Spectator Mode
      </h3>
      <p className="font-mono text-xs text-exp-text-dim">
        No wallet is needed to watch the 3D expedition, replay events, or inspect crew state. A signature is requested only when you join or submit an action.
      </p>
    </div>
  );
}
