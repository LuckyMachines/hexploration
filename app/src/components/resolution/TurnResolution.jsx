import { useState } from 'react';
import { useLastPlayerActions } from '../../hooks/useLastPlayerActions';
import { useLastDayPhaseEvents } from '../../hooks/useLastDayPhaseEvents';
import { buildTurnReplay } from '../../lib/turnReplay';
import { deriveTurnAftermath } from '../../lib/turnAftermath';
import { truncateAddress } from '../../lib/formatting';
import ActionResult from './ActionResult';
import CardDraw from './CardDraw';
import AftermathMoment from './AftermathMoment';

function countNonZero(values = []) {
  return values.filter((value) => Number(value) !== 0).length;
}

export default function TurnResolution({
  gameId,
  events = [],
  turnState,
  turnReplay,
  departPressure,
  escapeCostPreview,
  traitPreview,
}) {
  const { playerActions } = useLastPlayerActions(gameId);
  const { playerIDs, cardTypes, cardsDrawn, cardResults, inventoryChanges, statUpdates } =
    useLastDayPhaseEvents(gameId);

  const hasActions = playerActions && playerActions.length > 0;
  const hasEvents = playerIDs && playerIDs.length > 0;

  const replay = turnReplay || buildTurnReplay(events);
  const latestEvents = replay.steps.slice(-4).reverse();
  const replayProof = replay.proof || [];
  const [selectedReplayIndex, setSelectedReplayIndex] = useState(Math.max(0, replay.steps.length - 1));
  const selectedStep = replay.steps[Math.min(selectedReplayIndex, Math.max(0, replay.steps.length - 1))];
  const groupedEntries = Object.entries(replay.grouped || {});
  const actionCount = playerActions?.length || 0;
  const cardCount = cardsDrawn?.filter(Boolean).length || 0;
  const statDeltaCount = (statUpdates || []).reduce((sum, update) => sum + countNonZero(update || []), 0);
  const inventoryDeltaCount = (inventoryChanges || []).reduce(
    (sum, update) => sum + (update || []).filter((item) => item && item !== '').length,
    0,
  );
  const aftermath = deriveTurnAftermath({
    playerActions,
    playerIDs,
    cardTypes,
    cardsDrawn,
    cardResults,
    inventoryChanges,
    statUpdates,
    replay,
    departPressure,
    escapeCostPreview,
    traitPreview,
  });

  if (!hasActions && !hasEvents && latestEvents.length === 0) return null;

  return (
    <div className="border border-exp-border rounded bg-exp-surface">
      <div className="border-b border-exp-border px-4 py-3">
        <h3 className="font-display text-xs tracking-[0.25em] text-exp-text-dim uppercase">
          Turn Results
        </h3>
        {turnState && (
          <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
            {turnState.label}: {turnState.copy}
          </p>
        )}
      </div>

      <div className="p-4 space-y-4">
        <AftermathMoment
          moment={aftermath}
          departPressure={departPressure}
          escapeCostPreview={escapeCostPreview}
        />

        <div className="grid gap-2 sm:grid-cols-4">
          {[
            ['Actions', actionCount],
            ['Cards', cardCount],
            ['Stat Deltas', statDeltaCount],
            ['Inventory', inventoryDeltaCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded border border-exp-border/50 bg-exp-dark/35 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
                {label}
              </p>
              <p className="mt-1 font-mono text-lg text-compass-bright tabular-nums">
                {value}
              </p>
            </div>
          ))}
        </div>

        {latestEvents.length > 0 && (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
                Chain Replay
              </h4>
              <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
                {replay.steps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setSelectedReplayIndex(step.index)}
                    className={`relative h-8 min-w-8 border px-1.5 font-mono text-[10px] ${
                      selectedStep?.id === step.id
                        ? 'border-compass/50 bg-compass/10 text-compass-bright'
                        : 'border-exp-border bg-exp-dark/35 text-exp-text-dim'
                    }`}
                    aria-label={`Replay step ${step.index + 1}`}
                  >
                    <span className="absolute left-1/2 top-0 h-1.5 w-px -translate-x-1/2 bg-current opacity-50" />
                    {step.index + 1}
                    <span className="absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-current opacity-50" />
                  </button>
                ))}
              </div>
            </div>
            {selectedStep && (
              <div className="mb-3 rounded border border-compass/25 bg-compass/5 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
                  Selected step
                </p>
                <p className="mt-1 font-mono text-xs text-exp-text">
                  {selectedStep.summary}
                </p>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {latestEvents.map((event) => (
                <div key={event.id} className={`rounded border px-3 py-2 ${
                  selectedStep?.id === event.id
                    ? 'border-compass/40 bg-compass/10'
                    : 'border-exp-border/50 bg-exp-dark/40'
                }`}>
                  <p className="font-mono text-xs uppercase tracking-wider text-blueprint">
                    {event.summary || event.name}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-exp-text-dim">
                    block {event.blockNumber?.toString?.() || event.blockNumber || 'pending'}
                  </p>
                  {event.transactionHash && (
                    <p className="mt-1 font-mono text-[10px] text-exp-text-dim">
                      tx {truncateAddress(event.transactionHash)}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {replayProof.length > 0 && (
              <div className="mt-3 rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-blueprint">
                  Replay proof
                </p>
                <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
                  {replayProof.map((proof) => truncateAddress(proof.tx)).join(' / ')}
                </p>
              </div>
            )}
            {groupedEntries.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {groupedEntries.map(([actor, steps]) => (
                  <div key={actor} className="rounded border border-exp-border/50 bg-exp-dark/35 px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-exp-text-dim">
                      {actor}
                    </p>
                    <p className="mt-1 font-mono text-xs text-blueprint">
                      {steps.map((step) => step.name).join(' / ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Player action results */}
        {hasActions && (
          <div>
            <h4 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase mb-2">
              Action Outcomes
            </h4>
            <div className="space-y-2">
              {playerActions.map((pa, i) => (
                <ActionResult
                  key={i}
                  playerAction={pa}
                  escapeCostPreview={escapeCostPreview}
                />
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        {hasActions && hasEvents && (
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-exp-border" />
            <span className="font-display text-xs tracking-[0.3em] text-exp-text-dim uppercase">
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
                escapeCostPreview={escapeCostPreview}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
