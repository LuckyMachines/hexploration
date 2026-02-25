import { Tile, TILE_LABELS, TILE_COLORS } from '../../lib/constants';

const LEGEND_TILES = [Tile.JUNGLE, Tile.PLAINS, Tile.DESERT, Tile.MOUNTAIN, Tile.LANDING, Tile.RELIC];

export default function TerrainLegend() {
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {LEGEND_TILES.map((tile) => (
        <div key={tile} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: TILE_COLORS[tile] }}
          />
          <span className="font-mono text-[10px] text-exp-text-dim uppercase tracking-wider">
            {TILE_LABELS[tile]}
          </span>
        </div>
      ))}
    </div>
  );
}
