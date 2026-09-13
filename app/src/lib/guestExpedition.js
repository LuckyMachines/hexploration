import { Action, Tile, TILE_LABELS } from './constants';
import { getAdjacent, parseAlias } from './hexmath';
import { ARC_DEFINITIONS, EXPEDITION_ARC_IDS } from './expeditionArc';

export const GUEST_EXPEDITION_STORAGE_KEY = 'xenovoya:guest-expedition:v1';
export const GUEST_LANDING_SITE = '2,2';
export const GUEST_EXPEDITION_VERSION = 2;

const TERRAIN_PRESSURE = Object.freeze({
  [Tile.LANDING]: 2,
  [Tile.PLAINS]: 5,
  [Tile.JUNGLE]: 8,
  [Tile.DESERT]: 12,
  [Tile.MOUNTAIN]: 15,
  [Tile.RELIC]: 10,
});

const RELIC_WAKE_PRESSURE = 28;

export const GUEST_TERRAIN = Object.freeze([
  { alias: '0,0', tileType: Tile.RELIC },
  { alias: '0,1', tileType: Tile.PLAINS },
  { alias: '0,2', tileType: Tile.JUNGLE },
  { alias: '0,3', tileType: Tile.DESERT },
  { alias: '1,0', tileType: Tile.JUNGLE },
  { alias: '1,1', tileType: Tile.PLAINS },
  { alias: '1,2', tileType: Tile.PLAINS },
  { alias: '1,3', tileType: Tile.MOUNTAIN },
  { alias: '2,0', tileType: Tile.DESERT },
  { alias: '2,1', tileType: Tile.JUNGLE },
  { alias: GUEST_LANDING_SITE, tileType: Tile.LANDING },
  { alias: '2,3', tileType: Tile.PLAINS },
  { alias: '3,0', tileType: Tile.MOUNTAIN },
  { alias: '3,1', tileType: Tile.PLAINS },
  { alias: '3,2', tileType: Tile.MOUNTAIN },
  { alias: '3,3', tileType: Tile.JUNGLE },
  { alias: '4,0', tileType: Tile.RELIC },
  { alias: '4,1', tileType: Tile.JUNGLE },
  { alias: '4,2', tileType: Tile.MOUNTAIN },
  { alias: '4,3', tileType: Tile.DESERT },
]);

export const GUEST_LOCATION_PROFILES = Object.freeze({
  '0,0': { name: 'Tideglass Cradle', motif: 'A suspended heart of glass pulls mist into orbit.', omen: 'The relic is listening to the same storm as the crew.', discovery: 'The Tideglass Cradle answers the lantern and wakes the entire horizon.', tone: 'gold' },
  '0,1': { name: 'Hushgrass Shelf', motif: 'Silver grass bends toward sounds the crew cannot hear.', omen: 'The wind is quiet enough to hide a route.', discovery: 'Hushgrass records the crew as a pale wake pointing home.', tone: 'blue' },
  '0,2': { name: 'Glassroot Choir', motif: 'Translucent roots carry a chord beneath the soil.', omen: 'A living signal is following the lantern.', discovery: 'The roots repeat the beacon note and reveal an older crossing.', tone: 'green' },
  '0,3': { name: 'Cinderwake Flats', motif: 'Black sand lifts in slow ribbons around warm glass.', omen: 'Heat is moving against the wind.', discovery: 'A buried ember seam redraws the southern edge of the map.', tone: 'red' },
  '1,0': { name: 'Mossglass Gate', motif: 'Fronds close behind each footstep, then bloom again.', omen: 'Something patient is keeping pace.', discovery: 'The gate parts around a route marker grown into living glass.', tone: 'green' },
  '1,1': { name: 'Echo Fork', motif: 'Three paths answer the same beacon call.', omen: 'One echo is real; two are weather.', discovery: 'The Cartographer finds a repeating note hidden inside the false routes.', tone: 'blue', encounterId: 'echo-fork' },
  '1,2': { name: 'Quiet Step', motif: 'Low stone terraces hold the landing light.', omen: 'The safest ground can still become a trap when the storm turns.', discovery: 'Old boot marks prove another crew once found the beacon from here.', tone: 'green' },
  '1,3': { name: 'Stormneedle Pass', motif: 'Slate fins split the cloudbank into narrow channels.', omen: 'Static crawls down every exposed edge.', discovery: 'The pass offers a fast line home, but no shelter if pressure breaks.', tone: 'red' },
  '2,0': { name: 'Furnace Scar', motif: 'A red seam glows beneath plates of cooled glass.', omen: 'Every flare arrives one breath earlier.', discovery: 'The scar is not cooling; it is counting down.', tone: 'red' },
  '2,1': { name: 'Memory Ferns', motif: 'Each frond repeats the crew as a delayed silhouette.', omen: 'The reflections are watching the wrong horizon.', discovery: 'A reflected route exposes the cost of reaching the beacon from the north.', tone: 'blue' },
  '2,2': { name: 'Beaconfall Basin', motif: 'A cyan landing signal pools across wet basalt.', omen: 'This is the one place the storm cannot erase.', discovery: 'The landing beacon locks the route into a stable departure memory.', tone: 'green' },
  '2,3': { name: 'Pale Compass Field', motif: 'Needle-shaped flowers rotate toward buried metal.', omen: 'Their direction changes whenever the relics answer.', discovery: 'The flowers point to a second signal beyond the visible ridge.', tone: 'blue' },
  '3,0': { name: 'Bellstone Rise', motif: 'Hollow pillars ring whenever pressure crosses the ridge.', omen: 'The next bell will bring the storm closer.', discovery: 'The Routekeeper marks a sheltered channel between the ringing stones.', tone: 'gold' },
  '3,1': { name: 'Wind Vault', motif: 'A roofless ruin holds a pocket of perfectly still air.', omen: 'The quiet can shelter the crew or sharpen the signal.', discovery: 'The vault contains both a safe anchor and a dangerous listening chamber.', tone: 'gold', encounterId: 'wind-vault' },
  '3,2': { name: 'Split Needle', motif: 'A fractured spire frames the beacon like a sight.', omen: 'The homeward path narrows whenever lightning fills the gap.', discovery: 'A sheltered ledge keeps the route legible for one more crossing.', tone: 'red' },
  '3,3': { name: 'Rootlight Vale', motif: 'Green lantern pods illuminate a path no map recorded.', omen: 'Their light dims when anyone turns away.', discovery: 'The vale reveals a living shortcut through the southern canopy.', tone: 'green' },
  '4,0': { name: 'Atlas Spindle', motif: 'A violet mechanism turns without touching the stone.', omen: 'Two relic harmonics overlap here.', discovery: 'The Atlas Spindle opens like a compass remembering a vanished north.', tone: 'gold' },
  '4,1': { name: 'Veilwood Fringe', motif: 'Layered leaves erase depth until the lantern passes.', omen: 'A glassroot grazer is moving just beyond the veil.', discovery: 'The creature withdraws and leaves a luminous route through the trees.', tone: 'green' },
  '4,2': { name: 'Far Slate', motif: 'Blue-black shelves rise beyond the easy return line.', omen: 'The beacon arrives here as a tremor rather than light.', discovery: 'The shelf gives a clear view of the storm front and nowhere to hide.', tone: 'blue' },
  '4,3': { name: 'Ashwake Verge', motif: 'Warm dust draws spirals around a buried machine.', omen: 'The machine moves only while unobserved.', discovery: 'Its wake records a route toward a signal outside this survey.', tone: 'red' },
});

