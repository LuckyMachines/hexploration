import Spinner from '../shared/Spinner';

export default function CampControl({ activeInv, onSubmitSetup, onSubmitBreakdown, disabled }) {
  const hasCampsiteKit = activeInv?.campsite ?? false;

  return (
    <div className="space-y-4">
      {/* Setup Camp */}
      <div className="border border-exp-border rounded p-3 bg-exp-dark/40">
        <h4 className="font-display text-xs tracking-widest uppercase text-oxide-green mb-2">
          Setup Camp
        </h4>
        <p className="font-mono text-xs text-exp-text-dim mb-3">
          Establish a campsite at your current location. Requires a campsite kit in your inventory.
        </p>
        <button
          onClick={onSubmitSetup}
          disabled={disabled || !hasCampsiteKit}
          className="px-4 py-2 bg-oxide-green/10 border border-oxide-green/40 rounded text-oxide-green text-xs font-mono tracking-widest uppercase
                     hover:bg-oxide-green/20 hover:border-oxide-green/60 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Setup Camp
        </button>
        {!hasCampsiteKit && (
          <p className="font-mono text-[10px] text-exp-text-dim italic mt-2">
            No campsite kit available.
          </p>
        )}
      </div>

      {/* Break Down Camp */}
      <div className="border border-exp-border rounded p-3 bg-exp-dark/40">
        <h4 className="font-display text-xs tracking-widest uppercase text-oxide-green mb-2">
          Break Down Camp
        </h4>
        <p className="font-mono text-xs text-exp-text-dim mb-3">
          Pack up an existing campsite at your current tile and reclaim it.
        </p>
        <button
          onClick={onSubmitBreakdown}
          disabled={disabled}
          className="px-4 py-2 bg-oxide-green/10 border border-oxide-green/40 rounded text-oxide-green text-xs font-mono tracking-widest uppercase
                     hover:bg-oxide-green/20 hover:border-oxide-green/60 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Break Down Camp
        </button>
      </div>
    </div>
  );
}
