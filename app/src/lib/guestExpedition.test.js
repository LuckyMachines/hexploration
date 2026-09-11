import { describe, expect, it } from 'vitest';
import {
  GUEST_EXPEDITION_STORAGE_KEY,
  GUEST_LANDING_SITE,
  canDepartGuestExpedition,
  commitGuestMove,
  createGuestExpedition,
  departGuestExpedition,
  emergencyExtractGuestExpedition,
  guestBoardInput,
  guestDistanceToLanding,
  guestReachableAliases,
  loadGuestExpedition,
  saveGuestExpedition,
  selectGuestTile,
} from './guestExpedition';
import { Tile } from './constants';

describe('guest expedition', () => {
  it('starts at the landing beacon with six playable adjacent routes', () => {
    const state = createGuestExpedition();

    expect(state.currentLocation).toBe(GUEST_LANDING_SITE);
    expect(guestDistanceToLanding(state)).toBe(0);
    expect(guestReachableAliases(state)).toEqual(expect.arrayContaining(['3,2', '1,1', '2,1']));
    expect(guestReachableAliases(state)).toHaveLength(6);
  });

  it('reveals terrain, spends supplies, raises pressure, and recovers a relic', () => {
    const initial = createGuestExpedition();
    const selected = selectGuestTile(initial, '3,2');
    const moved = commitGuestMove(selected);

    expect(selected.selectedAlias).toBe('3,2');
    expect(moved.currentLocation).toBe('3,2');
    expect(moved.revealedAliases).toContain('3,2');
    expect(moved.supplies).toBe(7);
    expect(moved.pressure).toBeGreaterThan(initial.pressure);
    expect(moved.relics).toBe(1);
    expect(guestBoardInput(moved).cells.find((cell) => cell.alias === '3,2')).toMatchObject({
      tileType: Tile.RELIC,
      revealed: true,
    });
  });

  it('allows a safe departure only after returning to landing', () => {
    let state = commitGuestMove(selectGuestTile(createGuestExpedition(), '3,2'));
    expect(canDepartGuestExpedition(state)).toBe(false);

    state = commitGuestMove(selectGuestTile(state, GUEST_LANDING_SITE));
    expect(canDepartGuestExpedition(state)).toBe(true);
    expect(departGuestExpedition(state)).toMatchObject({ status: 'complete', result: 'safe', relics: 1 });
  });

  it('turns a redline route into a consequential emergency extraction', () => {
    const initial = { ...createGuestExpedition(), pressure: 95 };
    const redline = commitGuestMove(selectGuestTile(initial, '3,2'));
    const extracted = emergencyExtractGuestExpedition(redline);

    expect(redline.status).toBe('redline');
    expect(extracted).toMatchObject({ status: 'complete', result: 'emergency', currentLocation: GUEST_LANDING_SITE, relics: 0 });
  });

  it('persists and restores local progress without an account', () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const moved = commitGuestMove(selectGuestTile(createGuestExpedition(), '3,2'));

    expect(saveGuestExpedition(moved, storage)).toBe(true);
    expect(values.has(GUEST_EXPEDITION_STORAGE_KEY)).toBe(true);
    expect(loadGuestExpedition(storage)).toMatchObject({ currentLocation: '3,2', relics: 1, turns: 1 });
  });
});
