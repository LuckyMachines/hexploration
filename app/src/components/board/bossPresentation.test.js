import { describe, expect, it } from 'vitest';
import { Tile } from '../../lib/constants';
import { BOSS_PRESENTATIONS, bossPresentationFor, bossPresentationsForTileTypes } from './bossPresentation';

describe('boss presentation catalog', () => {
  it('maps authored and narrative encounter ids to a complete reveal package', () => {
    expect(bossPresentationFor('emberglass-awakening')).toMatchObject({ id: 'emberglass-razorback', tileType: Tile.DESERT });
    expect(bossPresentationFor('wind-vault')).toMatchObject({ id: 'stormneedle-strider', tileType: Tile.MOUNTAIN });
    expect(bossPresentationFor('reliquary-bargain')).toMatchObject({ id: 'violet-warden', tileType: Tile.RELIC });
    BOSS_PRESENTATIONS.forEach((boss) => {
      expect(boss.sceneTexture).toMatch(/-reveal\.webp$/);
      expect(boss.tileTexture).toMatch(/-tile\.runtime\.webp$/);
      expect(boss.enemyTextureKey).toBeTruthy();
    });
  });

  it('returns only boss packages relevant to visible tile families', () => {
    const bosses = bossPresentationsForTileTypes(new Set([Tile.DESERT, Tile.RELIC]));
    expect(bosses.map((boss) => boss.id)).toEqual(['emberglass-razorback', 'violet-warden']);
    expect(bossPresentationFor('ordinary-crossing')).toBeNull();
  });
});
