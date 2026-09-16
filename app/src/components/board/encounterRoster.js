import { Tile } from '../../lib/constants';
import { seedForAlias } from './boardWorld';

export const ENCOUNTER_TEXTURES = Object.freeze({
  glassrootGrazer: '/images/art/encounters/glassroot-stalker.runtime.webp',
  emberglassScuttler: '/images/art/encounters/emberglass-mimic.runtime.webp',
  cinderwakeSiphon: '/images/art/encounters/cinderwake-siphon.runtime.webp',
  emberglassRazorback: '/images/art/encounters/emberglass-razorback.runtime.webp',
  glassrootLanternback: '/images/art/encounters/glassroot-lanternback.runtime.webp',
  hushgrassWhistler: '/images/art/encounters/hushgrass-whistler.runtime.webp',
  lanternMossBurrower: '/images/art/encounters/lantern-moss-burrower.runtime.webp',
  memoryFernEcho: '/images/art/encounters/memory-fern-echo.runtime.webp',
  slateSpireKite: '/images/art/encounters/slate-spire-kite.runtime.webp',
  stormneedleStrider: '/images/art/encounters/stormneedle-strider.runtime.webp',
  tideglassSkimmer: '/images/art/encounters/tideglass-skimmer.runtime.webp',
  verdantSignalListener: '/images/art/encounters/verdant-signal-listener.runtime.webp',
  violetReliquaryWarden: '/images/art/encounters/violet-reliquary-warden.runtime.webp',
});

export const ENCOUNTER_ROSTER = Object.freeze({
  [Tile.LANDING]: Object.freeze(['verdantSignalListener', 'memoryFernEcho']),
  [Tile.JUNGLE]: Object.freeze(['glassrootGrazer', 'glassrootLanternback']),
  [Tile.PLAINS]: Object.freeze(['lanternMossBurrower', 'hushgrassWhistler']),
  [Tile.DESERT]: Object.freeze(['emberglassScuttler', 'emberglassRazorback', 'cinderwakeSiphon']),
  [Tile.MOUNTAIN]: Object.freeze(['slateSpireKite', 'stormneedleStrider']),
  [Tile.RELIC]: Object.freeze(['violetReliquaryWarden', 'tideglassSkimmer']),
});

export function encounterTextureKey(tile, encounterId = '') {
  if (encounterId === 'wind-vault') return 'stormneedleStrider';
  const roster = ENCOUNTER_ROSTER[tile?.tileType] || [];
  if (!roster.length) return null;
  return roster[seedForAlias(`${tile.alias}:${encounterId || 'danger'}`) % roster.length];
}

export function encounterTextureKeysForTileTypes(tileTypes) {
  return new Set([...tileTypes].flatMap((tileType) => ENCOUNTER_ROSTER[tileType] || []));
}