export const GUEST_ENCOUNTERS = Object.freeze({
  'echo-fork': {
    id: 'echo-fork',
    title: 'The Echo Fork Answers Three Times',
    speaker: 'Signal Cartographer',
    prompt: 'Separate the true relic harmonic from two storm reflections.',
    choices: [
      { id: 'trace', label: 'Trace every echo', detail: 'Reveal the two northern approaches. Pressure +7.', pressure: 7, supplies: 0, reveal: ['0,1', '1,0'] },
      { id: 'mark', label: 'Mark only the sure route', detail: 'Preserve pressure and recover one supply.', pressure: 0, supplies: 1, reveal: ['0,1'] },
    ],
  },
  'wind-vault': {
    id: 'wind-vault',
    title: 'The Wind Vault Holds One Quiet Minute',
    speaker: 'Routekeeper',
    prompt: 'Spend the shelter reinforcing home, or listen deeper into the storm.',
    choices: [
      { id: 'anchor', label: 'Reinforce the return line', detail: 'Pressure -12. Spend one supply.', pressure: -12, supplies: -1, reveal: ['3,0'] },
      { id: 'listen', label: 'Open the listening chamber', detail: 'Reveal Tideglass. Pressure +9.', pressure: 9, supplies: 0, reveal: ['4,0'] },
    ],
  },
});

export const GUEST_CREW_ABILITIES = Object.freeze({
  trace: {
    id: 'trace',
    characterId: 'signal-cartographer',
    speaker: 'Signal Cartographer',
    label: 'Read the hidden routes',
    detail: 'Once per expedition: reveal every adjacent tile. Pressure +5.',
  },
  anchor: {
    id: 'anchor',
    characterId: 'routekeeper',
    speaker: 'Routekeeper',
    label: 'Anchor the way home',
    detail: 'Once per expedition: reduce pressure by 18. Spend one supply.',
  },
});

const TERRAIN_BY_ALIAS = new Map(GUEST_TERRAIN.map((cell) => [cell.alias, cell]));
const VALID_ALIASES = new Set(TERRAIN_BY_ALIAS.keys());

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function unique(values = []) {
  return [...new Set(Array.isArray(values) ? values.filter(Boolean).map(String) : [])];
}

function normalizeJournal(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => entry?.id && entry?.title).slice(-16).map((entry) => ({
    id: String(entry.id).slice(0, 100),
    title: String(entry.title).slice(0, 100),
    body: String(entry.body || '').slice(0, 280),
    tone: ['red', 'gold', 'green', 'blue', 'neutral'].includes(entry.tone) ? entry.tone : 'neutral',
  }));
}

