import { useState } from 'react';
import { Action, ACTION_LABELS } from '../../lib/constants';
import { useGameActions } from '../../hooks/useGameActions';
import { usePlayerMovement } from '../../hooks/usePlayerMovement';
import { usePlayerInventory } from '../../hooks/usePlayerInventory';
import MoveControl from './MoveControl';
import CampControl from './CampControl';
import DigControl from './DigControl';
import RestControl from './RestControl';
import HelpControl from './HelpControl';
import TxStatus from '../shared/TxStatus';

const TABS = [
  { action: Action.MOVE, label: 'Move' },
  { action: Action.SETUP_CAMP, label: 'Camp' },
  { action: Action.DIG, label: 'Dig' },
  { action: Action.REST, label: 'Rest' },
  { action: Action.HELP, label: 'Help' },
  { action: Action.FLEE, label: 'Flee' },
];

export default function ActionPanel({ gameId, playerID, currentLocation, stats, currentAction }) {
  const [activeTab, setActiveTab] = useState(Action.MOVE);
  const { submitAction, hash, isPending, isConfirming, isSuccess, error } = useGameActions();
  const { movement } = usePlayerMovement(gameId, playerID);
  const { active: activeInv, inactive: inactiveInv } = usePlayerInventory(gameId, playerID);

  const hasSubmitted = currentAction && currentAction !== '';

  const handleSubmit = (actionIndex, options = [], leftHand = '', rightHand = '') => {
    if (!playerID || !gameId) return;
    submitAction(playerID, actionIndex, options, leftHand, rightHand, gameId);
  };

  return (
    <div className="border border-exp-border rounded bg-exp-surface">
      {/* Header */}
      <div className="border-b border-exp-border px-4 py-3 flex items-center justify-between">
        <h3 className="font-display text-xs tracking-[0.25em] text-exp-text-dim uppercase">
          Action Console
        </h3>
        {hasSubmitted && (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blueprint" />
            <span className="font-mono text-[10px] text-blueprint uppercase tracking-wider">
              Submitted: {currentAction}
            </span>
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 px-4 pt-3 pb-2 border-b border-exp-border/50 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = tab.action === activeTab;
          return (
            <button
              key={tab.action}
              onClick={() => setActiveTab(tab.action)}
              className={`
                px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider shrink-0
                border rounded transition-all duration-200
                ${isActive
                  ? 'text-compass bg-compass/10 border-compass/40'
                  : 'text-exp-text-dim bg-exp-dark/40 border-exp-border hover:text-exp-text hover:border-exp-text-dim/40'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active control */}
      <div className="p-4">
        {activeTab === Action.MOVE && (
          <MoveControl
            gameId={gameId}
            playerID={playerID}
            currentLocation={currentLocation}
            movement={movement}
            onSubmit={handleSubmit}
            disabled={hasSubmitted || isPending || isConfirming}
          />
        )}
        {(activeTab === Action.SETUP_CAMP || activeTab === Action.BREAK_DOWN_CAMP) && (
          <CampControl
            activeInv={activeInv}
            onSubmitSetup={() => handleSubmit(Action.SETUP_CAMP)}
            onSubmitBreakdown={() => handleSubmit(Action.BREAK_DOWN_CAMP)}
            disabled={hasSubmitted || isPending || isConfirming}
          />
        )}
        {activeTab === Action.DIG && (
          <DigControl
            onSubmit={() => handleSubmit(Action.DIG)}
            disabled={hasSubmitted || isPending || isConfirming}
          />
        )}
        {activeTab === Action.REST && (
          <RestControl
            onSubmit={(statOption) => handleSubmit(Action.REST, [statOption])}
            disabled={hasSubmitted || isPending || isConfirming}
          />
        )}
        {activeTab === Action.HELP && (
          <HelpControl
            gameId={gameId}
            currentPlayerID={playerID}
            onSubmit={(targetPID, statOption) => handleSubmit(Action.HELP, [String(targetPID), statOption])}
            disabled={hasSubmitted || isPending || isConfirming}
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
              disabled={hasSubmitted || isPending || isConfirming}
              className="px-4 py-2 bg-signal-red/10 border border-signal-red/40 rounded text-signal-red text-xs font-mono tracking-widest uppercase
                         hover:bg-signal-red/20 hover:border-signal-red/60 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Attempt Escape
            </button>
          </div>
        )}
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
