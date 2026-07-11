import { Action } from './constants';
import { DEFAULT_MUSIC_TRACK_ID, MUSIC_TRACK_BY_ID } from './audioAssets';
import { TurnState } from './turnState';

export const MUSIC_DIRECTOR_EVENT = 'xenovoya:music-director';

function directorState(trackId, state, reason) {
  const track = MUSIC_TRACK_BY_ID[trackId] || MUSIC_TRACK_BY_ID[DEFAULT_MUSIC_TRACK_ID];
  return {
    trackId: track.id,
    state: state || track.state,
    reason: reason || track.trigger,
  };
}

export function trackForRoute(pathname = '/') {
  const cleanPath = `/${String(pathname || '/').replace(/^\/+/, '')}`.split('?')[0];

  if (cleanPath.startsWith('/game/')) {
    return directorState(
      'xenovoya-lobby-setup',
      'Lobby',
      'Game route opened before live expedition state is available.',
    );
  }

  if (cleanPath === '/audio-audition') {
    return directorState(
      'xenovoya-title-menu',
      'Audition',
      'Audio audition page keeps the global bed neutral while local players audition files.',
    );
  }

  return directorState(
    DEFAULT_MUSIC_TRACK_ID,
    'Title',
    'Public shell or discovery route.',
  );
}

export function trackForExpeditionState({
  activeTab = Action.MOVE,
  funTelemetry,
  hasSubmitted = false,
  isSpectator = false,
  movePath = [],
  routeStatus,
  turnState,
} = {}) {
  if (turnState?.state === TurnState.COMPLETE) {
    return directorState(
      'xenovoya-chain-resolving',
      'Complete',
      'Final outcome view is loading.',
    );
  }

  if (turnState?.state === TurnState.RESOLVING || turnState?.isResolving) {
    return directorState(
      'xenovoya-chain-resolving',
      'Resolving',
      'Submitted actions are resolving through the queue.',
    );
  }

  if (
    turnState?.state === TurnState.SUBMITTED
    || turnState?.state === TurnState.WAITING_CREW
    || hasSubmitted
  ) {
    return directorState(
      'xenovoya-chain-resolving',
      'Submitted',
      'The action is locked and the expedition is waiting on the outcome.',
    );
  }

  if (activeTab === Action.DIG || funTelemetry?.rareBeat?.label === 'Lucky Find') {
    return directorState(
      'xenovoya-relic-discovery',
      'Relic Discovery',
      'The current posture is a dig or rare discovery beat.',
    );
  }

  if (activeTab === Action.SETUP_CAMP || activeTab === Action.REST) {
    return directorState(
      'xenovoya-camp-recovery',
      'Camp / Recovery',
      'The current action is camp setup or recovery.',
    );
  }

  const riskLevel = funTelemetry?.risk?.level;
  if (
    routeStatus?.isValid === false
    || riskLevel === 'hot'
    || riskLevel === 'redline'
    || activeTab === Action.FLEE
  ) {
    return directorState(
      'xenovoya-expedition-danger',
      'Danger',
      'The route, action, or risk telemetry is pushing into danger.',
    );
  }

  if (isSpectator) {
    return directorState(
      'xenovoya-expedition-calm',
      'Spectating',
      'Watching a live expedition.',
    );
  }

  return directorState(
    'xenovoya-expedition-calm',
    'Expedition Calm',
    movePath.length > 0
      ? 'Planning a route with manageable pressure.'
      : 'Active expedition planning.',
  );
}

export function trackForGameOverOutcome({ lostCount = 0, survivorCount = 0 } = {}) {
  if (Number(lostCount) === 0 && Number(survivorCount) > 0) {
    return directorState(
      'xenovoya-victory-extraction',
      'Victory',
      'The expedition finished with every explorer alive.',
    );
  }

  return directorState(
    'xenovoya-defeat-lost',
    'Defeat',
    'The expedition ended with losses.',
  );
}

export function emitMusicDirectorState(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MUSIC_DIRECTOR_EVENT, {
    detail: directorState(detail.trackId, detail.state, detail.reason),
  }));
}
