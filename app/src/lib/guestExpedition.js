import { Action, Tile, TILE_LABELS } from './constants';
import { getAdjacent, parseAlias } from './hexmath';

export const GUEST_EXPEDITION_STORAGE_KEY = 'xenovoya:guest-expedition:v1';
export const GUEST_LANDING_SITE = '2,2';

const TERRAIN_PRESSURE = Object.freeze({
  [Tile.LANDING]: 2,
  [Tile.PLAINS]: 5,
  [Tile.JUNGLE]: 8,
  [Tile.DESERT]: 12,
  [Tile.MOUNTAIN]: 15,
  [Tile.RELIC]: 10,
});

export const GUEST_TERRAIN = Object.freeze([
  { alias: '0,0', tileType: Tile.MOUNTAIN },
  { alias: '0,1', tileType: Tile.PLAINS },
  { alias: '0,2', tileType: Tile.JUNGLE },
  { alias: '0,3', tileType: Tile.DESERT },
  { alias: '1,0', tileType: Tile.JUNGLE },
  { alias: '1,1', tileType: Tile.RELIC },
  { alias: '1,2', tileType: Tile.PLAINS },
  { alias: '1,3', tileType: Tile.MOUNTAIN },
  { alias: '2,0', tileType: Tile.DESERT },
  { alias: '2,1', tileType: Tile.JUNGLE },
  { alias: GUEST_LANDING_SITE, tileType: Tile.LANDING },
  { alias: '2,3', tileType: Tile.PLAINS },
  { alias: '3,0', tileType: Tile.MOUNTAIN },
  { alias: '3,1', tileType: Tile.PLAINS },
  { alias: '3,2', tileType: Tile.RELIC },
  { alias: '3,3', tileType: Tile.JUNGLE },
  { alias: '4,0', tileType: Tile.DESERT },
  { alias: '4,1', tileType: Tile.JUNGLE },
  { alias: '4,2', tileType: Tile.MOUNTAIN },
  { alias: '4,3', tileType: Tile.DESERT },
]);

const TERRAIN_BY_ALIAS = new Map(GUEST_TERRAIN.map((cell) => [cell.alias, cell]));
const VALID_ALIASES = new Set(TERRAIN_BY_ALIAS.keys());

function validAliasList(values, fallback = []) {
  if (!Array.isArray(values)) return [...fallback];
  return [...new Set(values.map(String).filter((alias) => VALID_ALIASES.has(alias)))];
}

export function createGuestExpedition() {
  return {
    version: 1,
    status: 'exploring',
    result: null,
    currentLocation: GUEST_LANDING_SITE,
    selectedAlias: '',
    revealedAliases: [GUEST_LANDING_SITE, '1,2', '2,1'],
    visitedAliases: [GUEST_LANDING_SITE],
    collectedAliases: [],
    pressure: 10,
    supplies: 8,
    relics: 0,
    turns: 0,
    message: 'The landing beacon is stable. Choose an adjacent route and reveal the world.',
  };
}

