import { describe, expect, it } from 'vitest';
import { Tile } from '../../lib/constants';
import { buildBoardWorld, cameraPlan, rawWorldPosition, WORLD_TERRAIN } from './boardWorld';

describe('boardWorld', () => {
  it('maps the offset hex grid into a centered three-dimensional world', () => {
    const world = buildBoardWorld([
      { alias: '0,0', tileType: Tile.JUNGLE, revealed: true },
      { alias: '1,0', tileType: Tile.MOUNTAIN, revealed: true },
      { alias: '2,1', tileType: Tile.NONE, revealed: false },
    ]);

    expect(rawWorldPosition('1,0').z).toBeCloseTo(Math.sqrt(3) / 2);
    expect(Math.min(...world.cells.map((cell) => cell.x))).toBeCloseTo(-1.5);
    expect(Math.max(...world.cells.map((cell) => cell.x))).toBeCloseTo(1.5);
    expect(world.cells.find((cell) => cell.alias === '1,0').height).toBe(WORLD_TERRAIN[Tile.MOUNTAIN].height);
  });

  it('backs the perspective camera away on narrow screens so the world stays framed', () => {
    const world = buildBoardWorld(Array.from({ length: 16 }, (_, index) => ({
      alias: `${index % 4},${Math.floor(index / 4)}`,
      tileType: Tile.PLAINS,
      revealed: true,
    })));

    expect(cameraPlan(world, 0.5).distance).toBeGreaterThan(cameraPlan(world, 1.6).distance);
  });
});
