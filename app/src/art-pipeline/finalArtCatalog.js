import finalArtExpansion from './final-art-expansion.json';
import finalArtExpansion2 from './final-art-expansion-2.json';

export const FINAL_ART_EXPANSION_MANIFEST = Object.freeze(finalArtExpansion);
export const FINAL_ART_EXPANSION_2_MANIFEST = Object.freeze(finalArtExpansion2);
export const FINAL_ART_EXPANSION_VERSION = FINAL_ART_EXPANSION_2_MANIFEST.version;

export const GUEST_LOCATION_ART = Object.freeze({
  'Beaconfall Basin': '/images/art/environments/beaconfall-basin.webp',
  'Echo Fork': '/images/art/environments/echo-fork.webp',
  'Hushgrass Shelf': '/images/art/environments/hushgrass-shelf.webp',
  'Tideglass Cradle': '/images/art/environments/tideglass-cradle.webp',
  'Wind Vault': '/images/art/environments/wind-vault.webp',
  'Memory Ferns': '/images/art/environments/memory-ferns.webp',
  'Bellstone Rise': '/images/art/environments/bellstone-rise.webp',
  'Ashwake Verge': '/images/art/environments/ashwake-verge.webp',
  'Glassroot Choir': '/images/art/environments/glassroot-choir.webp',
  'Cinderwake Flats': '/images/art/environments/cinderwake-flats.webp',
  'Mossglass Gate': '/images/art/environments/mossglass-gate.webp',
  'Quiet Step': '/images/art/environments/quiet-step.webp',
  'Stormneedle Pass': '/images/art/environments/stormneedle-pass.webp',
  'Furnace Scar': '/images/art/environments/furnace-scar.webp',
  'Pale Compass Field': '/images/art/environments/pale-compass-field.webp',
  'Split Needle': '/images/art/environments/split-needle.webp',
  'Rootlight Vale': '/images/art/environments/rootlight-vale.webp',
  'Atlas Spindle': '/images/art/environments/atlas-spindle.webp',
  'Veilwood Fringe': '/images/art/environments/veilwood-fringe.webp',
  'Far Slate': '/images/art/environments/far-slate.webp',
});

export const GUEST_ENCOUNTER_ART = Object.freeze({
  'echo-fork': '/images/art/encounters/echo-fork-decision.webp',
  'wind-vault': '/images/art/encounters/wind-vault-decision.webp',
  'glassroot-choir': '/images/art/encounters/glassroot-choir-decision-v2.runtime.webp',
  'cinderwake-flats': '/images/art/encounters/cinderwake-flats-decision-v2.runtime.webp',
  'stormneedle-pass': '/images/art/encounters/stormneedle-strider.runtime.webp',
  'furnace-scar': '/images/art/encounters/emberglass-razorback.runtime.webp',
  'bellstone-rise': '/images/art/encounters/bellstone-rise-decision-v2.runtime.webp',
  'rootlight-vale': '/images/art/encounters/lantern-moss-burrower.runtime.webp',
  'veilwood-fringe': '/images/art/encounters/glassroot-stalker.runtime.webp',
  'far-slate': '/images/art/encounters/far-slate-decision-v2.runtime.webp',
});

export const GUEST_ABILITY_ART = Object.freeze({
  trace: '/images/art/characters/signal-cartographer-surveying.webp',
  anchor: '/images/art/characters/routekeeper-anchoring.webp',
  mend: '/images/art/characters/field-mender-helping.runtime.webp',
  attune: '/images/art/characters/relic-tender-carrying.runtime.webp',
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
  Object.freeze({
    id: 'bellstone-clapper',
    name: 'Bellstone Clapper',
    image: '/images/art/relics/bellstone-clapper.png',
    promise: 'Feel the next pressure wave before the ridge begins to ring.',
  }),
  Object.freeze({
    id: 'veilglass-map',
    name: 'Veilglass Map',
    image: '/images/art/relics/veilglass-map.png',
    promise: 'Align three mineral leaves to reveal one living shortcut.',
  }),
  Object.freeze({
    id: 'ashwake-key',
    name: 'Ashwake Key',
    image: '/images/art/relics/ashwake-key.png',
    promise: 'Record what the buried machine changes while no one watches.',
  }),
  Object.freeze({
    id: 'hushgrass-spindle',
    name: 'Hushgrass Spindle',
    image: '/images/art/relics/hushgrass-spindle.png',
    promise: 'Store unheard movement and replay it as a safe crossing.',
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
