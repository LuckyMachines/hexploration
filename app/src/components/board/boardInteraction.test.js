import { describe, expect, it } from 'vitest';
import { cameraPresetAliases, clampBoardTarget, pointerExceededDragThreshold, resolvePickedAlias } from './boardInteraction';

describe('board interaction contract', () => {
  it('resolves aliases from instanced and ordinary meshes', () => {
    expect(resolvePickedAlias({ instanceId: 1, object: { userData: { aliasByInstance: ['0,0', '1,0'] } } })).toBe('1,0');
    expect(resolvePickedAlias({ object: { userData: { alias: '2,0' } } })).toBe('2,0');
  });

  it('clamps camera targets to the playable world', () => {
    expect(clampBoardTarget({ x: 20, y: -2, z: -20 }, { width: 10, depth: 8 })).toEqual({ x: 4.2, y: 0, z: -3.36 });
  });

  it('distinguishes a click from a drag and derives preset targets', () => {
    expect(pointerExceededDragThreshold({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false);
    expect(pointerExceededDragThreshold({ x: 0, y: 0 }, { x: 6, y: 0 })).toBe(true);
    expect(cameraPresetAliases('party', { playerLocationMap: { '1,0': [0], '2,0': [1] } })).toEqual(['1,0', '2,0']);
    expect(cameraPresetAliases('intent', { intentAlias: '3,0' })).toEqual(['3,0']);
  });
});
