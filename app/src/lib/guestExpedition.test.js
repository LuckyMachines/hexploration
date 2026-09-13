import { describe, expect, it } from 'vitest';
import {
  GUEST_EXPEDITION_STORAGE_KEY,
  GUEST_ENCOUNTERS,
  GUEST_LANDING_SITE,
  GUEST_LOCATION_PROFILES,
  GUEST_TERRAIN,
  canDepartGuestExpedition,
  canUseGuestCrewAbility,
  commitGuestMove,
  createGuestExpedition,
  departGuestExpedition,
  emergencyExtractGuestExpedition,
  guestBoardInput,
  guestCrewBark,
  guestDistanceToLanding,
  guestEmotionalBeat,
  guestExpeditionArc,
  guestLocationProfile,
  guestOutcome,
  guestPendingEncounter,
  guestReachableAliases,
  guestRouteForecast,
  guestRouteRecommendation,
  loadGuestExpedition,
  resolveGuestEncounter,
  saveGuestExpedition,
  selectGuestTile,
  useGuestCrewAbility,
} from './guestExpedition';
import { Tile } from './constants';

function move(state, alias) {
  return commitGuestMove(selectGuestTile(state, alias));
}

function reachTideglass() {
  let state = move(createGuestExpedition(), '1,1');
  state = resolveGuestEncounter(state, 'mark');
  state = move(state, '0,1');
  return move(state, '0,0');
}

