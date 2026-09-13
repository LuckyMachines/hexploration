import finalArtExpansion from './final-art-expansion.json';

export const FINAL_ART_EXPANSION_MANIFEST = Object.freeze(finalArtExpansion);
export const FINAL_ART_EXPANSION_VERSION = FINAL_ART_EXPANSION_MANIFEST.version;

export const GUEST_LOCATION_ART = Object.freeze({
  'Beaconfall Basin': '/images/art/environments/beaconfall-basin.webp',
  'Echo Fork': '/images/art/environments/echo-fork.webp',
  'Hushgrass Shelf': '/images/art/environments/hushgrass-shelf.webp',
  'Tideglass Cradle': '/images/art/environments/tideglass-cradle.webp',
  'Wind Vault': '/images/art/environments/wind-vault.webp',
  'Memory Ferns': '/images/art/environments/memory-ferns.webp',
  'Bellstone Rise': '/images/art/environments/bellstone-rise.webp',
  'Ashwake Verge': '/images/art/environments/ashwake-verge.webp',
});

export const GUEST_ENCOUNTER_ART = Object.freeze({
  'echo-fork': '/images/art/encounters/echo-fork-decision.webp',
  'wind-vault': '/images/art/encounters/wind-vault-decision.webp',
});

export const GUEST_ABILITY_ART = Object.freeze({
  trace: '/images/art/characters/signal-cartographer-surveying.webp',
  anchor: '/images/art/characters/routekeeper-anchoring.webp',
});

export const CHARACTER_MOMENT_ART = Object.freeze({
  'relic-tender-discovery': '/images/art/characters/relic-tender-discovery.webp',
  'field-mender-redline': '/images/art/characters/field-mender-redline.webp',
});

export const FUTURE_RELIC_SIGNALS = Object.freeze([
  Object.freeze({
    id: 'echo-compass',
    name: 'Echo Compass',
    image: '/images/art/relics/echo-compass.png',
    promise: 'Separate one true route from two storm reflections.',
  }),
  Object.freeze({
    id: 'stormglass-seed',
    name: 'Stormglass Seed',
    image: '/images/art/relics/stormglass-seed.png',
    promise: 'Store the instant before lightning and release a safe-route pulse.',
  }),
]);

export function guestLocationArtwork(locationName, fallback = null) {
  return GUEST_LOCATION_ART[String(locationName || '')] || fallback;
}

export default Object.freeze({
  version: FINAL_ART_EXPANSION_VERSION,
  locations: GUEST_LOCATION_ART,
  encounters: GUEST_ENCOUNTER_ART,
  abilities: GUEST_ABILITY_ART,
  characterMoments: CHARACTER_MOMENT_ART,
  futureRelics: FUTURE_RELIC_SIGNALS,
});
