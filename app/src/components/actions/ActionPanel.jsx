import { useEffect, useState } from 'react';
import { Action } from '../../lib/constants';
import { getActionMeta } from '../../lib/actionMeta';
import { emitFeedbackEvent } from '../../lib/feedbackEvents';
import { getActionBlockReason, getActionExplanation, getBestActionSuggestion } from '../../lib/uxGuidance';
import { buildActionDrama } from '../../lib/funTelemetry';
import { useGameActions } from '../../hooks/useGameActions';
import { usePlayerInventory } from '../../hooks/usePlayerInventory';
import MoveControl from './MoveControl';
import CampControl from './CampControl';
import DigControl from './DigControl';
import RestControl from './RestControl';
import HelpControl from './HelpControl';
import TxStatus from '../shared/TxStatus';
import ActionSimulator from './ActionSimulator';
import SubmitConfirmation from './SubmitConfirmation';
import ReceiptDrawer from './ReceiptDrawer';

const TABS = [
  Action.MOVE,
  Action.SETUP_CAMP,
  Action.DIG,
  Action.REST,
  Action.HELP,
  Action.FLEE,
];

const ACTION_GLYPHS = {
  [Action.MOVE]: 'M',
  [Action.SETUP_CAMP]: 'C',
  [Action.DIG]: 'D',
  [Action.REST]: 'R',
  [Action.HELP]: 'H',
  [Action.FLEE]: 'F',
};

