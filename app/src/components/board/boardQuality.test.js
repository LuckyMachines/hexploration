import { describe, expect, it } from 'vitest';
import { BOARD_QUALITY_MODES, resolveBoardQuality } from './boardQuality';

describe('resolveBoardQuality', () => {
  it('keeps full board quality on capable desktop hardware', () => {
    expect(resolveBoardQuality()).toEqual({
      mode: BOARD_QUALITY_MODES.AUTO,
      pixelRatioCap: 1.5,
      shadows: true,
      shadowMapSize: 1536,
      particleScale: 1,
    });
  });

  it('selects efficient rendering for constrained hardware', () => {
    expect(resolveBoardQuality({ deviceMemory: 4 })).toMatchObject({
      mode: BOARD_QUALITY_MODES.EFFICIENT,
      pixelRatioCap: 1,
      shadows: false,
      particleScale: 0.42,
    });
  });

  it('honors an explicit efficiency preference', () => {
    expect(resolveBoardQuality({ mode: BOARD_QUALITY_MODES.EFFICIENT, deviceMemory: 16 })).toMatchObject({
      mode: BOARD_QUALITY_MODES.EFFICIENT,
      shadows: false,
    });
  });
});

