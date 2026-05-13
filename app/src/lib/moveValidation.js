import { getAdjacent, parseAlias } from './hexmath';

export function buildReachableTiles({
  currentLocation,
  movement = 0,
  rows = 0,
  columns = 0,
  revealedZones = [],
}) {
  if (!currentLocation || movement <= 0 || !rows || !columns) return new Set();

  const start = parseAlias(currentLocation);
  if (!start) return new Set();

  const revealed = new Set(revealedZones || []);
  const inBounds = (alias) => {
    const coord = parseAlias(alias);
    return coord
      && coord.col >= 0 && coord.col < columns
      && coord.row >= 0 && coord.row < rows;
  };

  const visited = new Set([currentLocation]);
  const reachable = new Set();
  let frontier = [currentLocation];

  for (let step = 0; step < movement; step++) {
    const next = [];
    frontier.forEach((alias) => {
      const coord = parseAlias(alias);
      if (!coord) return;
      getAdjacent(coord.col, coord.row).forEach((neighbor) => {
        if (!inBounds(neighbor) || !revealed.has(neighbor) || visited.has(neighbor)) return;
        visited.add(neighbor);
        reachable.add(neighbor);
        next.push(neighbor);
      });
    });
    frontier = next;
    if (frontier.length === 0) break;
  }

  return reachable;
}

export function validateMoveStep({
  alias,
  currentLocation,
  selectedPath = [],
  movement = 0,
  reachableTiles = new Set(),
  allowBacktrack = true,
}) {
  if (!alias) return { ok: false, reason: 'No tile selected' };
  if (!currentLocation) return { ok: false, reason: 'Current location unknown' };
  if (movement <= 0) return { ok: false, reason: 'No movement available' };

  const lastSelected = selectedPath[selectedPath.length - 1];
  if (allowBacktrack && alias === lastSelected) {
    return { ok: true, intent: 'backtrack', reason: 'Backtrack last step' };
  }

  if (selectedPath.includes(alias)) {
    return { ok: false, reason: 'Route already includes this tile' };
  }

  if (selectedPath.length >= movement) {
    return { ok: false, reason: 'Movement budget exhausted' };
  }

  if (!reachableTiles.has(alias)) {
    return { ok: false, reason: 'Tile is not reachable this turn' };
  }

  const lastTile = lastSelected || currentLocation;
  const coord = parseAlias(lastTile);
  if (!coord || !getAdjacent(coord.col, coord.row).includes(alias)) {
    return { ok: false, reason: 'Tile is not adjacent to route end' };
  }

  return { ok: true, intent: 'append', reason: 'Valid route step' };
}

export function validateMovePath({ currentLocation, path = [], movement = 0 }) {
  if (!currentLocation) return { ok: false, reason: 'Current location unknown' };
  if (path.length === 0) return { ok: false, reason: 'Move path is empty' };
  if (path.length > movement) return { ok: false, reason: 'Path exceeds movement budget' };

  let last = currentLocation;
  for (const alias of path) {
    const coord = parseAlias(last);
    if (!coord || !getAdjacent(coord.col, coord.row).includes(alias)) {
      return { ok: false, reason: `Path breaks adjacency at ${alias}` };
    }
    last = alias;
  }

  return { ok: true, reason: 'Path is valid' };
}
