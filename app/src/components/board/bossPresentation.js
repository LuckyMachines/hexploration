import { Tile } from '../../lib/constants';

export const BOSS_PRESENTATIONS = Object.freeze([
  Object.freeze({
    id: 'emberglass-razorback',
    label: 'Emberglass Razorback',
    tileType: Tile.DESERT,
    aliases: Object.freeze(['emberglass-razorback', 'emberglass-awakening', 'razorback-awakening']),
    enemyTextureKey: 'emberglassRazorback',
    sceneTexture: '/images/art/bosses/emberglass-razorback-reveal.webp',
    tileTexture: '/images/art/bosses/emberglass-razorback-tile.runtime.webp',
    lightColor: '#e8a243',
    standeeScale: Object.freeze([1.48, 1.05]),
  }),
  Object.freeze({
    id: 'stormneedle-strider',
    label: 'Stormneedle Strider',
    tileType: Tile.MOUNTAIN,
    aliases: Object.freeze(['stormneedle-strider', 'wind-vault', 'stormneedle-shelter']),
    enemyTextureKey: 'stormneedleStrider',
    sceneTexture: '/images/art/bosses/stormneedle-strider-reveal.webp',
    tileTexture: '/images/art/bosses/stormneedle-strider-tile.runtime.webp',
    lightColor: '#8ad9d1',
    standeeScale: Object.freeze([1.38, 1.48]),
  }),
  Object.freeze({
    id: 'violet-warden',
    label: 'Violet Reliquary Warden',
    tileType: Tile.RELIC,
    aliases: Object.freeze(['violet-warden', 'violet-reliquary-warden', 'reliquary-bargain']),
    enemyTextureKey: 'violetReliquaryWarden',
    sceneTexture: '/images/art/bosses/violet-warden-reveal.webp',
    tileTexture: '/images/art/bosses/violet-warden-tile.runtime.webp',
    lightColor: '#b994e6',
    standeeScale: Object.freeze([1.42, 1.36]),
  }),
]);

export function bossPresentationFor(encounterId = '') {
  const normalized = String(encounterId || '').trim().toLowerCase();
  if (!normalized) return null;
  return BOSS_PRESENTATIONS.find((boss) => boss.aliases.some((alias) => normalized === alias || normalized.includes(alias))) || null;
}

export function bossPresentationsForTileTypes(tileTypes = new Set()) {
  return BOSS_PRESENTATIONS.filter((boss) => tileTypes.has(boss.tileType));
}
