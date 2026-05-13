import { ProcessingPhase, PROCESSING_LABELS } from './constants';

export const TurnState = {
  SPECTATING: 'spectating',
  PLANNING: 'planning',
  SUBMITTED: 'submitted',
  WAITING_CREW: 'waitingCrew',
  RESOLVING: 'resolving',
  COMPLETE: 'complete',
};

export function hasSubmittedAction(action) {
  return Boolean(action && action !== '' && action !== 'Idle');
}

export function deriveTurnState({
  isSpectator = false,
  currentAction = '',
  queueTelemetry = {},
  isGameOver = false,
}) {
  const hasSubmitted = hasSubmittedAction(currentAction);
  const phase = queueTelemetry.phase;
  const totalPlayers = queueTelemetry.totalPlayers ?? 0;
  const submittedCount = queueTelemetry.submittedCount ?? 0;
  const isResolving = phase === ProcessingPhase.PROCESSING
    || phase === ProcessingPhase.PLAY_THROUGH;

  if (isGameOver) {
    return {
      state: TurnState.COMPLETE,
      label: 'Complete',
      phaseLabel: PROCESSING_LABELS[phase] || 'Complete',
      hasSubmitted,
      isResolving: false,
      waitingFor: 0,
      copy: 'This expedition has reached its final state.',
    };
  }

  if (isSpectator) {
    return {
      state: TurnState.SPECTATING,
      label: 'Watching',
      phaseLabel: PROCESSING_LABELS[phase] || 'Unknown',
      hasSubmitted,
      isResolving,
      waitingFor: 0,
      copy: 'This wallet is observing the expedition.',
    };
  }

  if (isResolving) {
    return {
      state: TurnState.RESOLVING,
      label: 'Resolving',
      phaseLabel: PROCESSING_LABELS[phase] || 'Resolving',
      hasSubmitted,
      isResolving: true,
      waitingFor: 0,
      copy: 'Submitted actions are resolving through the queue.',
    };
  }

  if (hasSubmitted && totalPlayers > 0 && submittedCount < totalPlayers) {
    const waitingFor = Math.max(totalPlayers - submittedCount, 0);
    return {
      state: TurnState.WAITING_CREW,
      label: 'Waiting Crew',
      phaseLabel: PROCESSING_LABELS[phase] || 'Submission',
      hasSubmitted,
      isResolving: false,
      waitingFor,
      copy: `Your action is locked. Waiting for ${waitingFor} more explorer${waitingFor === 1 ? '' : 's'}.`,
    };
  }

  if (hasSubmitted) {
    return {
      state: TurnState.SUBMITTED,
      label: 'Submitted',
      phaseLabel: PROCESSING_LABELS[phase] || 'Submission',
      hasSubmitted,
      isResolving: false,
      waitingFor: 0,
      copy: 'Your action is locked for this turn.',
    };
  }

  return {
    state: TurnState.PLANNING,
    label: 'Planning',
    phaseLabel: PROCESSING_LABELS[phase] || 'Submission',
    hasSubmitted: false,
    isResolving: false,
    waitingFor: 0,
    copy: 'Choose an action and preview the consequence before submitting.',
  };
}
