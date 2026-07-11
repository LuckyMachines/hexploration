import { describe, expect, it } from 'vitest';
import { emptyReturnLoop, returnRecommendation, selectRole, startReturnableExpedition, updateExpeditionReturn } from './returnLoop';

describe('return loop', () => {
  it('asks a new player to choose a role before starting a run', () => expect(returnRecommendation(emptyReturnLoop()).action).toMatch(/Choose your expedition role/));
  it('persists a role-specific reason to begin', () => expect(returnRecommendation(selectRole(emptyReturnLoop(), 'warden')).reason).toMatch(/stabilizes crossings/));
  it('turns an active game into a resumable pressure-aware decision', () => {
    const started = startReturnableExpedition(selectRole(emptyReturnLoop(), 'scout'), { gameId: '42' });
    const state = updateExpeditionReturn(started, { lifecycle: 'at-risk', pressure: 71, nextReason: 'Vex needs your scan before the bridge collapses.' });
    expect(returnRecommendation(state)).toMatchObject({ action: 'Protect the extraction route', href: '/game/42' });
  });
});
