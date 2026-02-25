export default function HandSlots({ leftHand, rightHand }) {
  return (
    <div className="flex gap-2">
      <HandSlot label="L" item={leftHand} />
      <HandSlot label="R" item={rightHand} />
    </div>
  );
}

function HandSlot({ label, item }) {
  const hasItem = item && item !== '';

  return (
    <div className={`flex-1 border rounded p-2 text-center transition-colors
      ${hasItem ? 'border-compass/30 bg-compass/5' : 'border-exp-border bg-exp-dark/40'}`}
    >
      <span className="font-mono text-[10px] text-exp-text-dim uppercase tracking-wider block mb-1">
        {label} Hand
      </span>
      <span className={`font-mono text-xs ${hasItem ? 'text-compass' : 'text-exp-text-dim italic'}`}>
        {hasItem ? item : 'Empty'}
      </span>
    </div>
  );
}
