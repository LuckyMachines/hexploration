import { describe, expect, it } from 'vitest';
import { Action, Tile } from './constants';
import {
  TILE_TRAIT_IDS,
  adjacentFogCount,
  traitEffectsForAction,
  traitForTile,
  traitPreviewForIntent,
  traitsForBoard,
} from './tileTraits';

describe('tileTraits', () => {
  it('assigns traits deterministically', () => {
    const input = {
      gameId: '1',
      zoneAlias: '2,2',
      tileType: Tile.MOUNTAIN,
      landingSite: '0,0',
      currentLocation: '1,1',
      departPressure: { pressure: 35 },
    };

    expect(traitForTile(input)).toEqual(traitForTile(input));
  });

  it('biases landing tiles toward route traits', () => {
    const seen = new Set(Array.from({ length: 20 }, (_, index) => traitForTile({
      gameId: `landing-${index}`,
      zoneAlias: '0,0',
      tileType: Tile.LANDING,
      landingSite: '0,0',
      currentLocation: '0,0',
      departPressure: { pressure: 80 },
    }).id));

    expect([...seen].some((id) => [TILE_TRAIT_IDS.SIGNAL, TILE_TRAIT_IDS.OLD_TRAIL, TILE_TRAIT_IDS.CACHE].includes(id))).toBe(true);
  });

  it('biases relic tiles toward vein or risk traits', () => {
    const seen = new Set(Array.from({ length: 20 }, (_, index) => traitForTile({
      gameId: `relic-${index}`,
      zoneAlias: '4,4',
      tileType: Tile.RELIC,
      landingSite: '0,0',
      currentLocation: '2,2',
      departPressure: { pressure: 20 },
    }).id));

    expect([...seen].some((id) => [TILE_TRAIT_IDS.RELIC_VEIN, TILE_TRAIT_IDS.UNSTABLE_GROUND, TILE_TRAIT_IDS.ECHO_FIELD].includes(id))).toBe(true);
  });

  it('returns unknown fallback for fog', () => {
    const trait = traitForTile({ zoneAlias: '9,9', tileType: Tile.NONE, revealed: false });
    expect(trait.id).toBe(TILE_TRAIT_IDS.UNKNOWN);
    expect(trait.isKnown).toBe(false);
  });

  it('computes board traits from revealed map', () => {
    const traits = traitsForBoard({
      gameId: 'board',
      landingSite: '0,0',
      currentLocation: '0,0',
      revealedMap: {
        '0,0': { tileType: Tile.LANDING },
        '1,0': { tileType: Tile.PLAINS },
      },
    });

    expect(Object.keys(traits)).toEqual(['0,0', '1,0']);
  });

  it('matches shelter with rest and unstable ground with warnings', () => {
    const shelter = { id: TILE_TRAIT_IDS.SHELTER, label: 'Shelter', preferredAction: Action.REST, pressureDelta: -6, costDelta: -5, routeDelta: 0, revealDelta: 0, valueDelta: 0, teamDelta: 8, effect: 'Rest here.' };
    const unstable = { id: TILE_TRAIT_IDS.UNSTABLE_GROUND, label: 'Unstable Ground', preferredAction: Action.MOVE, pressureDelta: 10, costDelta: 8, routeDelta: -8, revealDelta: 0, valueDelta: 0, teamDelta: -2, effect: 'Risk.' };

    expect(traitEffectsForAction(shelter, Action.REST).matched).toBe(true);
    expect(traitEffectsForAction(unstable, Action.MOVE).warning).toBe(true);
  });

  it('previews intent action against trait', () => {
    const trait = traitForTile({
      gameId: 'preview',
      zoneAlias: '1,0',
      tileType: Tile.DESERT,
      landingSite: '0,0',
      currentLocation: '2,0',
      departPressure: { pressure: 80 },
    });
    const preview = traitPreviewForIntent({
      trait,
      activeAction: Action.MOVE,
      currentLocation: '2,0',
      landingSite: '0,0',
      intentAlias: '1,0',
    });

    expect(preview.title).toBe(trait.label);
    expect(preview.preferredActionLabel).toBeTruthy();
  });

  it('counts adjacent fog around an alias', () => {
    expect(adjacentFogCount('0,0', ['0,0'])).toBeGreaterThan(0);
  });
});