describe('guest expedition', () => {
  it('keeps every map cell authored and every relic outside the opening ring', () => {
    const names = GUEST_TERRAIN.map((cell) => GUEST_LOCATION_PROFILES[cell.alias]?.name);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(GUEST_TERRAIN.length);
    for (const relic of GUEST_TERRAIN.filter((cell) => cell.tileType === Tile.RELIC)) {
      expect(guestDistanceToLanding({ ...createGuestExpedition(), currentLocation: relic.alias })).toBeGreaterThanOrEqual(3);
    }
    for (const encounter of Object.values(GUEST_ENCOUNTERS)) {
      expect(encounter.choices).toHaveLength(2);
      expect(encounter.choices.every((choice) => choice.label && choice.detail)).toBe(true);
    }
  });

  it('starts at the landing beacon with six informed adjacent routes', () => {
    const state = createGuestExpedition();

    expect(state.currentLocation).toBe(GUEST_LANDING_SITE);
    expect(guestDistanceToLanding(state)).toBe(0);
    expect(guestReachableAliases(state)).toEqual(expect.arrayContaining(['3,2', '1,1', '2,1']));
    expect(guestReachableAliases(state)).toHaveLength(6);
    expect(state.revealedAliases).toHaveLength(7);
    expect(guestLocationProfile(state.currentLocation)?.name).toBe('Beaconfall Basin');
  });

  it('forecasts consequences before entering an authored landmark encounter', () => {
    const initial = createGuestExpedition();
    const forecast = guestRouteForecast(initial, '1,1');
    const entered = move(initial, '1,1');

    expect(forecast).toMatchObject({ name: 'Echo Fork', pressure: 5, projectedPressure: 15 });
    expect(forecast.encounter?.id).toBe('echo-fork');
    expect(entered).toMatchObject({ currentLocation: '1,1', supplies: 8, pendingEncounter: 'echo-fork', lastEvent: 'encounter' });
    expect(guestReachableAliases(entered)).toEqual([]);
    expect(guestPendingEncounter(entered)?.choices).toHaveLength(2);
  });

  it('resolves a landmark choice with deterministic information and cost', () => {
    const entered = move(createGuestExpedition(), '1,1');
    const resolved = resolveGuestEncounter(entered, 'trace');

    expect(resolved.pendingEncounter).toBeNull();
    expect(resolved.resolvedEncounters).toContain('echo-fork');
    expect(resolved.revealedAliases).toEqual(expect.arrayContaining(['0,1', '1,0']));
    expect(resolved.pressure).toBe(22);
    expect(resolved.journal.at(-1).title).toContain('Trace every echo');
  });

  it('requires a multi-crossing arc before a relic can be recovered', () => {
    const carrying = reachTideglass();

    expect(carrying.currentLocation).toBe('0,0');
    expect(carrying.supplies).toBe(7);
    expect(carrying.relics).toBe(1);
    expect(carrying.lastEvent).toBe('relic');
    expect(carrying.routeHistory).toEqual(['2,2', '1,1', '0,1', '0,0']);
    expect(guestEmotionalBeat(carrying)).toMatchObject({ title: 'Tideglass Cradle Answered', tone: 'gold' });
    expect(guestBoardInput(carrying).cells.find((cell) => cell.alias === '0,0')).toMatchObject({
      tileType: Tile.RELIC,
      revealed: true,
    });
  });

  it('guides discovery and then guides recovered value home', () => {
    const initial = createGuestExpedition();
    expect(guestRouteRecommendation(initial)).toMatchObject({ alias: '1,1', label: 'Strongest signal' });

    const carrying = reachTideglass();
    expect(guestRouteRecommendation(carrying)).toMatchObject({ alias: '0,1', label: 'Safest route home' });
    expect(guestCrewBark(carrying)).toMatchObject({ speaker: 'Routekeeper' });
    expect(guestExpeditionArc(carrying).id).toBe('greed-window');
  });

  it('gives each crew member one consequential expedition ability', () => {
    let state = move(createGuestExpedition(), '2,1');
    expect(canUseGuestCrewAbility(state, 'trace')).toBe(true);
    state = useGuestCrewAbility(state, 'trace');
    expect(state.usedAbilities).toContain('trace');
    expect(state.pressure).toBe(23);
    expect(canUseGuestCrewAbility(state, 'trace')).toBe(false);

    expect(canUseGuestCrewAbility(state, 'anchor')).toBe(false);
    state = { ...state, pressure: 40 };
    expect(canUseGuestCrewAbility(state, 'anchor')).toBe(true);
    state = useGuestCrewAbility(state, 'anchor');
    expect(state).toMatchObject({ pressure: 22, supplies: 7, lastEvent: 'anchor' });
  });

  it('allows a safe departure after a full return and creates a scored outcome', () => {
    let state = reachTideglass();
    state = move(state, '0,1');
    state = move(state, '1,1');
    state = move(state, GUEST_LANDING_SITE);
    expect(canDepartGuestExpedition(state)).toBe(true);
    const departed = departGuestExpedition(state, '2026-09-13T12:00:00.000Z');
    expect(departed).toMatchObject({ status: 'complete', result: 'safe', relics: 1, lastEvent: 'safe-departure' });
    expect(guestEmotionalBeat(departed).nextPrompt).toMatch(/live crew/i);
    expect(guestOutcome(departed)).toMatchObject({ grade: expect.stringMatching(/^[SABCD]$/), title: 'Relic Homecoming' });
  });

  it('turns a redline route into a consequential emergency extraction', () => {
    const initial = { ...createGuestExpedition(), pressure: 95 };
    const redline = move(initial, '3,2');
    const extracted = emergencyExtractGuestExpedition(redline, '2026-09-13T12:00:00.000Z');

    expect(redline.status).toBe('redline');
    expect(extracted).toMatchObject({ status: 'complete', result: 'emergency', currentLocation: GUEST_LANDING_SITE, relics: 0 });
    expect(guestOutcome(extracted)?.title).toBe('Stormline Rescue');
  });

  it('migrates and persists authored progress without losing the route', () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const moved = move(createGuestExpedition(), '1,1');

    expect(saveGuestExpedition(moved, storage)).toBe(true);
    expect(values.has(GUEST_EXPEDITION_STORAGE_KEY)).toBe(true);
    expect(loadGuestExpedition(storage)).toMatchObject({ currentLocation: '1,1', relics: 0, turns: 1, pendingEncounter: 'echo-fork' });
    expect(loadGuestExpedition(storage).routeHistory).toEqual(['2,2', '1,1']);
  });
});
