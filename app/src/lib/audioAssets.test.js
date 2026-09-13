import { describe, expect, it } from 'vitest';
import boardSystem from '../board-system/board-system.json';
import { BOARD_CUE_PROFILES } from './audioAssets';

describe('premium board cue profiles', () => {
  it('covers every board mechanic with a layered or tonal cue', () => {
    for (const mechanic of boardSystem.mechanics) {
      expect(BOARD_CUE_PROFILES[mechanic.soundCue], mechanic.soundCue).toBeTruthy();
    }
  });

  it('covers the core presentation arc', () => {
    for (const cue of ['board.ready', 'board.commit', 'board.resolve', 'board.discovery', 'board.danger', 'board.return', 'board.complete']) {
      expect(BOARD_CUE_PROFILES[cue], cue).toBeTruthy();
    }
  });
});

