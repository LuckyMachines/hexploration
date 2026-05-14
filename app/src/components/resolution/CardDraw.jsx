import StatChange from './StatChange';
import InventoryChange from './InventoryChange';
import { cardOutcomeDetail } from '../../lib/detailText';

export default function CardDraw({ playerID, cardType, cardDrawn, cardResult, inventoryChange, statUpdate }) {
  if (!cardDrawn && !cardType) return null;
  const detail = cardOutcomeDetail({ cardType, cardDrawn, cardResult, inventoryChange, statUpdate });

  return (
    <div className="border border-exp-border/50 rounded p-3 bg-exp-dark/40">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="shrink-0 w-6 h-6 rounded-full bg-compass/20 border border-compass/40
                         flex items-center justify-center text-compass text-xs font-mono tabular-nums">
          P{playerID}
        </span>
        <div>
          {cardType && (
            <span className="font-mono text-xs text-exp-text-dim uppercase tracking-wider block">
              {cardType}
            </span>
          )}
          <span className="font-mono text-xs text-compass-bright">
            {cardDrawn || 'Unknown Card'}
          </span>
        </div>
      </div>

      <div className="mb-2 rounded border border-blueprint/25 bg-blueprint/5 px-2 py-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-blueprint">
          Card detail
        </p>
        <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
          {detail.headline}
        </p>
      </div>

      {/* Card result description */}
      {cardResult && (
        <p className="font-mono text-xs text-exp-text-dim leading-relaxed mb-2">
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
