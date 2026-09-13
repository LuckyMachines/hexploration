import { badgesForMemory, canonicalEntry } from './expeditionMemory';
import { guestLocationProfile, guestOutcome, normalizeGuestExpedition } from './guestExpedition';

function escapeCostFor(state) {
  if (state.result === 'emergency') return { level: 'route-collapse', label: 'Emergency extraction' };
  if (state.pressure < 55) return { level: 'clean', label: 'Clean departure' };
  if (state.pressure < 75) return { level: 'close', label: 'Storm at the perimeter' };
  return { level: 'crew-risk', label: 'Redline departure' };
}

export function memoryFromGuestExpedition(value) {
  const state = normalizeGuestExpedition(value);
  const outcome = guestOutcome(state);
  if (!outcome) return null;
  const cost = escapeCostFor(state);
  const completedAt = state.completedAt || new Date().toISOString();
  const artifactNames = state.collectedAliases
    .map((alias) => guestLocationProfile(alias)?.name)
    .filter(Boolean)
    .slice(0, state.relics);
  const base = {
    id: `guest-${completedAt}`,
    source: 'guest-expedition',
    sourceId: 'living-survey',
    scenarioId: 'living-survey',
    scenarioName: 'The Living Survey',
    title: outcome.title,
    outcome: state.result === 'safe' ? 'escaped' : 'lost',
    outcomeLabel: state.result === 'safe' ? 'Safe Departure' : 'Emergency Extraction',
    arcScore: Math.min(100, 35 + state.resolvedEncounters.length * 18 + state.relics * 24),
    challengeScore: outcome.score,
    arcLabel: state.result === 'safe' ? 'Homecoming' : 'Final Call',
    arcShape: state.result === 'safe' ? 'departure-window' : 'final-call',
    finalPressure: state.pressure,
    escapeCostLevel: cost.level,
    escapeCostLabel: cost.label,
    artifacts: state.relics,
    artifactNames,
    turns: state.turns,
    survivors: 2,
    crew: 2,
    bestMoment: {
      title: outcome.title,
      score: outcome.score,
      text: outcome.summary,
    },
    bestMomentLabel: outcome.title,
    replayPath: '/guest?mode=practice',
    proofCount: state.journal.length,
    badges: [
      `Grade ${outcome.grade}`,
      ...(state.resolvedEncounters.length >= 2 ? ['World Listener'] : []),
      ...(state.usedAbilities.length === 2 ? ['Whole Crew'] : []),
    ],
    timestamp: completedAt,
    insight: state.result === 'safe'
      ? `Grade ${outcome.grade}. Beat ${outcome.score} by returning with more value at lower pressure.`
      : 'The crew survived. The next benchmark is turning home before the emergency window.',
  };
  const score = outcome.score;
  return canonicalEntry({ ...base, score, badges: badgesForMemory({ ...base, score }) });
}

export default memoryFromGuestExpedition;
