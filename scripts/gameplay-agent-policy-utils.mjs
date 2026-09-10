export function shortestRevealedPath(start, target, revealedAliases = [], adjacentFor) {
  if (!start || !target || typeof adjacentFor !== 'function') return [];
  if (start === target) return [start];
  const revealed = new Set(revealedAliases);
  revealed.add(start);
  revealed.add(target);
  const queue = [[start]];
  const visited = new Set([start]);
  while (queue.length) {
    const path = queue.shift();
    const current = path.at(-1);
    for (const neighbor of adjacentFor(current) || []) {
      if (!revealed.has(neighbor) || visited.has(neighbor)) continue;
      const next = [...path, neighbor];
      if (neighbor === target) return next;
      visited.add(neighbor);
      queue.push(next);
    }
  }
  return [];
}

export function shortestBoardPath(start, target, adjacentFor, { min = 0, max = 9 } = {}) {
  if (!start || !target || typeof adjacentFor !== 'function') return [];
  if (start === target) return [start];
  const inBounds = (alias) => {
    const [column, row] = String(alias).split(',').map(Number);
    return Number.isInteger(column) && Number.isInteger(row)
      && column >= min && column <= max && row >= min && row <= max;
  };
  if (!inBounds(start) || !inBounds(target)) return [];
  const queue = [[start]];
  const visited = new Set([start]);
  while (queue.length) {
    const path = queue.shift();
    for (const neighbor of adjacentFor(path.at(-1)) || []) {
      if (!inBounds(neighbor) || visited.has(neighbor)) continue;
      const next = [...path, neighbor];
      if (neighbor === target) return next;
      visited.add(neighbor);
      queue.push(next);
    }
  }
  return [];
}

export function terminalIntentPlan({
  turn,
  totalTurns,
  windowTurns = 4,
  requireTerminalOutcome = false,
  player = {},
  snapshot = {},
  adjacentFor,
  actionMove = 1,
  actionFlee = 7,
} = {}) {
  if (!requireTerminalOutcome || Number(turn) < Math.max(1, Number(totalTurns) - Number(windowTurns) + 1)) return null;
  const zones = snapshot.activeZones?.zones || [];
  const tiles = snapshot.activeZones?.tiles || [];
  const landingIndex = tiles.findIndex((tile) => Number(tile) === 5);
  const landing = zones[landingIndex] || '';
  if (!landing || !player.location || player.isActive === false || player.active === false) return null;
  if (player.location === landing) return { action: actionFlee, options: [], reason: 'terminal-evidence evacuation from landing' };
  const path = shortestRevealedPath(player.location, landing, zones, adjacentFor);
  const route = path.length >= 2
    ? path
    : shortestBoardPath(player.location, landing, adjacentFor);
  if (route.length < 2) return null;
  const movement = Math.max(1, Number(player.stats?.movement || 1));
  return {
    action: actionMove,
    options: route.slice(1, movement + 1),
    reason: 'terminal-evidence route toward landing',
  };
}
