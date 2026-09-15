import { getActionMeta } from './actionMeta';

function actionLabel(value) {
  const number = Number(value);
  try { return getActionMeta(number).label; }
  catch { return `Action ${Number.isFinite(number) ? number : '?'}`; }
}

function storyForEvent(event) {
  const args = event.args || {};
  switch (event.name) {
    case 'GameRegistration': return { title: `Explorer P${args.playerID || '?'} joined`, body: 'The expedition gained another voice and another risk to carry.', tone: 'green' };
    case 'GameStart': return { title: 'The expedition crossed the threshold', body: 'Registration closed and the shared journey began.', tone: 'gold' };
    case 'LandingSiteSet': return { title: `Landing beacon fixed at ${args.landingSite || args.zoneAlias || 'the frontier'}`, body: 'Every safe departure now leads back to this point.', tone: 'blue' };
    case 'ActionSubmit': return { title: `P${args.playerID || '?'} committed ${actionLabel(args.actionID)}`, body: 'A crew decision entered the permanent turn record.', tone: 'blue' };
    case 'TurnProcessingStart': return { title: 'The world answered', body: 'All committed actions entered resolution.', tone: 'gold' };
    case 'TurnProcessingFail': return { title: 'The world resisted', body: 'Resolution stopped safely and left an auditable failure record.', tone: 'red' };
    case 'PlayerIdleKick': return { title: `P${args.playerID || '?'} left the active crew`, body: 'The expedition continued after the inactivity limit.', tone: 'red' };
    case 'EndGameStarted': return { title: 'The departure window opened', body: String(args.scenario || 'The final expedition chapter began.'), tone: 'gold' };
    case 'GameOver': return { title: 'The expedition became history', body: 'The final state is anchored and replayable.', tone: 'green' };
    case 'GamePhaseChange': return { title: 'The world changed phase', body: `Phase ${args.newPhase ?? '?'} is now authoritative.`, tone: 'neutral' };
    case 'ProcessingPhaseChange': return { title: 'Resolution advanced', body: `Processing phase ${args.newPhase ?? '?'} was recorded.`, tone: 'neutral' };
    default: return { title: event.name, body: 'An expedition event was recorded.', tone: 'neutral' };
  }
}

export function buildExpeditionChronicle(events = [], { confirmedBlock = 0 } = {}) {
  return events.map((event) => {
    const story = storyForEvent(event);
    const depth = confirmedBlock && event.blockNumber ? Math.max(0, confirmedBlock - event.blockNumber + 1) : 0;
    return {
      ...story,
      id: event.key,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      finality: depth >= 2 ? 'recorded' : 'resolving',
    };
  });
}

export function buildExpeditionPassport({ gameId, url, events = [] }) {
  return {
    schema: 'xenovoya:expedition-passport:v1',
    gameId: String(gameId),
    resumeUrl: url,
    recordedEvents: events.length,
    exportedAt: new Date().toISOString(),
  };
}
