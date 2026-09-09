import { describe, expect, it } from 'vitest';
import { LIGHTING_RIG_IDS, LIGHTING_RIGS, resolveLightingRigId } from './lightingRigs';

describe('lighting rigs', () => {
  it('keeps semantic state colors in named rigs', () => {
    expect(LIGHTING_RIG_IDS).toEqual(['neutral', 'discovery', 'danger', 'recovery', 'relic']);
    expect(LIGHTING_RIGS.danger.fill.color).toBe('#e85d58');
    expect(LIGHTING_RIGS.danger.fog.color).not.toBe('#ef6257');
  });

  it('resolves one deterministic rig from game state', () => {
    expect(resolveLightingRigId({ isDanger: true, isResolving: true })).toBe('danger');
    expect(resolveLightingRigId({ isResolving: true })).toBe('discovery');
    expect(resolveLightingRigId({ lowStats: true })).toBe('recovery');
    expect(resolveLightingRigId({ activeAction: 4 })).toBe('relic');
    expect(resolveLightingRigId({})).toBe('neutral');
  });
});
