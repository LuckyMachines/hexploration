import { Action, Tile, TILE_LABELS } from './constants.js';
import { getAdjacent, parseAlias } from './hexmath.js';
import { routeDistance } from './departPressure.js';

export const TILE_TRAIT_IDS = {
  SIGNAL: 'signal',
  UNSTABLE_GROUND: 'unstable-ground',
  CACHE: 'cache',
  SHELTER: 'shelter',
  HIGH_GROUND: 'high-ground',
  OLD_TRAIL: 'old-trail',
  ECHO_FIELD: 'echo-field',
  RELIC_VEIN: 'relic-vein',
  UNKNOWN: 'unknown-signal',
};

export const TRAIT_DEFINITIONS = {
  [TILE_TRAIT_IDS.SIGNAL]: {
    id: TILE_TRAIT_IDS.SIGNAL,
    glyph: 'S',
    label: 'Signal',
    category: 'route',
    tone: 'blue',
    summary: 'A signal thread makes the route home easier to read.',
    effect: 'Can lower Depart Pressure when used as part of the route home.',
    trigger: 'flee-route',
    preferredAction: Action.MOVE,
    pressureDelta: -8,
    costDelta: -4,
    routeDelta: 10,
    revealDelta: 0,
    valueDelta: 0,
    teamDelta: 0,
  },
  [TILE_TRAIT_IDS.UNSTABLE_GROUND]: {
    id: TILE_TRAIT_IDS.UNSTABLE_GROUND,
    glyph: '!',
    label: 'Unstable Ground',
    category: 'risk',
    tone: 'red',
    summary: 'Bad footing turns greedy actions into escape cost.',
    effect: 'May raise pressure if the crew digs or ends a route here.',
    trigger: 'enter',
    preferredAction: Action.MOVE,
    pressureDelta: 10,
    costDelta: 8,
    routeDelta: -8,
    revealDelta: 0,
    valueDelta: 0,
    teamDelta: -2,
  },
  [TILE_TRAIT_IDS.CACHE]: {
    id: TILE_TRAIT_IDS.CACHE,
    glyph: 'C',
    label: 'Cache',
    category: 'value',
    tone: 'green',
    summary: 'A hidden cache can secure value without another greedy push.',
    effect: 'Can reduce artifact-risk forecasts or make Dig feel productive.',
    trigger: 'dig',
    preferredAction: Action.DIG,
    pressureDelta: -4,
    costDelta: -8,
    routeDelta: 0,
    revealDelta: 0,
    valueDelta: 10,
    teamDelta: 0,
  },
  [TILE_TRAIT_IDS.SHELTER]: {
    id: TILE_TRAIT_IDS.SHELTER,
    glyph: 'H',
    label: 'Shelter',
    category: 'recovery',
    tone: 'green',
    summary: 'Cover makes recovery feel placed, not passive.',
    effect: 'Rest here can reduce crew-risk pressure.',
    trigger: 'rest',
    preferredAction: Action.REST,
    pressureDelta: -6,
    costDelta: -5,
    routeDelta: 0,
    revealDelta: 0,
    valueDelta: 0,
    teamDelta: 8,
  },
  [TILE_TRAIT_IDS.HIGH_GROUND]: {
    id: TILE_TRAIT_IDS.HIGH_GROUND,
    glyph: 'V',
    label: 'High Ground',
    category: 'reveal',
    tone: 'blue',
    summary: 'A vantage point makes nearby fog feel answerable.',
    effect: 'Moving here can improve scouting and adjacent reveal previews.',
    trigger: 'reveal',
    preferredAction: Action.MOVE,
    pressureDelta: -2,
    costDelta: 0,
    routeDelta: 2,
    revealDelta: 10,
    valueDelta: 0,
    teamDelta: 0,
  },
  [TILE_TRAIT_IDS.OLD_TRAIL]: {
    id: TILE_TRAIT_IDS.OLD_TRAIL,
    glyph: 'T',
    label: 'Old Trail',
    category: 'route',
    tone: 'gold',
    summary: 'Someone already found a way through.',
    effect: 'Moving toward landing through this tile can reduce route pressure.',
    trigger: 'enter',
    preferredAction: Action.MOVE,
    pressureDelta: -7,
    costDelta: -3,
    routeDelta: 9,
    revealDelta: 0,
    valueDelta: 0,
    teamDelta: 0,
  },
  [TILE_TRAIT_IDS.ECHO_FIELD]: {
    id: TILE_TRAIT_IDS.ECHO_FIELD,
    glyph: 'E',
    label: 'Echo Field',
    category: 'team',
    tone: 'blue',
    summary: 'Signals carry farther here.',
    effect: 'Help can reduce crew-risk pressure from this position.',
    trigger: 'help',
    preferredAction: Action.HELP,
    pressureDelta: -4,
    costDelta: -5,
    routeDelta: 0,
    revealDelta: 0,
    valueDelta: 0,
    teamDelta: 10,
  },
  [TILE_TRAIT_IDS.RELIC_VEIN]: {
    id: TILE_TRAIT_IDS.RELIC_VEIN,
    glyph: 'R',
    label: 'Relic Vein',
    category: 'value',
    tone: 'orange',
    summary: 'The ground is rich and hungry.',
    effect: 'Dig payoff looks stronger, but pressure can spike hard.',
    trigger: 'dig',
    preferredAction: Action.DIG,
    pressureDelta: 12,
    costDelta: 8,
    routeDelta: -3,
    revealDelta: 0,
    valueDelta: 14,
    teamDelta: 0,
  },
  [TILE_TRAIT_IDS.UNKNOWN]: {
    id: TILE_TRAIT_IDS.UNKNOWN,
    glyph: '?',
    label: 'Unknown Signal',
    category: 'reveal',
    tone: 'neutral',
    summary: 'Fog hides the tile trait until the board is charted.',
    effect: 'Move or reveal the tile to learn what it changes.',
    trigger: 'reveal',
    preferredAction: Action.MOVE,
    pressureDelta: 0,
    costDelta: 0,
    routeDelta: 0,
    revealDelta: 4,
    valueDelta: 0,
    teamDelta: 0,
  },
};

