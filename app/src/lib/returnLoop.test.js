import { describe, expect, it } from 'vitest';
import { emptyReturnLoop, mergeReturnLoops, returnRecommendation, selectRole, startReturnableExpedition, updateExpeditionReturn } from './returnLoop';

describe('return loop', () => {
  it('asks a new player to choose a role before starting a run', () => expect(returnRecommendation(emptyReturnLoop()).action).toMatch(/Choose your expedition role/));
  it('persists a role-specific reason to begin', () => expect(returnRecommendation(selectRole(emptyReturnLoop(), 'warden')).reason).toMatch(/stabilizes crossings/));
  it('turns an active game into a resumable pressure-aware decision', () => {
    const started = startReturnableExpedition(selectRole(emptyReturnLoop(), 'scout'), { gameId: '42' });
    const state = updateExpeditionReturn(started, { lifecycle: 'at-risk', pressure: 71, nextReason: 'Vex needs your scan before the bridge collapses.' });
    expect(returnRecommendation(state)).toMatchObject({ action: 'Protect the extraction route', href: '/game/42' });
  });
  it('never routes a local starter thread into a nonexistent on-chain game', () => {
    const started = startReturnableExpedition(selectRole(emptyReturnLoop(), 'scout'), { name: 'Sector 0 signal' });
    expect(returnRecommendation(started)).toMatchObject({ href: '#return-loop' });
    expect(returnRecommendation(updateExpeditionReturn(started, { lifecycle: 'waiting-on-crew' }))).toMatchObject({ href: '#live-expedition' });
  });
  it('merges two devices without letting an older expedition overwrite a newer one', () => {
    const local = startReturnableExpedition(selectRole(emptyReturnLoop(), 'scout'), { gameId: '42' });
    const cloud = updateExpeditionReturn(local, { pressure: 81, nextAction: 'Protect the bridge' });
    const stale = { ...local, expedition: { ...local.expedition, updatedAt: '2020-01-01T00:00:00.000Z' } };
    const merged = mergeReturnLoops(stale, cloud);
    expect(merged.expedition).toMatchObject({ gameId: '42', pressure: 81, nextAction: 'Protect the bridge' });
    expect(merged.player.role).toBe('scout');
  });
});
