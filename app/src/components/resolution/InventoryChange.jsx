export default function InventoryChange({ inventoryChange }) {
  if (!inventoryChange || inventoryChange.length < 3) return null;

  // inventoryChange is [string, string, string] - [gained, lost, description] or similar
  const items = inventoryChange.filter((item) => item && item !== '');

  if (items.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap mt-1">
      {items.map((item, i) => {
        // First item is typically gained, second is lost
        const isGain = i === 0;
        return (
          <span
            key={i}
            className={`font-mono text-[10px] px-1.5 py-0.5 rounded border
              ${isGain
                ? 'text-compass border-compass/30 bg-compass/5'
                : 'text-exp-text-dim border-exp-border bg-exp-dark/40'
              }
            `}
          >
            {isGain ? '+' : ''}{item}
          </span>
        );
      })}
    </div>
  );
}
