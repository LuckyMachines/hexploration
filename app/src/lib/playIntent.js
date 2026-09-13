export const PLAY_MODES = new Set(['choose', 'solo', 'observe', 'join']);

export function normalizePlayMode(value) {
  const mode = String(value || '').toLowerCase();
  return PLAY_MODES.has(mode) ? mode : null;
}

export function playModeTarget(mode) {
  return {
    choose: 'play-options',
    observe: 'available-expeditions',
    join: 'crew-network',
  }[normalizePlayMode(mode)] || null;
}
