import { describe, expect, it } from 'vitest';
import { normalizePlayMode, playModeTarget } from './playIntent';

describe('play intent', () => {
  it('accepts only supported cross-domain modes', () => {
    expect(normalizePlayMode('SOLO')).toBe('solo');
    expect(normalizePlayMode('anything')).toBeNull();
  });

  it('maps browse intents to focusable client surfaces', () => {
    expect(playModeTarget('choose')).toBe('play-options');
    expect(playModeTarget('observe')).toBe('available-expeditions');
    expect(playModeTarget('join')).toBe('crew-network');
    expect(playModeTarget('solo')).toBeNull();
  });
});
