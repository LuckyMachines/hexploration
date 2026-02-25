export default function DigControl({ onSubmit, disabled }) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-exp-text-dim">
        Search the ground at your current location for buried artifacts and relics.
        Success depends on your <span className="text-blueprint">Dexterity</span> stat and the terrain type.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={onSubmit}
          disabled={disabled}
          className="px-4 py-2 bg-desert/10 border border-desert/40 rounded text-desert text-xs font-mono tracking-widest uppercase
                     hover:bg-desert/20 hover:border-desert/60 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Dig
        </button>
      </div>
    </div>
  );
}
