import { useEffect, useState } from 'react';
import { Action } from '../../lib/constants';
import { getActionMeta } from '../../lib/actionMeta';
import { emitFeedbackEvent } from '../../lib/feedbackEvents';
import { useGameActions } from '../../hooks/useGameActions';
import { usePlayerInventory } from '../../hooks/usePlayerInventory';
import MoveControl from './MoveControl';
import CampControl from './CampControl';
import DigControl from './DigControl';
import RestControl from './RestControl';
import HelpControl from './HelpControl';
import TxStatus from '../shared/TxStatus';
import ActionSimulator from './ActionSimulator';

const TABS = [
  Action.MOVE,
  Action.SETUP_CAMP,
  Action.DIG,
  Action.REST,
  Action.HELP,
  Action.FLEE,
];

export default function ActionPanel({
  gameId,
  playerID,
  currentLocation,
  stats,
  currentAction,
  movement = 0,
  movePath = [],
  onMoveSubmit,
  onMoveClear,
  activeTab: controlledActiveTab,
  onTabChange,
  isSpectator = false,
  moveValidation,
  turnState,
}) {
  const [localActiveTab, setLocalActiveTab] = useState(Action.MOVE);
  const activeTab = controlledActiveTab ?? localActiveTab;
  const { submitAction, hash, isPending, isConfirming, isSuccess, error } = useGameActions();
  const { active: activeInv } = usePlayerInventory(gameId, playerID);

  const hasSubmitted = currentAction && currentAction !== '' && currentAction !== 'Idle';
  const isLocked = isSpectator || hasSubmitted || isPending || isConfirming;
  const statusLabel = isSpectator
    ? 'SPECTATOR'
    : hasSubmitted
      ? `SUBMITTED: ${currentAction}`
      : movement > 0
        ? 'READY TO PLAN'
        : 'AWAITING STATE';

  useEffect(() => {
    emitFeedbackEvent({
      source: 'action-console',
      kind: isPending ? 'tx-pending' : isConfirming ? 'tx-confirming' : isSuccess ? 'tx-success' : error ? 'tx-error' : 'tx-idle',
      action: getActionMeta(activeTab).key,
      turnState: turnState?.state,
    });
  }, [activeTab, error, isConfirming, isPending, isSuccess, turnState?.state]);

  const setActiveTab = (tab) => {
    if (onTabChange) onTabChange(tab);
    if (controlledActiveTab === undefined) setLocalActiveTab(tab);
  };

  const handleSubmit = (actionIndex, options = [], leftHand = '', rightHand = '') => {
    if (!playerID || !gameId) return;
    submitAction(playerID, actionIndex, options, leftHand, rightHand, gameId);
  };

  return (
    <div className="border border-exp-border rounded bg-exp-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="border-b border-exp-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xs tracking-[0.25em] text-exp-text-dim uppercase">
            Action Console
          </h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
            Route movement, camp setup, digging, rest, help, or escape from the tablet.
          </p>
        </div>
        <span className={`font-mono text-xs uppercase tracking-[0.25em] border rounded px-2.5 py-1 ${
          isSpectator
            ? 'text-exp-text-dim border-exp-border bg-exp-dark/40'
            : hasSubmitted
              ? 'text-blueprint border-blueprint/30 bg-blueprint/5'
              : 'text-compass-bright border-compass/30 bg-compass/5'
        }`}>
          {statusLabel}
        </span>
      </div>

      <div className="px-4 pt-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">Location</div>
            <div className="mt-1 font-mono text-xs text-compass-bright tabular-nums break-all">
              {currentLocation || 'Unknown'}
            </div>
          </div>
          <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">Movement</div>
            <div className="mt-1 font-mono text-xs text-compass-bright tabular-nums">
              {movement}
            </div>
          </div>
          <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">Mode</div>
            <div className="mt-1 font-mono text-xs text-compass-bright uppercase tracking-widest">
              {activeTab}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 px-4 pt-3 pb-2 border-b border-exp-border/50 overflow-x-auto">
        {TABS.map((action) => {
          const meta = getActionMeta(action);
          const isActive = action === activeTab;
          return (
            <button
              key={action}
              onClick={() => setActiveTab(action)}
              className={`
                alive-action-tab
                px-3 py-1.5 text-xs font-mono uppercase tracking-wider shrink-0
                border rounded transition-all duration-200
                ${isActive
                  ? 'text-compass bg-compass/10 border-compass/40'
                  : 'text-exp-text-dim bg-exp-dark/40 border-exp-border hover:text-exp-text hover:border-exp-text-dim/40'
                }
              `}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Active control */}
      <div className="p-4">
        {activeTab === Action.MOVE && (
          <MoveControl
            currentLocation={currentLocation}
            movement={movement}
            path={movePath}
            validation={moveValidation}
            onSubmit={() => {
              if (movePath.length === 0) return;
              handleSubmit(Action.MOVE, movePath);
              onMoveSubmit?.();
            }}
            onClear={onMoveClear}
            disabled={isLocked}
          />
        )}
        {(activeTab === Action.SETUP_CAMP || activeTab === Action.BREAK_DOWN_CAMP) && (
          <CampControl
            activeInv={activeInv}
            onSubmitSetup={() => handleSubmit(Action.SETUP_CAMP)}
            onSubmitBreakdown={() => handleSubmit(Action.BREAK_DOWN_CAMP)}
            disabled={isLocked}
          />
        )}
        {activeTab === Action.DIG && (
          <DigControl
            onSubmit={() => handleSubmit(Action.DIG)}
            disabled={isLocked}
          />
        )}
        {activeTab === Action.REST && (
          <RestControl
            onSubmit={(statOption) => handleSubmit(Action.REST, [statOption])}
            disabled={isLocked}
          />
        )}
        {activeTab === Action.HELP && (
          <HelpControl
            gameId={gameId}
            currentPlayerID={playerID}
            onSubmit={(targetPID, statOption) => handleSubmit(Action.HELP, [String(targetPID), statOption])}
            disabled={isLocked}
          />
        )}
        {activeTab === Action.FLEE && (
          <div className="space-y-3">
            <p className="font-mono text-xs text-exp-text-dim">
              Attempt to escape the planet from the landing site. You must be at the landing zone
              and have gathered sufficient artifacts.
            </p>
            <button
              onClick={() => handleSubmit(Action.FLEE)}
              disabled={isLocked}
              className="px-4 py-2 bg-signal-red/10 border border-signal-red/40 rounded text-signal-red text-xs font-mono tracking-widest uppercase
                         hover:bg-signal-red/20 hover:border-signal-red/60 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Attempt Escape
            </button>
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        <ActionSimulator
          activeTab={activeTab}
          movement={movement}
          currentLocation={currentLocation}
          path={movePath}
          hasCampsiteKit={activeInv?.campsite ?? false}
          hasSubmitted={hasSubmitted}
          isSpectator={isSpectator}
        />
      </div>

      {/* Tx status */}
      {(hash || isPending || error) && (
        <div className="px-4 pb-4">
          <TxStatus
            hash={hash}
            isPending={isPending}
            isConfirming={isConfirming}
            isSuccess={isSuccess}
            error={error}
          />
        </div>
      )}
    </div>
  );
}
