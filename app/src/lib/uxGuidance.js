import { Action } from './constants';
import { getActionMeta } from './actionMeta';
import { TurnState } from './turnState';

export function getActionBlockReason({
  action,
  isSpectator,
  hasSubmitted,
  isPending,
  isConfirming,
  movement,
  movePath = [],
  routeStatus,
  activeInventory = {},
} = {}) {
  if (isSpectator) return 'Connect with a registered crew wallet to submit actions.';
  if (hasSubmitted) return 'Your action is already locked for this turn.';
  if (isPending) return 'Wallet signature is still pending.';
  if (isConfirming) return 'The previous transaction is confirming on chain.';
  if (action === Action.MOVE && movement <= 0) return 'Movement has not loaded or is zero.';
  if (action === Action.MOVE && movePath.length === 0) return 'Choose at least one reachable tile first.';
  if (action === Action.MOVE && routeStatus?.isValid === false) return routeStatus.invalidReason || 'The current route is invalid.';
  if (action === Action.SETUP_CAMP && !activeInventory.campsite) return 'A campsite kit is required.';
  return '';
}

export function getActionExplanation(action, context = {}) {
  const meta = getActionMeta(action);
  const blocked = getActionBlockReason({ action, ...context });
  const outcome = {
    [Action.MOVE]: context.routeStatus?.isValid === false
      ? 'Fix the route, then submit it as your locked movement.'
      : `Submit ${context.movePath?.length || 0} planned step${context.movePath?.length === 1 ? '' : 's'} for this turn.`,
    [Action.SETUP_CAMP]: 'Spend the turn establishing a campsite if your kit is available.',
    [Action.DIG]: 'Search your tile for discoveries, with Dexterity influencing the result.',
    [Action.REST]: 'Recover a chosen stat and stabilize for the next turn.',
    [Action.HELP]: 'Support another explorer by boosting one selected stat.',
    [Action.FLEE]: 'Depart from the landing site once the crew has enough value and a route home.',
  }[action] || meta.copy;

  return {
    title: meta.label,
    body: meta.copy,
    outcome,
    blocked,
  };
}

export function getBestActionSuggestion({
  activeTab,
  isSpectator,
  hasSubmitted,
  movement,
  movePath = [],
  routeStatus,
  activeInventory = {},
  turnState,
} = {}) {
  if (isSpectator) return { action: null, label: 'Watch the run', reason: 'This wallet is spectating.' };
  if (turnState?.state === TurnState.RESOLVING) return { action: null, label: 'Wait for resolution', reason: 'The queue is processing submitted actions.' };
  if (hasSubmitted) return { action: null, label: 'Wait for crew', reason: 'Your action is locked.' };
  if (movePath.length > 0 && routeStatus?.isValid) return { action: Action.MOVE, label: 'Submit planned move', reason: routeStatus.label };
  if (movement > 0) return { action: Action.MOVE, label: 'Plan a move', reason: 'Movement is available. Chart new ground while the route home is still readable.' };
  if (activeInventory.campsite) return { action: Action.SETUP_CAMP, label: 'Set up camp', reason: 'A campsite kit is equipped.' };
  return { action: activeTab || Action.DIG, label: 'Pick an action', reason: 'Choose a turn action before the crew resolves.' };
}

export function getTurnGuidance({
  isConnected = true,
  isSpectator,
  hasSubmitted,
  turnState,
  routeStatus,
  movePath = [],
  readinessByPlayerID = {},
  playerID,
} = {}) {
  if (!isConnected) return { title: 'Connect wallet', body: 'Connect a wallet before joining or submitting actions.', tone: 'gold' };
  if (isSpectator) return { title: 'Watching expedition', body: 'You can inspect the board and crew, but this wallet is not registered.', tone: 'blue' };
  if (turnState?.state === TurnState.RESOLVING) return { title: 'Queue resolving', body: 'The crew has submitted enough actions. Wait for chain resolution.', tone: 'blue' };
  if (hasSubmitted) return { title: 'Action locked', body: 'Your turn is submitted. Waiting on crew or queue processing.', tone: 'green' };
  if (movePath.length > 0 && routeStatus?.isValid === false) return { title: 'Fix route', body: routeStatus.invalidReason || 'Undo, clear, or choose a reachable adjacent tile.', tone: 'red' };
  if (movePath.length > 0) return { title: 'Review route', body: `${routeStatus?.label || 'Route planned'}. Submit when ready or undo a step.`, tone: 'gold' };

  const ready = readinessByPlayerID[String(playerID)] ?? false;
  return ready
    ? { title: 'Waiting on crew', body: 'You are marked ready. The remaining crew still needs to submit.', tone: 'green' }
    : { title: 'Choose your action', body: 'Plan a move to chart more ground, recover if the crew is weak, dig if the payoff is worth it, or flee when the route home matters most.', tone: 'gold' };
}

export function summarizeReplayStep(step) {
  if (!step) return 'No replay data yet.';
  const actor = step.actor && step.actor !== 'System' ? `${step.actor} ` : '';
  const block = step.blockNumber ? ` at block ${step.blockNumber.toString?.() || step.blockNumber}` : '';
  return `${actor}${step.name}${block}`;
}