function stableHash(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function weightedPick(candidates = [], seed = '') {
  const total = candidates.reduce((sum, item) => sum + Math.max(1, item.weight || 1), 0);
  let roll = stableHash(seed) % Math.max(1, total);
  for (const item of candidates) {
    roll -= Math.max(1, item.weight || 1);
    if (roll < 0) return item.id;
  }
  return candidates[0]?.id || TILE_TRAIT_IDS.UNKNOWN;
}

function addWeight(weights, id, amount) {
  weights[id] = Math.max(1, (weights[id] || 1) + amount);
}

function baseWeightsForTile(tileType) {
  const weights = {
    [TILE_TRAIT_IDS.SIGNAL]: 2,
    [TILE_TRAIT_IDS.UNSTABLE_GROUND]: 2,
    [TILE_TRAIT_IDS.CACHE]: 2,
    [TILE_TRAIT_IDS.SHELTER]: 2,
    [TILE_TRAIT_IDS.HIGH_GROUND]: 2,
    [TILE_TRAIT_IDS.OLD_TRAIL]: 2,
    [TILE_TRAIT_IDS.ECHO_FIELD]: 2,
    [TILE_TRAIT_IDS.RELIC_VEIN]: 2,
  };

  if (tileType === Tile.LANDING) {
    addWeight(weights, TILE_TRAIT_IDS.SIGNAL, 9);
    addWeight(weights, TILE_TRAIT_IDS.OLD_TRAIL, 6);
    addWeight(weights, TILE_TRAIT_IDS.CACHE, 4);
  } else if (tileType === Tile.RELIC) {
    addWeight(weights, TILE_TRAIT_IDS.RELIC_VEIN, 9);
    addWeight(weights, TILE_TRAIT_IDS.UNSTABLE_GROUND, 5);
    addWeight(weights, TILE_TRAIT_IDS.ECHO_FIELD, 3);
  } else if (tileType === Tile.MOUNTAIN) {
    addWeight(weights, TILE_TRAIT_IDS.HIGH_GROUND, 8);
    addWeight(weights, TILE_TRAIT_IDS.SIGNAL, 4);
    addWeight(weights, TILE_TRAIT_IDS.UNSTABLE_GROUND, 4);
  } else if (tileType === Tile.JUNGLE) {
    addWeight(weights, TILE_TRAIT_IDS.SHELTER, 7);
    addWeight(weights, TILE_TRAIT_IDS.ECHO_FIELD, 5);
    addWeight(weights, TILE_TRAIT_IDS.CACHE, 3);
  } else if (tileType === Tile.DESERT) {
    addWeight(weights, TILE_TRAIT_IDS.OLD_TRAIL, 7);
    addWeight(weights, TILE_TRAIT_IDS.UNSTABLE_GROUND, 5);
    addWeight(weights, TILE_TRAIT_IDS.SIGNAL, 3);
  } else if (tileType === Tile.PLAINS) {
    addWeight(weights, TILE_TRAIT_IDS.OLD_TRAIL, 6);
    addWeight(weights, TILE_TRAIT_IDS.CACHE, 4);
    addWeight(weights, TILE_TRAIT_IDS.SHELTER, 4);
  }

  return weights;
}

export function traitForTile({
  gameId = '',
  zoneAlias = '',
  tileType = Tile.NONE,
  landingSite = '',
  currentLocation = '',
  departPressure = null,
  revealed = true,
} = {}) {
  if (!revealed || tileType === Tile.NONE) {
    return {
      ...TRAIT_DEFINITIONS[TILE_TRAIT_IDS.UNKNOWN],
      tileType,
      tileLabel: TILE_LABELS[tileType] || 'Unknown',
      zoneAlias,
      distanceToLanding: routeDistance(zoneAlias, landingSite),
      isKnown: false,
    };
  }

  const weights = baseWeightsForTile(tileType);
  const distanceToLanding = routeDistance(zoneAlias, landingSite);
  const currentDistance = routeDistance(currentLocation, landingSite);
  const pressure = Number(departPressure?.pressure || 0);

  if (distanceToLanding !== null) {
    if (distanceToLanding <= 1) {
      addWeight(weights, TILE_TRAIT_IDS.SIGNAL, 4);
      addWeight(weights, TILE_TRAIT_IDS.SHELTER, 3);
      addWeight(weights, TILE_TRAIT_IDS.OLD_TRAIL, 3);
    } else if (distanceToLanding <= 3) {
      addWeight(weights, TILE_TRAIT_IDS.HIGH_GROUND, 3);
      addWeight(weights, TILE_TRAIT_IDS.CACHE, 3);
      addWeight(weights, TILE_TRAIT_IDS.ECHO_FIELD, 2);
    } else {
      addWeight(weights, TILE_TRAIT_IDS.UNSTABLE_GROUND, 4);
      addWeight(weights, TILE_TRAIT_IDS.RELIC_VEIN, 4);
      addWeight(weights, TILE_TRAIT_IDS.CACHE, 2);
    }
  }

  if (pressure >= 70) {
    addWeight(weights, TILE_TRAIT_IDS.SIGNAL, 5);
    addWeight(weights, TILE_TRAIT_IDS.OLD_TRAIL, 5);
    addWeight(weights, TILE_TRAIT_IDS.SHELTER, 4);
    addWeight(weights, TILE_TRAIT_IDS.ECHO_FIELD, 3);
  } else if (pressure <= 30) {
    addWeight(weights, TILE_TRAIT_IDS.RELIC_VEIN, 4);
    addWeight(weights, TILE_TRAIT_IDS.HIGH_GROUND, 3);
    addWeight(weights, TILE_TRAIT_IDS.CACHE, 3);
  }

  if (currentDistance !== null && distanceToLanding !== null && distanceToLanding < currentDistance) {
    addWeight(weights, TILE_TRAIT_IDS.OLD_TRAIL, 3);
    addWeight(weights, TILE_TRAIT_IDS.SIGNAL, 2);
  }

  const traitId = weightedPick(
    Object.entries(weights).map(([id, weight]) => ({ id, weight })),
    `${gameId}|${zoneAlias}|${tileType}|${landingSite}|${pressure}`,
  );
  return {
    ...TRAIT_DEFINITIONS[traitId],
    tileType,
    tileLabel: TILE_LABELS[tileType] || 'Unknown',
    zoneAlias,
    distanceToLanding,
    isKnown: true,
  };
}

export function traitsForBoard({
  gameId = '',
  revealedMap = {},
  landingSite = '',
  currentLocation = '',
  departPressure = null,
} = {}) {
  return Object.fromEntries(Object.entries(revealedMap).map(([zoneAlias, tile]) => [
    zoneAlias,
    traitForTile({
      gameId,
      zoneAlias,
      tileType: tile?.tileType ?? Tile.NONE,
      landingSite,
      currentLocation,
      departPressure,
      revealed: true,
    }),
  ]));
}

export function traitEffectsForAction(trait = null, action = Action.MOVE, { movingTowardLanding = false } = {}) {
  if (!trait) return null;
  const preferred = trait.preferredAction === action;
  const riskyDig = action === Action.DIG && [TILE_TRAIT_IDS.UNSTABLE_GROUND, TILE_TRAIT_IDS.RELIC_VEIN].includes(trait.id);
  const routeRelief = action === Action.MOVE && movingTowardLanding && [TILE_TRAIT_IDS.SIGNAL, TILE_TRAIT_IDS.OLD_TRAIL].includes(trait.id);
  const restRelief = action === Action.REST && trait.id === TILE_TRAIT_IDS.SHELTER;
  const helpRelief = action === Action.HELP && trait.id === TILE_TRAIT_IDS.ECHO_FIELD;
  const cacheRelief = [Action.DIG, Action.FLEE].includes(action) && trait.id === TILE_TRAIT_IDS.CACHE;
  const matched = preferred || routeRelief || restRelief || helpRelief || cacheRelief;
  const warning = riskyDig || (action === Action.MOVE && trait.id === TILE_TRAIT_IDS.UNSTABLE_GROUND);

  return {
    traitId: trait.id,
    label: trait.label,
    matched,
    warning,
    pressureDelta: matched ? Math.min(0, trait.pressureDelta) : warning ? Math.max(4, trait.pressureDelta) : trait.pressureDelta,
    costDelta: matched ? Math.min(0, trait.costDelta) : warning ? Math.max(3, trait.costDelta) : trait.costDelta,
    routeDelta: trait.routeDelta,
    revealDelta: trait.revealDelta,
    valueDelta: trait.valueDelta,
    teamDelta: trait.teamDelta,
    effect: matched ? matchedTraitCopy(trait, action) : warning ? warningTraitCopy(trait, action) : trait.effect,
  };
}

function matchedTraitCopy(trait, action) {
  if (trait.id === TILE_TRAIT_IDS.SIGNAL) return 'Signal helps reduce route pressure when the crew moves or departs through it.';
  if (trait.id === TILE_TRAIT_IDS.OLD_TRAIL) return 'Old Trail helps the route home feel cheaper and safer.';
  if (trait.id === TILE_TRAIT_IDS.CACHE) return 'Cache can secure value without turning greed into a bigger cost.';
  if (trait.id === TILE_TRAIT_IDS.SHELTER) return 'Shelter makes Rest a real reduction action.';
  if (trait.id === TILE_TRAIT_IDS.ECHO_FIELD) return 'Echo Field makes Help carry farther into crew-risk.';
  if (trait.id === TILE_TRAIT_IDS.HIGH_GROUND) return 'High Ground makes this move a scouting beat.';
  if (trait.id === TILE_TRAIT_IDS.RELIC_VEIN && action === Action.DIG) return 'Relic Vein increases payoff, but the pressure spike is real.';
  return trait.effect;
}

function warningTraitCopy(trait, action) {
  if (trait.id === TILE_TRAIT_IDS.UNSTABLE_GROUND) return 'Unstable Ground may turn this choice into higher escape cost.';
  if (trait.id === TILE_TRAIT_IDS.RELIC_VEIN && action === Action.DIG) return 'Relic Vein is rich, but digging here may spike pressure.';
  return trait.effect;
}

export function traitPreviewForIntent({
  trait = null,
  activeAction = Action.MOVE,
  currentLocation = '',
  landingSite = '',
  intentAlias = '',
} = {}) {
  if (!trait) return null;
  const currentDistance = routeDistance(currentLocation, landingSite);
  const intentDistance = routeDistance(intentAlias || trait.zoneAlias, landingSite);
  const movingTowardLanding = currentDistance !== null && intentDistance !== null && intentDistance < currentDistance;
  const effect = traitEffectsForAction(trait, activeAction, { movingTowardLanding });
  const preferred = actionLabel(trait.preferredAction);
  return {
    trait,
    effect,
    title: trait.label,
    body: effect?.effect || trait.effect,
    preferredActionLabel: preferred,
    warning: effect?.warning ? effect.effect : '',
    routeNote: routeNoteForTrait(trait, effect),
  };
}

function actionLabel(action) {
  return {
    [Action.MOVE]: 'Move',
    [Action.DIG]: 'Dig',
    [Action.REST]: 'Rest',
    [Action.HELP]: 'Help',
    [Action.FLEE]: 'Flee',
  }[action] || 'Move';
}

function routeNoteForTrait(trait, effect) {
  if (!trait) return '';
  if (trait.id === TILE_TRAIT_IDS.OLD_TRAIL) return 'Route note: Old Trail can help reduce pressure toward landing.';
  if (trait.id === TILE_TRAIT_IDS.SIGNAL) return 'Route note: Signal can improve route stability.';
  if (trait.id === TILE_TRAIT_IDS.UNSTABLE_GROUND) return 'Route warning: Unstable Ground can raise escape cost.';
  if (effect?.matched) return `Trait match: ${effect.effect}`;
  return trait.summary;
}

export function traitToneClass(trait = {}) {
  return {
    green: 'border-oxide-green/35 bg-oxide-green/5 text-oxide-green',
    gold: 'border-compass/35 bg-compass/5 text-compass-bright',
    orange: 'border-desert/40 bg-desert/10 text-desert',
    red: 'border-signal-red/40 bg-signal-red/10 text-signal-red',
    blue: 'border-blueprint/35 bg-blueprint/5 text-blueprint',
    neutral: 'border-exp-border bg-exp-dark/35 text-exp-text-dim',
  }[trait.tone] || 'border-exp-border bg-exp-dark/35 text-exp-text-dim';
}

export function adjacentFogCount(alias = '', revealedAliases = []) {
  const coord = parseAlias(alias);
  if (!coord) return 0;
  const revealed = new Set(revealedAliases);
  return getAdjacent(coord.col, coord.row).filter((neighbor) => !revealed.has(neighbor)).length;
}