const TX_TONE = {
  Idle: 'border-exp-border/60 bg-exp-dark/40 text-exp-text-dim',
  'Wallet Pending': 'alive-tx-pulse border-compass/45 bg-compass/10 text-compass-bright',
  Confirming: 'alive-tx-pulse border-blueprint/45 bg-blueprint/10 text-blueprint',
  Confirmed: 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green',
  Failed: 'alive-invalid border-signal-red/45 bg-signal-red/10 text-signal-red',
};

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
  onMoveBacktrack,
  activeTab: controlledActiveTab,
  onTabChange,
  isSpectator = false,
  moveValidation,
  routeStatus,
  boardInput,
  turnState,
  funTelemetry,
}) {
  const [localActiveTab, setLocalActiveTab] = useState(Action.MOVE);
  const [pendingSubmission, setPendingSubmission] = useState(null);
  const [lastSubmission, setLastSubmission] = useState(null);
  const [optimisticSubmitted, setOptimisticSubmitted] = useState(null);
  const activeTab = controlledActiveTab ?? localActiveTab;
  const { submitAction, hash, isPending, isConfirming, isSuccess, error } = useGameActions();
  const { active: activeInv } = usePlayerInventory(gameId, playerID);

  const hasChainSubmission = currentAction && currentAction !== '' && currentAction !== 'Idle';
  const hasSubmitted = Boolean(optimisticSubmitted || hasChainSubmission);
  const isLocked = isSpectator || hasSubmitted || isPending || isConfirming;
  const txPhase = isPending ? 'Wallet Pending' : isConfirming ? 'Confirming' : isSuccess ? 'Confirmed' : error ? 'Failed' : 'Idle';
  const showControllerHints = boardInput?.inputMode === 'pad';
  const statusLabel = isSpectator
    ? 'SPECTATOR'
    : isPending || isConfirming
      ? `SUBMITTING: ${getActionMeta(activeTab).label}`
      : hasSubmitted
        ? `SUBMITTED: ${optimisticSubmitted?.label || currentAction}`
        : movement > 0
          ? 'READY TO PLAN'
          : 'AWAITING STATE';

  const actionContext = {
    isSpectator,
    hasSubmitted,
    isPending,
    isConfirming,
    movement,
    movePath,
    routeStatus,
    activeInventory: activeInv,
    turnState,
  };
  const activeExplanation = getActionExplanation(activeTab, actionContext);
  const blockReason = getActionBlockReason({ action: activeTab, ...actionContext });
  const suggestion = getBestActionSuggestion({ activeTab, ...actionContext });

  useEffect(() => {
    emitFeedbackEvent({
      source: 'action-console',
      kind: isPending ? 'tx-pending' : isConfirming ? 'tx-confirming' : isSuccess ? 'tx-success' : error ? 'tx-error' : 'tx-idle',
      action: getActionMeta(activeTab).key,
      turnState: turnState?.state,
    });
  }, [activeTab, error, isConfirming, isPending, isSuccess, turnState?.state]);

  useEffect(() => {
    if (isSuccess || hasChainSubmission) setOptimisticSubmitted(null);
  }, [hasChainSubmission, isSuccess]);

  const setActiveTab = (tab) => {
    if (onTabChange) onTabChange(tab);
    if (controlledActiveTab === undefined) setLocalActiveTab(tab);
  };

  const handleTabKeyDown = (event) => {
    const number = Number(event.key);
    if (number >= 1 && number <= TABS.length) {
      event.preventDefault();
      setActiveTab(TABS[number - 1]);
      return;
    }

    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'e') {
      event.preventDefault();
      const index = TABS.indexOf(activeTab);
      setActiveTab(TABS[(index + 1) % TABS.length]);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'q') {
      event.preventDefault();
      const index = TABS.indexOf(activeTab);
      setActiveTab(TABS[(index - 1 + TABS.length) % TABS.length]);
    }
  };

  const requestSubmit = (actionIndex, options = [], leftHand = '', rightHand = '') => {
    if (!playerID || !gameId) return;
    setPendingSubmission({
      playerID,
      actionIndex,
      label: getActionMeta(actionIndex).label,
      options,
      leftHand,
      rightHand,
      gameId,
      drama: buildActionDrama(actionIndex, {
        isSpectator,
        hasSubmitted,
        isPending,
        isConfirming,
        movement,
        movePath: actionIndex === Action.MOVE ? options : movePath,
        routeStatus,
        activeInventory: activeInv,
        turnState,
        location: currentLocation,
        currentLocation,
        stats,
        boardInput,
      }),
    });
  };

  const confirmSubmit = () => {
    if (!pendingSubmission) return;
    const submission = pendingSubmission;
    setPendingSubmission(null);
    setLastSubmission(submission);
    setOptimisticSubmitted({ label: submission.label, options: submission.options });
    Promise.resolve(submitAction(
      submission.playerID,
      submission.actionIndex,
      submission.options,
      submission.leftHand,
      submission.rightHand,
      submission.gameId,
    )).catch(() => {
      setOptimisticSubmitted(null);
    });
    if (submission.actionIndex === Action.MOVE) onMoveSubmit?.();
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
            : isPending || isConfirming
              ? 'text-blueprint border-blueprint/35 bg-blueprint/10 alive-tx-pulse'
              : hasSubmitted
                ? 'text-blueprint border-blueprint/30 bg-blueprint/5'
                : 'text-compass-bright border-compass/30 bg-compass/5'
        }`}>
          {statusLabel}
        </span>
      </div>

      <div className="px-4 pt-3">
        <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
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
              {ACTION_GLYPHS[activeTab]} {getActionMeta(activeTab).label}
            </div>
          </div>
          <div className={`border rounded px-3 py-2 transition-[filter] ${TX_TONE[txPhase] || TX_TONE.Idle}`}>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">Tx</div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest">
              <span className="h-2 w-2 rounded-full bg-current" />
              {txPhase}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-exp-text-dim">
                Action help
              </p>
              <p className="mt-1 font-mono text-xs text-exp-text">
                {activeExplanation.outcome}
              </p>
              {blockReason && (
                <p className="mt-1 font-mono text-[11px] text-signal-red">
                  Blocked: {blockReason}
                </p>
              )}
            </div>
            {suggestion.action && suggestion.action !== activeTab && (
              <button
                type="button"
                onClick={() => setActiveTab(suggestion.action)}
                className="rounded border border-compass/35 bg-compass/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-compass"
                title={suggestion.reason}
              >
                {suggestion.label}
              </button>
            )}
          </div>
        </div>
      </div>

      {funTelemetry && (
        <div className="px-4 pt-3">
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <div className="rounded border border-compass/25 bg-compass/5 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-compass">
                {funTelemetry.preview.label}
              </p>
              <p className="mt-1 font-mono text-xs text-exp-text">
                {funTelemetry.preview.body}
              </p>
              <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
                "{funTelemetry.bark.line}"
              </p>
            </div>
            <div className={`rounded border px-3 py-2 ${
              funTelemetry.risk.level === 'redline'
                ? 'alive-risk-redline border-signal-red/40 bg-signal-red/10 text-signal-red'
                : funTelemetry.risk.level === 'hot'
                  ? 'border-compass/40 bg-compass/10 text-compass-bright'
                  : 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
            }`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-70">
                Tension
              </p>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em]">
                {funTelemetry.risk.label} {funTelemetry.risk.score}
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        className="grid grid-flow-col auto-cols-[minmax(4.8rem,1fr)] gap-1 px-4 pt-3 pb-2 border-b border-exp-border/50 overflow-x-auto"
        onKeyDown={handleTabKeyDown}
      >
        {TABS.map((action) => {
          const meta = getActionMeta(action);
          const isActive = action === activeTab;
          return (
            <button
              key={action}
              onClick={() => setActiveTab(action)}
              title={`${meta.copy} Press ${TABS.indexOf(action) + 1}.`}
              className={`
                alive-action-tab
                min-h-12 px-2 py-1.5 text-xs font-mono uppercase tracking-wider shrink-0
                border rounded transition-all duration-200
                ${isActive
                  ? 'text-compass bg-compass/10 border-compass/40 shadow-[inset_0_0_0_1px_rgba(232,200,96,0.12)]'
                  : 'text-exp-text-dim bg-exp-dark/40 border-exp-border hover:text-exp-text hover:border-exp-text-dim/40'
                }
              `}
            >
              <span className="block text-base leading-none">{ACTION_GLYPHS[action]}</span>
              <span className="mt-1 block text-[10px] leading-none">{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4">
        {showControllerHints && (
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            {['Left stick / D-pad: aim route', 'A: commit intent', 'B: undo route step'].map((hint) => (
              <div key={hint} className="rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2 font-mono text-[11px] text-blueprint">
                {hint}
              </div>
            ))}
          </div>
        )}

        {activeTab === Action.MOVE && (
          <MoveControl
            currentLocation={currentLocation}
            movement={movement}
            path={movePath}
            validation={moveValidation}
            routeStatus={routeStatus}
            blockedReason={blockReason}
            onSubmit={() => requestSubmit(Action.MOVE, movePath)}
            onClear={onMoveClear}
            onBacktrack={onMoveBacktrack}
            disabled={isLocked}
          />
        )}
        {(activeTab === Action.SETUP_CAMP || activeTab === Action.BREAK_DOWN_CAMP) && (
          <CampControl
            activeInv={activeInv}
            onSubmitSetup={() => requestSubmit(Action.SETUP_CAMP)}
            onSubmitBreakdown={() => requestSubmit(Action.BREAK_DOWN_CAMP)}
            disabled={isLocked}
          />
        )}
        {activeTab === Action.DIG && (
          <DigControl
            onSubmit={() => requestSubmit(Action.DIG)}
            disabled={isLocked}
          />
        )}
        {activeTab === Action.REST && (
          <RestControl
            onSubmit={(statOption) => requestSubmit(Action.REST, [statOption])}
            disabled={isLocked}
          />
        )}
        {activeTab === Action.HELP && (
          <HelpControl
            gameId={gameId}
            currentPlayerID={playerID}
            onSubmit={(targetPID, statOption) => requestSubmit(Action.HELP, [String(targetPID), statOption])}
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
              onClick={() => requestSubmit(Action.FLEE)}
              disabled={isLocked}
              title={blockReason || 'Review and send flee action'}
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

      <div className="px-4 pb-4">
        <ReceiptDrawer
          submission={lastSubmission}
          hash={hash}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={error}
        />
      </div>

      <div className="sticky bottom-0 z-20 border-t border-exp-border bg-exp-surface/95 px-3 py-2 lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onMoveBacktrack}
            disabled={movePath.length === 0 || isLocked}
            className="rounded border border-blueprint/35 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-blueprint disabled:opacity-40"
          >
            Undo
          </button>
          <span className="font-mono text-xs text-exp-text-dim">
            {routeStatus?.label || `${movePath.length}/${movement}`}
          </span>
          <button
            type="button"
            onClick={() => requestSubmit(Action.MOVE, movePath)}
            disabled={isLocked || activeTab !== Action.MOVE || movePath.length === 0 || routeStatus?.isValid === false}
            className="rounded border border-compass/40 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-compass-bright disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      </div>

      <SubmitConfirmation
        isOpen={Boolean(pendingSubmission)}
        submission={pendingSubmission}
        routeStatus={routeStatus}
        onCancel={() => setPendingSubmission(null)}
        onConfirm={confirmSubmit}
      />
    </div>
  );
}