function addJournalEntry(state, entry) {
  if (!entry?.id || state.journal.some((item) => item.id === entry.id)) return state.journal;
  return normalizeJournal([...state.journal, entry]);
}

function validAliasList(values, fallback = []) {
  if (!Array.isArray(values)) return [...fallback];
  return [...new Set(values.map(String).filter((alias) => VALID_ALIASES.has(alias)))];
}

function validRouteList(values, fallback = []) {
  if (!Array.isArray(values)) return [...fallback];
  return values.map(String).filter((alias) => VALID_ALIASES.has(alias)).slice(-32);
}

export function createGuestExpedition() {
  return {
    version: GUEST_EXPEDITION_VERSION,
    status: 'exploring',
    result: null,
    currentLocation: GUEST_LANDING_SITE,
    selectedAlias: '',
    revealedAliases: [GUEST_LANDING_SITE, '3,1', '3,2', '2,3', '1,2', '1,1', '2,1'],
    visitedAliases: [GUEST_LANDING_SITE],
    routeHistory: [GUEST_LANDING_SITE],
    collectedAliases: [],
    resolvedEncounters: [],
    usedAbilities: [],
    pendingEncounter: null,
    lastChoice: null,
    journal: [{
      id: 'arrival-beaconfall',
      title: 'Landfall at Beaconfall',
      body: 'The cyan beacon fixes one safe point inside a world that is already changing.',
      tone: 'blue',
    }],
    pressure: 10,
    supplies: 9,
    relics: 0,
    turns: 0,
    lastEvent: 'arrival',
    completedAt: null,
    message: 'The landing beacon is stable. Choose an adjacent route and reveal the world.',
  };
}

export function normalizeGuestExpedition(value) {
  const fallback = createGuestExpedition();
  if (!value || Number(value.version) !== GUEST_EXPEDITION_VERSION) return fallback;
  const currentLocation = VALID_ALIASES.has(String(value.currentLocation))
    ? String(value.currentLocation)
    : GUEST_LANDING_SITE;
  const status = value.status === 'complete' || value.status === 'redline' ? value.status : 'exploring';
  const resolvedEncounters = unique(value.resolvedEncounters).filter((id) => GUEST_ENCOUNTERS[id]);
  const pendingEncounter = GUEST_ENCOUNTERS[value.pendingEncounter] && !resolvedEncounters.includes(value.pendingEncounter)
    ? String(value.pendingEncounter)
    : null;
  return {
    ...fallback,
    version: GUEST_EXPEDITION_VERSION,
    status,
    result: value.result === 'safe' || value.result === 'emergency' ? value.result : null,
    currentLocation,
    selectedAlias: VALID_ALIASES.has(String(value.selectedAlias)) ? String(value.selectedAlias) : '',
    revealedAliases: validAliasList(value.revealedAliases, fallback.revealedAliases),
    visitedAliases: validAliasList(value.visitedAliases, fallback.visitedAliases),
    routeHistory: validRouteList(value.routeHistory, value.visitedAliases || fallback.routeHistory),
    collectedAliases: validAliasList(value.collectedAliases),
    resolvedEncounters,
    usedAbilities: unique(value.usedAbilities).filter((id) => GUEST_CREW_ABILITIES[id]),
    pendingEncounter,
    lastChoice: value.lastChoice?.encounterId && value.lastChoice?.choiceId ? {
      encounterId: String(value.lastChoice.encounterId),
      choiceId: String(value.lastChoice.choiceId),
    } : null,
    journal: normalizeJournal(value.journal?.length ? value.journal : fallback.journal),
    pressure: clamp(value.pressure, 0, 100),
    supplies: clamp(value.supplies, 0, 10),
    relics: Math.max(0, Number(value.relics) || 0),
    turns: Math.max(0, Number(value.turns) || 0),
    lastEvent: ['arrival', 'reveal', 'relic', 'danger', 'return', 'encounter', 'survey', 'anchor', 'safe-departure', 'emergency'].includes(value.lastEvent) ? value.lastEvent : fallback.lastEvent,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : null,
    message: typeof value.message === 'string' && value.message.trim() ? value.message : fallback.message,
  };
}

export function loadGuestExpedition(storage = globalThis?.localStorage) {
  try {
    const saved = storage?.getItem(GUEST_EXPEDITION_STORAGE_KEY);
    return saved ? normalizeGuestExpedition(JSON.parse(saved)) : createGuestExpedition();
  } catch {
    return createGuestExpedition();
  }
}

export function saveGuestExpedition(state, storage = globalThis?.localStorage) {
  try {
    storage?.setItem(GUEST_EXPEDITION_STORAGE_KEY, JSON.stringify(normalizeGuestExpedition(state)));
    return true;
  } catch {
    return false;
  }
}

