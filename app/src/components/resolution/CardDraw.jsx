import StatChange from './StatChange';
import InventoryChange from './InventoryChange';

export default function CardDraw({ playerID, cardType, cardDrawn, cardResult, inventoryChange, statUpdate }) {
  if (!cardDrawn && !cardType) return null;

  return (
    <div className="border border-exp-border/50 rounded p-3 bg-exp-dark/40">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-compass/20 border border-compass/40
                         flex items-center justify-center text-compass text-[10px] font-mono tabular-nums">
          P{playerID}
        </span>
        <div>
          {cardType && (
            <span className="font-mono text-[10px] text-exp-text-dim uppercase tracking-wider block">
              {cardType}
            </span>
          )}
          <span className="font-mono text-xs text-compass-bright">
            {cardDrawn || 'Unknown Card'}
          </span>
        </div>
      </div>

      {/* Card result description */}
      {cardResult && (
        <p className="font-mono text-[10px] text-exp-text-dim leading-relaxed mb-2">
          {cardResult}
        </p>
      )}

      {/* Stat changes */}
      {statUpdate && (
        <StatChange statUpdate={statUpdate} />
      )}

      {/* Inventory changes */}
      {inventoryChange && (
        <InventoryChange inventoryChange={inventoryChange} />
      )}
    </div>
  );
}
