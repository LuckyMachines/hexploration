import { useLastPlayerActions } from '../../hooks/useLastPlayerActions';
import { useLastDayPhaseEvents } from '../../hooks/useLastDayPhaseEvents';
import ActionResult from './ActionResult';
import CardDraw from './CardDraw';

export default function TurnResolution({ gameId }) {
  const { playerActions } = useLastPlayerActions(gameId);
  const { playerIDs, cardTypes, cardsDrawn, cardResults, inventoryChanges, statUpdates } =
    useLastDayPhaseEvents(gameId);

  const hasActions = playerActions && playerActions.length > 0;
  const hasEvents = playerIDs && playerIDs.length > 0;

  if (!hasActions && !hasEvents) return null;

  return (
    <div className="border border-exp-border rounded bg-exp-surface">
      <div className="border-b border-exp-border px-4 py-3">
        <h3 className="font-display text-xs tracking-[0.25em] text-exp-text-dim uppercase">
          Turn Results
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Player action results */}
        {hasActions && (
          <div>
            <h4 className="font-mono text-[10px] tracking-[0.3em] text-exp-text-dim uppercase mb-2">
              Action Outcomes
            </h4>
            <div className="space-y-2">
              {playerActions.map((pa, i) => (
                <ActionResult key={i} playerAction={pa} />
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        {hasActions && hasEvents && (
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-exp-border" />
            <span className="font-display text-[10px] tracking-[0.3em] text-exp-text-dim uppercase">
              Day Phase Events
            </span>
            <div className="h-px flex-1 bg-exp-border" />
          </div>
        )}

        {/* Card draws from day phase */}
        {hasEvents && (
          <div className="space-y-2">
            {playerIDs.map((pid, i) => (
              <CardDraw
                key={i}
                playerID={Number(pid)}
                cardType={cardTypes[i]}
                cardDrawn={cardsDrawn[i]}
                cardResult={cardResults[i]}
                inventoryChange={inventoryChanges?.[i]}
                statUpdate={statUpdates?.[i]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
