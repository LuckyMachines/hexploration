import { ACTION_LABELS } from '../../lib/constants';
import StatChange from './StatChange';
import InventoryChange from './InventoryChange';

export default function ActionResult({ playerAction }) {
  if (!playerAction) return null;

  const pid = playerAction.playerID !== undefined ? Number(playerAction.playerID) : '?';
  const actionIndex = playerAction.currentAction !== undefined
    ? Number(playerAction.currentAction)
    : 0;
  const actionLabel = ACTION_LABELS[actionIndex] || `Action ${actionIndex}`;
  const cardType = playerAction.cardType || '';
  const cardDrawn = playerAction.cardDrawn || '';
  const cardResult = playerAction.cardResult || '';
  const movementPath = playerAction.movementPath || [];

  return (
    <div className="flex items-start gap-3 p-2 rounded border border-exp-border/50 bg-exp-dark/40">
      <span className="shrink-0 w-6 h-6 rounded-full bg-compass/20 border border-compass/40
                       flex items-center justify-center text-compass text-[10px] font-mono tabular-nums">
        P{pid}
      </span>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-compass uppercase tracking-wider">
            {actionLabel}
          </span>
          {cardType ? (
            <span className="font-mono text-[10px] text-exp-text-dim uppercase">
              {cardType}
            </span>
          ) : null}
        </div>

        {cardDrawn ? (
          <p className="font-mono text-[10px] text-exp-text-dim leading-relaxed">
            Card: {cardDrawn}
          </p>
        ) : null}

        {cardResult ? (
          <p className="font-mono text-[10px] text-exp-text-dim leading-relaxed">
            {cardResult}
          </p>
        ) : null}

        {movementPath.length > 0 ? (
          <p className="font-mono text-[10px] text-exp-text-dim leading-relaxed">
            Path: {movementPath.join(' -> ')}
          </p>
        ) : null}

        <StatChange statUpdate={playerAction.statUpdates} />
        <InventoryChange inventoryChange={playerAction.inventoryChanges} />
      </div>
    </div>
  );
}
