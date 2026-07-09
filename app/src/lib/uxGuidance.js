import { Action } from './constants';
import { getActionMeta } from './actionMeta';
import { TurnState } from './turnState';
import { EXPEDITION_ARC_IDS } from './expeditionArc';

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
  const departPressure = context.departPressure;
  const escapeCostPreview = context.escapeCostPreview;
  const traitPreview = context.traitPreview;
  const mitigation = escapeCostPreview?.bestMitigation;
  const traitOutcome = traitExplanationForAction(action, traitPreview);
  const mitigationOutcome = mitigation?.action === action ? mitigation.effect : '';
  const outcome = {
    [Action.MOVE]: traitOutcome || mitigationOutcome
      ? traitOutcome || mitigationOutcome
      : context.routeStatus?.isValid === false
      ? 'Fix the route, then submit it as your locked movement.'
      : `Submit ${context.movePath?.length || 0} planned step${context.movePath?.length === 1 ? '' : 's'} for this turn.`,
    [Action.SETUP_CAMP]: 'Spend the turn establishing a campsite if your kit is available.',
    [Action.DIG]: traitOutcome || mitigationOutcome
      ? traitOutcome || mitigationOutcome
      : ['artifact-risk', 'crew-risk', 'route-collapse'].includes(escapeCostPreview?.costType)
        ? 'Dig can create payoff, but it may increase the visible escape cost.'
        : 'Search your tile for discoveries, with Dexterity influencing the result.',
    [Action.REST]: traitOutcome || mitigationOutcome || 'Recover a chosen stat and stabilize for the next turn.',
    [Action.HELP]: traitOutcome || mitigationOutcome || 'Support another explorer by boosting one selected stat.',
    [Action.FLEE]: traitOutcome || mitigationOutcome || escapeCostPreview?.body || departPressure?.readiness?.body || 'Depart from the landing site once the crew has enough value and a route home.',
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
  departPressure,
  escapeCostPreview,
  traitPreview,
  expeditionArc,
} = {}) {
  if (isSpectator) return { action: null, label: 'Watch the run', reason: 'This wallet is spectating.' };
  if (turnState?.state === TurnState.RESOLVING) return { action: null, label: 'Wait for resolution', reason: 'The queue is processing submitted actions.' };
  if (hasSubmitted) return { action: null, label: 'Wait for crew', reason: 'Your action is locked.' };
  if (expeditionArc?.id === EXPEDITION_ARC_IDS.FINAL_CALL) return { action: Action.FLEE, label: 'Final Call', reason: expeditionArc.directive };
  if (traitPreview?.effect?.warning && traitPreview.trait?.preferredAction && traitPreview.trait.preferredAction !== activeTab) {
    return {
      action: traitPreview.trait.preferredAction,
      label: `${actionLabel(traitPreview.trait.preferredAction)} ${traitPreview.trait.label}`,
      reason: traitPreview.warning || traitPreview.body,
    };
  }
  if (traitPreview?.effect?.matched && traitPreview.trait?.preferredAction) {
    return {
      action: traitPreview.trait.preferredAction,
      label: `${traitPreview.trait.label} play`,
      reason: traitPreview.body,
    };
  }
  if (escapeCostPreview?.bestMitigation?.available && escapeCostPreview.bestMitigation.actionable && ['artifact-risk', 'crew-risk', 'route-collapse'].includes(escapeCostPreview.costType)) {
    const mitigation = escapeCostPreview.bestMitigation;
    return { action: mitigation.action, label: mitigation.label, reason: mitigation.effect };
  }
  if (escapeCostPreview?.canEscape && ['artifact-risk', 'crew-risk'].includes(escapeCostPreview.costType)) {
    return { action: Action.FLEE, label: 'Depart now', reason: `Depart now: ${escapeCostPreview.headline} if the crew delays.` };
  }
  if (departPressure?.readiness?.canFlee && departPressure.pressure >= 50) {
    return { action: Action.FLEE, label: 'Depart now', reason: `${departPressure.band.label}: ${escapeCostPreview?.headline || departPressure.readiness.body}` };
  }
  if (movePath.length > 0 && routeStatus?.isValid) return { action: Action.MOVE, label: 'Submit planned move', reason: routeStatus.label };
  if (escapeCostPreview?.costType === 'route-collapse') {
    return {
      action: Action.MOVE,
      label: 'Return home',
      reason: escapeCostPreview.body,
    };
  }
  if (!departPressure?.readiness?.canFlee && departPressure?.pressure >= 75) {
    return {
      action: departPressure?.atLanding ? Action.DIG : Action.MOVE,
      label: departPressure?.atLanding ? 'Recover value' : 'Return home',
      reason: `${departPressure.band.label}: ${escapeCostPreview?.headline || departPressure.readiness.body}`,
    };
  }
  if (escapeCostPreview?.costType === 'not-ready' && departPressure?.atLanding && !departPressure?.hasRecoveredValue) {
    return { action: Action.DIG, label: 'Recover value', reason: escapeCostPreview.body };
  }
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
  departPressure,
  escapeCostPreview,
  traitPreview,
  expeditionArc,
} = {}) {
  if (!isConnected) return { title: 'Connect wallet', body: 'Connect a wallet before joining or submitting actions.', tone: 'gold' };
  if (isSpectator) return { title: 'Watching expedition', body: 'You can inspect the board and crew, but this wallet is not registered.', tone: 'blue' };
  if (turnState?.state === TurnState.RESOLVING) return { title: 'Queue resolving', body: 'The crew has submitted enough actions. Wait for chain resolution.', tone: 'blue' };
  if (hasSubmitted) return { title: 'Action locked', body: 'Your turn is submitted. Waiting on crew or queue processing.', tone: 'green' };
  if (movePath.length > 0 && routeStatus?.isValid === false) return { title: 'Fix route', body: routeStatus.invalidReason || 'Undo, clear, or choose a reachable adjacent tile.', tone: 'red' };
  if (expeditionArc?.id === EXPEDITION_ARC_IDS.FINAL_CALL) {
    return { title: 'Final Call', body: expeditionArc.directive, tone: 'red' };
  }
  if (movePath.length > 0) {
    const pressureCopy = departPressure
      ? ` Depart Pressure: ${departPressure.band.label} ${departPressure.pressure}.`
      : '';
    const traitCopy = traitPreview?.trait
      ? ` ${traitPreview.trait.label}: ${traitPreview.routeNote || traitPreview.body}`
      : '';
    return { title: 'Review route', body: `${routeStatus?.label || 'Route planned'}. Submit when ready or undo a step.${pressureCopy}${traitCopy}`, tone: traitPreview?.effect?.warning ? 'red' : 'gold' };
  }
  if (traitPreview?.trait) {
    return {
      title: `${traitPreview.trait.label} spotted`,
      body: `${traitPreview.body} Preferred action: ${traitPreview.preferredActionLabel}.`,
      tone: traitPreview.effect?.warning ? 'red' : traitPreview.effect?.matched ? 'green' : 'blue',
    };
  }
  if (expeditionArc?.id === EXPEDITION_ARC_IDS.REDLINE) {
    const reduction = escapeCostPreview?.bestMitigation?.label ? ` Best reduction: ${escapeCostPreview.bestMitigation.label}.` : '';
    return { title: 'Redline', body: `${expeditionArc.directive}${reduction}`, tone: 'red' };
  }
  if (expeditionArc?.id === EXPEDITION_ARC_IDS.DEPARTURE_WINDOW) {
    return { title: 'Departure Window', body: `${expeditionArc.playerQuestion} ${expeditionArc.directive}`, tone: 'green' };
  }
  if (expeditionArc?.id === EXPEDITION_ARC_IDS.GREED_WINDOW) {
    return { title: 'Greed Window', body: `${expeditionArc.playerQuestion} ${expeditionArc.directive}`, tone: 'gold' };
  }
  if (expeditionArc?.id === EXPEDITION_ARC_IDS.SURVEY) {
    return { title: 'Survey', body: `${expeditionArc.playerQuestion} ${expeditionArc.directive}`, tone: 'blue' };
  }
  if (escapeCostPreview && ['artifact-risk', 'crew-risk', 'route-collapse'].includes(escapeCostPreview.costType)) {
    const mitigationCopy = escapeCostPreview.bestMitigation
      ? ` Best reduction: ${escapeCostPreview.bestMitigation.label}.`
      : '';
    return {
      title: 'Escape cost visible',
      body: `${escapeCostPreview.headline}. ${escapeCostPreview.nextDelayWarning}${mitigationCopy}`,
      tone: escapeCostPreview.tone === 'red' ? 'red' : 'gold',
    };
  }
  if (departPressure?.readiness?.canFlee && departPressure.pressure >= 50) {
    return {
      title: 'Depart window open',
      body: `${departPressure.band.label} ${departPressure.pressure}. ${departPressure.readiness.body}`,
      tone: departPressure.band.tone === 'red' ? 'red' : 'gold',
    };
  }

  const ready = readinessByPlayerID[String(playerID)] ?? false;
  return ready
    ? { title: 'Waiting on crew', body: 'You are marked ready. The remaining crew still needs to submit.', tone: 'green' }
    : {
        title: 'Choose your action',
        body: departPressure
          ? `${departPressure.band.label} ${departPressure.pressure}. ${departPressure.band.copy}`
          : 'Plan a move to chart more ground, recover if the crew is weak, dig if the payoff is worth it, or flee when the route home matters most.',
        tone: departPressure?.band?.tone === 'red' ? 'red' : 'gold',
      };
}

function traitExplanationForAction(action, traitPreview = null) {
  if (!traitPreview?.trait) return '';
  if (traitPreview.effect?.warning) return traitPreview.warning || traitPreview.body;
  if (traitPreview.effect?.matched || traitPreview.trait.preferredAction === action) return traitPreview.body;
  return '';
}

function actionLabel(action) {
  return getActionMeta(action).label;
}

export function summarizeReplayStep(step) {
  if (!step) return 'No replay data yet.';
  const actor = step.actor && step.actor !== 'System' ? `${step.actor} ` : '';
  const block = step.blockNumber ? ` at block ${step.blockNumber.toString?.() || step.blockNumber}` : '';
  return `${actor}${step.name}${block}`;
}
