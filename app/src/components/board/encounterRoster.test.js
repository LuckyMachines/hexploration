import { describe, expect, it } from 'vitest';
import { Tile } from '../../lib/constants';
import {
  ENCOUNTER_ROSTER,
  ENCOUNTER_TEXTURES,
  encounterTextureKey,
  encounterTextureKeysForTileTypes,
} from './encounterRoster';

describe('encounter roster', () => {
  it('gives every playable tile family at least two biome-specific encounters', () => {
    Object.values(Tile).filter((tileType) => Number.isInteger(tileType) && tileType !== Tile.NONE).forEach((tileType) => {
      expect(ENCOUNTER_ROSTER[tileType]?.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('maps every roster key to a runtime WebP', () => {
    Object.values(ENCOUNTER_ROSTER).flat().forEach((keyName) => {
      expect(ENCOUNTER_TEXTURES[keyName]).toMatch(/\.runtime\.webp$/);
    });
  });

  it('selects deterministically and preserves authored encounter overrides', () => {
    const tile = { alias: '2,-1', tileType: Tile.MOUNTAIN };
    expect(encounterTextureKey(tile, 'storm-front')).toBe(encounterTextureKey(tile, 'storm-front'));
    expect(ENCOUNTER_ROSTER[Tile.MOUNTAIN]).toContain(encounterTextureKey(tile, 'storm-front'));
    expect(encounterTextureKey(tile, 'wind-vault')).toBe('stormneedleStrider');
  });

  it('loads only encounters needed by visible tile families', () => {
    const keys = encounterTextureKeysForTileTypes(new Set([Tile.JUNGLE, Tile.DESERT]));
    expect(keys.size).toBe(5);
    expect(keys.has('glassrootLanternback')).toBe(true);
    expect(keys.has('stormneedleStrider')).toBe(false);
  });
});