export function clearGuestExpedition(storage = globalThis?.localStorage) {
  try {
    storage?.removeItem(GUEST_EXPEDITION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function guestLocationProfile(alias) {
  const key = String(alias || '');
  const terrain = TERRAIN_BY_ALIAS.get(key);
  const profile = GUEST_LOCATION_PROFILES[key];
  if (!terrain || !profile) return null;
  return Object.freeze({ alias: key, tileType: terrain.tileType, terrain: TILE_LABELS[terrain.tileType], ...profile });
}

export function guestPendingEncounter(state) {
  const normalized = normalizeGuestExpedition(state);
  return normalized.pendingEncounter ? GUEST_ENCOUNTERS[normalized.pendingEncounter] || null : null;
}

export function guestReachableAliases(state) {
  if (!state || state.status !== 'exploring') return [];
  if (state.pendingEncounter) return [];
  const current = parseAlias(state.currentLocation);
  if (!current) return [];
  return getAdjacent(current.col, current.row).filter((alias) => VALID_ALIASES.has(alias));
}

export function selectGuestTile(state, alias) {
  const normalized = normalizeGuestExpedition(state);
  const selectedAlias = String(alias || '');
  if (!guestReachableAliases(normalized).includes(selectedAlias)) return normalized;
  const profile = guestLocationProfile(selectedAlias);
  return {
    ...normalized,
    selectedAlias,
    message: `Route locked toward ${profile?.name || selectedAlias}. Commit when the crew is ready.`,
  };
}

export function guestRouteForecast(state, alias) {
  const normalized = normalizeGuestExpedition(state);
  const destination = TERRAIN_BY_ALIAS.get(String(alias || ''));
  if (!destination || !guestReachableAliases(normalized).includes(destination.alias)) return null;
  const firstVisit = !normalized.visitedAliases.includes(destination.alias);
  const relicWake = firstVisit && destination.tileType === Tile.RELIC ? RELIC_WAKE_PRESSURE : 0;
  const pressure = (TERRAIN_PRESSURE[destination.tileType] || 8) + relicWake;
  const projectedPressure = Math.min(100, normalized.pressure + pressure);
  const profile = guestLocationProfile(destination.alias);
  return Object.freeze({
    alias: destination.alias,
    name: profile?.name || destination.alias,
    terrain: profile?.terrain || TILE_LABELS[destination.tileType],
    pressure,
    projectedPressure,
    supplies: -1,
    firstVisit,
    encounter: firstVisit && profile?.encounterId && !normalized.resolvedEncounters.includes(profile.encounterId)
      ? GUEST_ENCOUNTERS[profile.encounterId]
      : null,
    warning: projectedPressure >= 100
      ? 'Emergency extraction likely'
      : projectedPressure >= 65
        ? 'Storm danger'
        : firstVisit
          ? profile?.omen
          : 'Known crossing',
  });
}

export function commitGuestMove(state) {
  const normalized = normalizeGuestExpedition(state);
  const destination = TERRAIN_BY_ALIAS.get(normalized.selectedAlias);
  if (!destination || !guestReachableAliases(normalized).includes(destination.alias)) return normalized;

  const firstVisit = !normalized.visitedAliases.includes(destination.alias);
  const foundRelic = firstVisit && destination.tileType === Tile.RELIC;
  const pressure = Math.min(100, normalized.pressure + (TERRAIN_PRESSURE[destination.tileType] || 8) + (foundRelic ? RELIC_WAKE_PRESSURE : 0));
  const supplies = Math.max(0, normalized.supplies - 1);
  const redline = (pressure >= 100 || supplies === 0) && destination.alias !== GUEST_LANDING_SITE;
  const terrain = TILE_LABELS[destination.tileType];
  const profile = guestLocationProfile(destination.alias);
  const pendingEncounter = !redline && firstVisit && profile?.encounterId && !normalized.resolvedEncounters.includes(profile.encounterId)
    ? profile.encounterId
    : null;
  const lastEvent = redline
    ? 'danger'
    : foundRelic
      ? 'relic'
      : pendingEncounter
        ? 'encounter'
        : destination.alias === GUEST_LANDING_SITE
          ? 'return'
          : pressure >= 65
            ? 'danger'
            : 'reveal';
  const journal = firstVisit && profile
    ? addJournalEntry(normalized, {
      id: `location-${destination.alias}`,
      title: profile.name,
      body: profile.discovery,
      tone: foundRelic ? 'gold' : profile.tone,
    })
    : normalized.journal;

  return {
    ...normalized,
    status: redline ? 'redline' : 'exploring',
    currentLocation: destination.alias,
    selectedAlias: '',
    revealedAliases: validAliasList([...normalized.revealedAliases, destination.alias]),
    visitedAliases: validAliasList([...normalized.visitedAliases, destination.alias]),
    routeHistory: validRouteList([...normalized.routeHistory, destination.alias]),
    collectedAliases: foundRelic
      ? validAliasList([...normalized.collectedAliases, destination.alias])
      : normalized.collectedAliases,
    pendingEncounter,
    journal,
    pressure,
    supplies,
    relics: normalized.relics + (foundRelic ? 1 : 0),
    turns: normalized.turns + 1,
    lastEvent,
    message: redline
      ? 'The route has crossed redline. Call emergency extraction before the storm closes.'
      : foundRelic
        ? `${profile?.name || 'The relic'} answered beneath the stone, and the storm answered with it. Decide whether to push farther or carry it home.`
        : pendingEncounter
          ? `${profile.name} demands a crew decision before the route can continue.`
        : destination.alias === GUEST_LANDING_SITE
          ? 'The landing beacon is underfoot. Depart now, or risk one more discovery.'
          : `${profile?.name || terrain} revealed. The way home is still open, but pressure is rising.`,
  };
}

export function resolveGuestEncounter(state, choiceId) {
  const normalized = normalizeGuestExpedition(state);
  const encounter = guestPendingEncounter(normalized);
  const choice = encounter?.choices.find((candidate) => candidate.id === String(choiceId || ''));
  if (!encounter || !choice || normalized.status !== 'exploring') return normalized;
  const pressure = clamp(normalized.pressure + choice.pressure, 0, 100);
  const supplies = clamp(normalized.supplies + choice.supplies, 0, 10);
  const redline = (pressure >= 100 || supplies === 0) && normalized.currentLocation !== GUEST_LANDING_SITE;
  const choiceBody = choice.id === 'trace'
    ? 'The Cartographer lets every echo finish. Two northern approaches become legible as the storm notices the signal.'
    : choice.id === 'mark'
      ? 'The Cartographer rejects the false harmonics and recovers an untouched field cache.'
      : choice.id === 'anchor'
        ? 'The Routekeeper spends a line and fixes the homeward signal against the next pressure wave.'
        : 'The listening chamber opens. Tideglass answers from beyond the eastern ridge.';
  return {
    ...normalized,
    status: redline ? 'redline' : 'exploring',
    pendingEncounter: null,
    resolvedEncounters: unique([...normalized.resolvedEncounters, encounter.id]),
    revealedAliases: validAliasList([...normalized.revealedAliases, ...choice.reveal]),
    pressure,
    supplies,
    lastChoice: { encounterId: encounter.id, choiceId: choice.id },
    lastEvent: redline ? 'danger' : choice.id === 'anchor' ? 'anchor' : 'survey',
    journal: addJournalEntry(normalized, {
      id: `encounter-${encounter.id}-${choice.id}`,
      title: `${encounter.title}: ${choice.label}`,
      body: choiceBody,
      tone: choice.pressure > 0 ? 'gold' : 'green',
    }),
    message: redline ? 'The choice pushed the route across redline. Call emergency extraction.' : choiceBody,
  };
}

export function canUseGuestCrewAbility(state, abilityId) {
  const normalized = normalizeGuestExpedition(state);
  if (!GUEST_CREW_ABILITIES[abilityId] || normalized.status !== 'exploring' || normalized.pendingEncounter) return false;
  if (normalized.usedAbilities.includes(abilityId)) return false;
  if (abilityId === 'anchor') return normalized.pressure >= 24 && normalized.supplies > 1;
  return normalized.turns > 0;
}

export function useGuestCrewAbility(state, abilityId) {
  const normalized = normalizeGuestExpedition(state);
  if (!canUseGuestCrewAbility(normalized, abilityId)) return normalized;
  if (abilityId === 'trace') {
    const current = parseAlias(normalized.currentLocation);
    const reveal = current ? getAdjacent(current.col, current.row).filter((alias) => VALID_ALIASES.has(alias)) : [];
    const pressure = clamp(normalized.pressure + 5, 0, 100);
    const redline = pressure >= 100 && normalized.currentLocation !== GUEST_LANDING_SITE;
    return {
      ...normalized,
      status: redline ? 'redline' : 'exploring',
      selectedAlias: '',
      revealedAliases: validAliasList([...normalized.revealedAliases, ...reveal]),
      usedAbilities: unique([...normalized.usedAbilities, abilityId]),
      pressure,
      lastEvent: redline ? 'danger' : 'survey',
      message: redline ? 'The survey signal crossed redline. Call emergency extraction.' : 'The Cartographer reads the hidden crossings. Nearby terrain resolves as the storm catches the signal.',
      journal: addJournalEntry(normalized, {
        id: `ability-trace-${normalized.turns}`,
        title: 'The Hidden Routes Answered',
        body: 'The Signal Cartographer traded five pressure for a complete reading of the adjacent world.',
        tone: 'blue',
      }),
    };
  }
  return {
    ...normalized,
    selectedAlias: '',
    usedAbilities: unique([...normalized.usedAbilities, abilityId]),
    pressure: clamp(normalized.pressure - 18, 0, 100),
    supplies: clamp(normalized.supplies - 1, 0, 10),
    lastEvent: 'anchor',
    message: 'The Routekeeper spends a field anchor. The way home brightens as pressure falls.',
    journal: addJournalEntry(normalized, {
      id: `ability-anchor-${normalized.turns}`,
      title: 'The Way Home Held',
      body: 'The Routekeeper spent one supply to pull eighteen pressure from the return line.',
      tone: 'green',
    }),
  };
}

export function canDepartGuestExpedition(state) {
  const normalized = normalizeGuestExpedition(state);
  return normalized.status === 'exploring'
    && !normalized.pendingEncounter
    && normalized.turns > 0
    && normalized.currentLocation === GUEST_LANDING_SITE;
}

export function departGuestExpedition(state, completedAt = new Date().toISOString()) {
  const normalized = normalizeGuestExpedition(state);
  if (!canDepartGuestExpedition(normalized)) return normalized;
  const message = normalized.relics > 0
    ? `Safe departure. The crew brought ${normalized.relics} relic${normalized.relics === 1 ? '' : 's'} home.`
    : 'Safe departure. The crew returned with a map that will make the next voyage stronger.';
  return {
    ...normalized,
    status: 'complete',
    result: 'safe',
    selectedAlias: '',
    lastEvent: 'safe-departure',
    completedAt,
    journal: addJournalEntry(normalized, {
      id: 'outcome-safe-departure',
      title: 'Departure Memory Secured',
      body: message,
      tone: 'gold',
    }),
    message,
  };
}

export function emergencyExtractGuestExpedition(state, completedAt = new Date().toISOString()) {
  const normalized = normalizeGuestExpedition(state);
  if (normalized.status !== 'redline') return normalized;
  const lostRelics = Math.min(1, normalized.relics);
  const message = lostRelics
    ? 'Emergency extraction succeeded, but the crew had to leave one relic behind.'
    : 'Emergency extraction succeeded. The crew is safe, but the route was lost.';
  return {
    ...normalized,
    status: 'complete',
    result: 'emergency',
    currentLocation: GUEST_LANDING_SITE,
    selectedAlias: '',
    relics: normalized.relics - lostRelics,
    lastEvent: 'emergency',
    completedAt,
    journal: addJournalEntry(normalized, {
      id: 'outcome-emergency-extraction',
      title: 'The Crew Beat the Storm Home',
      body: message,
      tone: 'green',
    }),
    message,
  };
}

export function guestDistanceToLanding(state) {
  const start = normalizeGuestExpedition(state).currentLocation;
  if (start === GUEST_LANDING_SITE) return 0;
  const queue = [[start, 0]];
  const visited = new Set([start]);
  while (queue.length) {
    const [alias, distance] = queue.shift();
    const coord = parseAlias(alias);
    if (!coord) continue;
    for (const neighbor of getAdjacent(coord.col, coord.row)) {
      if (!VALID_ALIASES.has(neighbor) || visited.has(neighbor)) continue;
      if (neighbor === GUEST_LANDING_SITE) return distance + 1;
      visited.add(neighbor);
      queue.push([neighbor, distance + 1]);
    }
  }
  return null;
}

function distanceBetween(start, targets) {
  if (targets.has(start)) return 0;
  const queue = [[start, 0]];
  const visited = new Set([start]);
  while (queue.length) {
    const [alias, distance] = queue.shift();
    const coord = parseAlias(alias);
    if (!coord) continue;
    for (const neighbor of getAdjacent(coord.col, coord.row)) {
      if (!VALID_ALIASES.has(neighbor) || visited.has(neighbor)) continue;
      if (targets.has(neighbor)) return distance + 1;
      visited.add(neighbor);
      queue.push([neighbor, distance + 1]);
    }
  }
  return Number.POSITIVE_INFINITY;
}

export function guestRouteRecommendation(state) {
  const normalized = normalizeGuestExpedition(state);
  if (normalized.status !== 'exploring' || canDepartGuestExpedition(normalized)) return null;
  const reachable = guestReachableAliases(normalized);
  if (!reachable.length) return null;
  const shouldReturn = normalized.relics > 0 || normalized.pressure >= 55 || normalized.supplies <= 3;
  const targets = shouldReturn
    ? new Set([GUEST_LANDING_SITE])
    : new Set(GUEST_TERRAIN.filter((cell) => cell.tileType === Tile.RELIC && !normalized.collectedAliases.includes(cell.alias)).map((cell) => cell.alias));
  const ranked = [...reachable].sort((left, right) => (
    distanceBetween(left, targets) - distanceBetween(right, targets) || left.localeCompare(right)
  ));
  const alias = ranked[0];
  return {
    alias,
    label: shouldReturn ? 'Safest route home' : 'Strongest signal',
    reason: shouldReturn
      ? `Protect ${normalized.relics ? `${normalized.relics} recovered relic${normalized.relics === 1 ? '' : 's'}` : 'the crew'} before pressure closes the route.`
      : 'This crossing leads toward the nearest relic signal while the return route is still forgiving.',
  };
}

export function guestEmotionalBeat(state) {
  const normalized = normalizeGuestExpedition(state);
  if (normalized.turns === 0 && normalized.status === 'exploring') return null;
  const currentProfile = guestLocationProfile(normalized.currentLocation);
  const common = {
    id: `guest-${normalized.lastEvent}-${normalized.turns}`,
    category: normalized.lastEvent,
    receipts: [
      { label: 'Pressure', value: `${normalized.pressure}%` },
      { label: 'Supplies', value: String(normalized.supplies) },
      { label: 'Relics', value: String(normalized.relics) },
    ],
  };
  const beats = {
    relic: {
      tone: 'gold',
      title: `${currentProfile?.name || 'The Relic'} Answered`,
      summary: normalized.message,
      whyItMatters: 'The objective has changed from finding value to bringing it home intact, and the awakened storm has made every extra crossing expensive.',
      nextPrompt: 'Follow the highlighted route back to the landing beacon, or wager the relic on one more reveal.',
    },
    danger: {
      tone: 'red',
      title: 'The Storm Found the Route',
      summary: 'Pressure crossed the safe band and every extra step now threatens the way home.',
      whyItMatters: 'The risk is specific: redline forces an emergency extraction and may cost a relic.',
      nextPrompt: 'Take the safest highlighted crossing toward the beacon.',
    },
    return: {
      tone: 'green',
      title: 'The Beacon Is Underfoot',
      summary: 'The route closed behind the crew, but the departure window is open now.',
      whyItMatters: 'Departing converts the route and every recovered relic into a completed expedition.',
      nextPrompt: 'Depart with the findings, or knowingly risk one final crossing.',
    },
    'safe-departure': {
      tone: 'gold',
      title: 'The Impossible Came Home',
      summary: normalized.message,
      whyItMatters: 'The expedition is now a complete memory: route, pressure, choice, and recovered value.',
      nextPrompt: 'Run a different route or carry this understanding into a live crew.',
    },
    emergency: {
      tone: 'green',
      title: 'The Crew Came Home Lighter',
      summary: normalized.message,
      whyItMatters: 'Recovery protected the explorers even when the route and some value were lost.',
      nextPrompt: 'Try again and turn back one decision earlier.',
    },
    reveal: {
      tone: 'blue',
      title: 'The Map Became Real',
      summary: normalized.message,
      whyItMatters: 'Every reveal changes both the opportunity ahead and the cost of returning.',
      nextPrompt: normalized.pressure >= 55 ? 'Start home while the route is still open.' : 'Follow the next signal or preserve an easier route home.',
    },
    encounter: {
      tone: 'gold',
      title: currentProfile?.name || 'The Route Demands an Answer',
      summary: normalized.message,
      whyItMatters: 'Travel is paused because this landmark changes what the crew can know or protect next.',
      nextPrompt: 'Choose the tradeoff that fits the route you intend to finish.',
    },
    survey: {
      tone: 'blue',
      title: 'The Hidden Route Became Legible',
      summary: normalized.message,
      whyItMatters: 'Information reduces uncertainty, but broadcasting a survey gives the storm more time to find the crew.',
      nextPrompt: 'Use the clearer map to choose value or preserve the way home.',
    },
    anchor: {
      tone: 'green',
      title: 'The Return Line Held',
      summary: normalized.message,
      whyItMatters: 'The crew converted a finite supply into more time and a safer extraction window.',
      nextPrompt: 'Spend that safety deliberately; the anchor cannot be used twice.',
    },
  };
  return beats[normalized.lastEvent] ? { ...common, ...beats[normalized.lastEvent] } : null;
}

export function guestCrewBark(state) {
  const normalized = normalizeGuestExpedition(state);
  const profile = guestLocationProfile(normalized.currentLocation);
  const encounter = guestPendingEncounter(normalized);
  const barks = {
    arrival: { speaker: 'Signal Cartographer', line: 'The nearest echo has a glass note. I can mark the crossing; you decide how much weather we owe it.' },
    reveal: { speaker: 'Signal Cartographer', line: normalized.pressure >= 55 ? `${profile?.name || 'This place'} is clear, but the return signal is thinning.` : `${profile?.name || 'New ground'} is on the map. The beacon still answers behind us.` },
    relic: { speaker: 'Routekeeper', line: `${profile?.name || 'The relic'} is ours to carry now. I can hold the homeward crossing, but not forever.` },
    danger: { speaker: 'Routekeeper', line: 'The storm is on the route now. Choose home before it chooses for us.' },
    return: { speaker: 'Signal Cartographer', line: 'Beacon underfoot. We can leave with a true map, or listen once more.' },
    encounter: { speaker: encounter?.speaker || 'Signal Cartographer', line: encounter?.prompt || 'The route needs an answer before we move.' },
    survey: { speaker: 'Signal Cartographer', line: 'There. The false notes are falling away. Use the map before the storm learns it too.' },
    anchor: { speaker: 'Routekeeper', line: 'The homeward line is holding. That bought us time, not permission to forget the cost.' },
    'safe-departure': { speaker: 'Routekeeper', line: 'Route closed. Promise kept. The Tideglass is coming home.' },
    emergency: { speaker: 'Routekeeper', line: 'Count people first. We can mourn the lost route after everyone is breathing.' },
  };
  return Object.freeze(barks[normalized.lastEvent] || barks.arrival);
}

export function guestExpeditionArc(state) {
  const normalized = normalizeGuestExpedition(state);
  const id = normalized.status === 'redline'
    ? EXPEDITION_ARC_IDS.FINAL_CALL
    : normalized.pressure >= 72
      ? EXPEDITION_ARC_IDS.REDLINE
      : normalized.relics > 0 && normalized.currentLocation === GUEST_LANDING_SITE
        ? EXPEDITION_ARC_IDS.DEPARTURE_WINDOW
        : normalized.relics > 0
          ? EXPEDITION_ARC_IDS.GREED_WINDOW
          : EXPEDITION_ARC_IDS.SURVEY;
  const definition = ARC_DEFINITIONS[id];
  return Object.freeze({
    ...definition,
    progress: Object.freeze({
      chartProgress: Math.min(100, Math.round((normalized.revealedAliases.length / GUEST_TERRAIN.length) * 100)),
      valueProgress: Math.min(100, normalized.relics * 50),
      routeProgress: Math.max(0, 100 - (guestDistanceToLanding(normalized) || 0) * 24),
      crewProgress: Math.max(0, 100 - normalized.pressure),
    }),
  });
}

export function guestOutcome(state) {
  const normalized = normalizeGuestExpedition(state);
  if (normalized.status !== 'complete') return null;
  const safe = normalized.result === 'safe';
  const score = Math.max(0, Math.round(
    (safe ? 520 : 180)
    + normalized.relics * 180
    + normalized.revealedAliases.length * 12
    + normalized.resolvedEncounters.length * 45
    + normalized.usedAbilities.length * 20
    + Math.max(0, 100 - normalized.pressure) * 2
    - normalized.turns * 8,
  ));
  const grade = score >= 900 ? 'S' : score >= 760 ? 'A' : score >= 620 ? 'B' : score >= 480 ? 'C' : 'D';
  return Object.freeze({
    score,
    grade,
    title: safe ? (normalized.relics ? 'Relic Homecoming' : 'Cartographer\'s Return') : 'Stormline Rescue',
    summary: safe
      ? `${normalized.relics} relic${normalized.relics === 1 ? '' : 's'} and ${normalized.revealedAliases.length} mapped locations survived the route.`
      : `The crew survived after ${normalized.turns} crossings; the lost value now marks the next run's turning point.`,
  });
}

export function guestBoardInput(state, { isResolving = false } = {}) {
  const normalized = normalizeGuestExpedition(state);
  const revealed = new Set(normalized.revealedAliases);
  const reachableAliases = guestReachableAliases(normalized);
  const selectedPath = normalized.selectedAlias
    ? [normalized.currentLocation, normalized.selectedAlias]
    : [];
  const phase = normalized.status === 'complete'
    ? 'complete'
    : isResolving
      ? 'resolving'
      : normalized.status === 'redline' || normalized.pressure >= 65
        ? 'danger'
        : 'planning';
  const arc = guestExpeditionArc(normalized);
  const currentProfile = guestLocationProfile(normalized.currentLocation);
  const routekeeperLeads = ['anchor', 'danger', 'relic', 'return', 'safe-departure', 'emergency'].includes(normalized.lastEvent);
  const activeAction = normalized.status === 'complete'
    ? Action.FLEE
    : normalized.lastEvent === 'anchor'
      ? Action.REST
      : normalized.lastEvent === 'survey'
        ? Action.DIG
        : normalized.pendingEncounter
          ? Action.HELP
          : Action.MOVE;

  return {
    source: {
      kind: 'guest',
      scenarioId: 'living-survey',
      turn: normalized.turns,
      chapter: arc.id,
      weather: normalized.pressure >= 72 ? 'redline-storm' : normalized.pressure >= 45 ? 'rising-static' : 'glass-mist',
      intensity: normalized.pressure,
      locationName: currentProfile?.name || 'Living Survey',
    },
    cells: GUEST_TERRAIN.map((cell) => ({
      ...cell,
      revealed: revealed.has(cell.alias),
      hasCampsite: false,
    })),
    currentLocation: normalized.currentLocation,
    intentAlias: normalized.selectedAlias || normalized.currentLocation,
    encounterId: normalized.pendingEncounter || '',
    selectedPath,
    previewPath: selectedPath,
    reachableAliases,
    landingSite: GUEST_LANDING_SITE,
    playerLocationMap: { [normalized.currentLocation]: [0, 1] },
    crew: [
      { playerID: 1, name: 'Signal Cartographer', characterId: 'signal-cartographer', roleId: 'scout', currentZone: normalized.currentLocation, isActive: true, isStrained: normalized.pressure >= 72, hasUsedAbility: normalized.usedAbilities.includes('trace') },
      { playerID: 2, name: 'Routekeeper', characterId: 'routekeeper', roleId: 'guard', currentZone: normalized.currentLocation, isActive: true, isStrained: normalized.pressure >= 55, hasArtifact: normalized.relics > 0, hasUsedAbility: normalized.usedAbilities.includes('anchor') },
    ],
    currentPlayerIndex: routekeeperLeads ? 1 : 0,
    activeAction,
    isResolving,
    isDanger: phase === 'danger',
    isComplete: phase === 'complete',
    lowStats: normalized.supplies <= 2 || normalized.pressure >= 72,
    phase,
  };
}

export function guestTerrainLabel(alias, state) {
  const normalized = normalizeGuestExpedition(state);
  if (!normalized.revealedAliases.includes(String(alias))) return 'Uncharted';
  return TILE_LABELS[TERRAIN_BY_ALIAS.get(String(alias))?.tileType] || 'Unknown';
}