export function normalizeGuestExpedition(value) {
  const fallback = createGuestExpedition();
  if (!value || Number(value.version) !== 1) return fallback;
  const currentLocation = VALID_ALIASES.has(String(value.currentLocation))
    ? String(value.currentLocation)
    : GUEST_LANDING_SITE;
  const status = value.status === 'complete' || value.status === 'redline' ? value.status : 'exploring';
  return {
    ...fallback,
    status,
    result: value.result === 'safe' || value.result === 'emergency' ? value.result : null,
    currentLocation,
    selectedAlias: VALID_ALIASES.has(String(value.selectedAlias)) ? String(value.selectedAlias) : '',
    revealedAliases: validAliasList(value.revealedAliases, fallback.revealedAliases),
    visitedAliases: validAliasList(value.visitedAliases, fallback.visitedAliases),
    collectedAliases: validAliasList(value.collectedAliases),
    pressure: Math.min(100, Math.max(0, Number(value.pressure) || 0)),
    supplies: Math.min(8, Math.max(0, Number(value.supplies) || 0)),
    relics: Math.max(0, Number(value.relics) || 0),
    turns: Math.max(0, Number(value.turns) || 0),
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

export function guestReachableAliases(state) {
  if (!state || state.status !== 'exploring') return [];
  const current = parseAlias(state.currentLocation);
  if (!current) return [];
  return getAdjacent(current.col, current.row).filter((alias) => VALID_ALIASES.has(alias));
}

export function selectGuestTile(state, alias) {
  const normalized = normalizeGuestExpedition(state);
  const selectedAlias = String(alias || '');
  if (!guestReachableAliases(normalized).includes(selectedAlias)) return normalized;
  return {
    ...normalized,
    selectedAlias,
    message: `Route locked toward ${selectedAlias}. Commit when the crew is ready.`,
  };
}

export function commitGuestMove(state) {
  const normalized = normalizeGuestExpedition(state);
  const destination = TERRAIN_BY_ALIAS.get(normalized.selectedAlias);
  if (!destination || !guestReachableAliases(normalized).includes(destination.alias)) return normalized;

  const firstVisit = !normalized.visitedAliases.includes(destination.alias);
  const foundRelic = firstVisit && destination.tileType === Tile.RELIC;
  const pressure = Math.min(100, normalized.pressure + (TERRAIN_PRESSURE[destination.tileType] || 8));
  const supplies = Math.max(0, normalized.supplies - 1);
  const redline = (pressure >= 100 || supplies === 0) && destination.alias !== GUEST_LANDING_SITE;
  const terrain = TILE_LABELS[destination.tileType];

  return {
    ...normalized,
    status: redline ? 'redline' : 'exploring',
    currentLocation: destination.alias,
    selectedAlias: '',
    revealedAliases: validAliasList([...normalized.revealedAliases, destination.alias]),
    visitedAliases: validAliasList([...normalized.visitedAliases, destination.alias]),
    collectedAliases: foundRelic
      ? validAliasList([...normalized.collectedAliases, destination.alias])
      : normalized.collectedAliases,
    pressure,
    supplies,
    relics: normalized.relics + (foundRelic ? 1 : 0),
    turns: normalized.turns + 1,
    message: redline
      ? 'The route has crossed redline. Call emergency extraction before the storm closes.'
      : foundRelic
        ? `A relic answered beneath the ${terrain.toLowerCase()}. Decide whether to push farther or carry it home.`
        : destination.alias === GUEST_LANDING_SITE
          ? 'The landing beacon is underfoot. Depart now, or risk one more discovery.'
          : `${terrain} revealed. The way home is still open, but pressure is rising.`,
  };
}

export function canDepartGuestExpedition(state) {
  const normalized = normalizeGuestExpedition(state);
  return normalized.status === 'exploring'
    && normalized.turns > 0
    && normalized.currentLocation === GUEST_LANDING_SITE;
}

export function departGuestExpedition(state) {
  const normalized = normalizeGuestExpedition(state);
  if (!canDepartGuestExpedition(normalized)) return normalized;
  return {
    ...normalized,
    status: 'complete',
    result: 'safe',
    selectedAlias: '',
    message: normalized.relics > 0
      ? `Safe departure. The crew brought ${normalized.relics} relic${normalized.relics === 1 ? '' : 's'} home.`
      : 'Safe departure. The crew returned with a map that will make the next voyage stronger.',
  };
}

export function emergencyExtractGuestExpedition(state) {
  const normalized = normalizeGuestExpedition(state);
  if (normalized.status !== 'redline') return normalized;
  const lostRelics = Math.min(1, normalized.relics);
  return {
    ...normalized,
    status: 'complete',
    result: 'emergency',
    currentLocation: GUEST_LANDING_SITE,
    selectedAlias: '',
    relics: normalized.relics - lostRelics,
    message: lostRelics
      ? 'Emergency extraction succeeded, but the crew had to leave one relic behind.'
      : 'Emergency extraction succeeded. The crew is safe, but the route was lost.',
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

  return {
    source: { kind: 'guest', scenarioId: 'living-survey', turn: normalized.turns },
    cells: GUEST_TERRAIN.map((cell) => ({
      ...cell,
      revealed: revealed.has(cell.alias),
      hasCampsite: false,
    })),
    currentLocation: normalized.currentLocation,
    intentAlias: normalized.selectedAlias || normalized.currentLocation,
    selectedPath,
    previewPath: selectedPath,
    reachableAliases,
    landingSite: GUEST_LANDING_SITE,
    playerLocationMap: { [normalized.currentLocation]: [0, 1] },
    crew: [
      { playerID: 1, name: 'Signal Cartographer', characterId: 'signal-cartographer', roleId: 'scout', currentZone: normalized.currentLocation, isActive: true },
      { playerID: 2, name: 'Routekeeper', characterId: 'routekeeper', roleId: 'guard', currentZone: normalized.currentLocation, isActive: true },
    ],
    currentPlayerIndex: 0,
    activeAction: normalized.status === 'complete' ? Action.FLEE : Action.MOVE,
    isResolving,
    isDanger: phase === 'danger',
    isComplete: phase === 'complete',
    lowStats: normalized.supplies <= 2,
    phase,
  };
}

export function guestTerrainLabel(alias, state) {
  const normalized = normalizeGuestExpedition(state);
  if (!normalized.revealedAliases.includes(String(alias))) return 'Uncharted';
  return TILE_LABELS[TERRAIN_BY_ALIAS.get(String(alias))?.tileType] || 'Unknown';
}
