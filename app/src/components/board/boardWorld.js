import { Tile } from '../../lib/constants';
import { parseAlias } from '../../lib/hexmath';

const SQRT3 = Math.sqrt(3);

export const WORLD_TERRAIN = {
  [Tile.NONE]: { height: 0.18, top: '#111711', side: '#070b08', emissive: '#172019' },
  [Tile.JUNGLE]: { height: 0.76, top: '#315f3b', side: '#132b1b', emissive: '#183620' },
  [Tile.PLAINS]: { height: 0.5, top: '#737a43', side: '#30351c', emissive: '#383b20' },
  [Tile.DESERT]: { height: 0.68, top: '#8d6735', side: '#3b2918', emissive: '#4b3118' },
  [Tile.MOUNTAIN]: { height: 1.12, top: '#626a70', side: '#252a2d', emissive: '#30363a' },
  [Tile.LANDING]: { height: 0.6, top: '#315f86', side: '#122a3d', emissive: '#183d59' },
  [Tile.RELIC]: { height: 0.88, top: '#62468a', side: '#241a32', emissive: '#38234f' },
};

export function rawWorldPosition(alias) {
  const coord = parseAlias(alias);
  if (!coord) return { x: 0, z: 0 };
  return {
    x: coord.col * 1.5,
    z: (coord.row + (coord.col % 2 === 1 ? 0.5 : 0)) * SQRT3,
  };
}

export function buildBoardWorld(cells = []) {
  const positioned = cells.map((cell) => ({ ...cell, ...rawWorldPosition(cell.alias) }));
  if (!positioned.length) return { cells: [], width: 2, depth: 2, radius: 2 };

  const xs = positioned.map((cell) => cell.x);
  const zs = positioned.map((cell) => cell.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const width = maxX - minX + 2;
  const depth = maxZ - minZ + SQRT3;

  return {
    cells: positioned.map((cell) => ({
      ...cell,
      x: cell.x - centerX,
      z: cell.z - centerZ,
      height: WORLD_TERRAIN[cell.revealed ? cell.tileType : Tile.NONE]?.height || WORLD_TERRAIN[Tile.NONE].height,
    })),
    width,
    depth,
    radius: Math.max(2, Math.hypot(width, depth) / 2),
  };
}

export function cameraPlan(world, aspect = 1) {
  const verticalFov = 34 * (Math.PI / 180);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.35, aspect));
  const limitingFov = Math.max(0.2, Math.min(verticalFov, horizontalFov));
  const distance = (world.radius / Math.sin(limitingFov / 2)) * 0.72;
  return {
    distance,
    position: [distance * 0.48, distance * 0.62, distance * 0.78],
    target: [0, 0.16, 0],
  };
}

export function seedForAlias(alias = '') {
  let value = 2166136261;
  for (const character of alias) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
