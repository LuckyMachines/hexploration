import StatChange from './StatChange';
import InventoryChange from './InventoryChange';
import { cardOutcomeDetail } from '../../lib/detailText';
import { cardAftermathTone } from '../../lib/turnAftermath';

export default function CardDraw({ playerID, cardType, cardDrawn, cardResult, inventoryChange, statUpdate }) {
  if (!cardDrawn && !cardType) return null;
  const detail = cardOutcomeDetail({ cardType, cardDrawn, cardResult, inventoryChange, statUpdate });
  const tone = cardAftermathTone({ cardResult, inventoryChange, statUpdate });
  const toneClass = {
    red: 'border-signal-red/30 bg-signal-red/5 text-signal-red',
    gold: 'border-compass/30 bg-compass/5 text-compass-bright',
    green: 'border-oxide-green/30 bg-oxide-green/5 text-oxide-green',
    blue: 'border-blueprint/25 bg-blueprint/5 text-blueprint',
  }[tone] || 'border-blueprint/25 bg-blueprint/5 text-blueprint';

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

      <div className={`mb-2 rounded border px-2 py-1 ${toneClass}`}>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-80">
          Card consequence
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
