import { describe, expect, it } from 'vitest';
import { Action, Tile } from '../../lib/constants';
import { boardViewModelKey, deriveBoardViewModel } from './boardViewModel';
import { resolveBoardBeat } from './boardBeatDirector';
import { baseTileTransform, changedBoardLayers } from './boardSceneState';

const cells = [
  { alias: '0,0', tileType: Tile.LANDING, revealed: true },
  { alias: '1,0', tileType: Tile.JUNGLE, revealed: true },
];

describe('board view model', () => {
  it('normalizes live state into one deterministic renderer contract', () => {
    const model = deriveBoardViewModel({
      cells,
      currentLocation: '0,0',
      intentAlias: '1,0',
      selectedPath: ['1,0', 'missing'],
      previewPath: ['1,0'],
      crew: [{ currentZone: '0,0' }],
      activeAction: Action.MOVE,
    });
    expect(model.schemaVersion).toBe(1);
    expect(model.selectedPath).toEqual(['1,0']);
    expect(model.playerLocationMap).toEqual({ '0,0': [0] });
    expect(model.phase).toBe('planning');
    expect(boardViewModelKey(model)).toBe(boardViewModelKey(deriveBoardViewModel(model)));
  });

  it('directs beats without automatically moving the camera', () => {
    const model = deriveBoardViewModel({ cells, activeAction: Action.MOVE, selectedPath: [], previewPath: ['1,0'] });
    const beat = resolveBoardBeat(model);
    expect(beat.id).toBe('move-preview');
    expect(beat.camera).toEqual({ automatic: false, suggestion: 'intent' });
  });

  it('keeps base tile transforms independent from transient interaction state', () => {
    const tile = { x: 2, z: 3, height: 0.75 };
    expect(baseTileTransform(tile)).toEqual(baseTileTransform({ ...tile, hovered: true, selected: true, invalid: true }));
  });

  it('identifies only the renderer layers affected by a route preview', () => {
    const before = deriveBoardViewModel({ cells, currentLocation: '0,0', activeAction: Action.MOVE });
    const after = deriveBoardViewModel({ cells, currentLocation: '0,0', intentAlias: '1,0', previewPath: ['1,0'], activeAction: Action.MOVE });
    expect(changedBoardLayers(before, after)).toEqual(expect.arrayContaining(['affordances', 'intent', 'route']));
    expect(changedBoardLayers(before, after)).not.toContain('party');
  });
});
