import { hexPoints } from '../../lib/hexmath';
import { TILE_COLORS, Tile } from '../../lib/constants';
import { TERRAIN_ICONS } from '../../lib/terrainIcons';

export default function HexTile({
  cx, cy, tileType, alias, hasCampsite,
  isSelected, isHovered, onClick, onHover,
}) {
  const fillColor = TILE_COLORS[tileType] || TILE_COLORS[Tile.NONE];
  const TerrainIcon = TERRAIN_ICONS[tileType];

  return (
    <g
      onClick={() => onClick?.(alias)}
      onMouseEnter={() => onHover?.(alias)}
      onMouseLeave={() => onHover?.(null)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Hex shape */}
      <polygon
        points={hexPoints(cx, cy)}
        fill={fillColor}
        fillOpacity={0.25}
        stroke={
          isSelected ? '#e8c860'
            : isHovered ? '#c4cbb8'
              : '#2a3224'
        }
        strokeWidth={isSelected ? 2 : 1}
        className="transition-all duration-200"
      />

      {/* Terrain icon */}
      {TerrainIcon && (
        <TerrainIcon transform={`translate(${cx},${cy})`} style={{ color: fillColor }} />
      )}

      {/* Zone label */}
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        className="fill-exp-text-dim"
        style={{ fontSize: '6px', fontFamily: 'JetBrains Mono, monospace' }}
      >
        {alias}
      </text>

      {/* Campsite indicator */}
      {hasCampsite && (
        <g transform={`translate(${cx + 14},${cy - 14})`}>
          <circle r="4" fill="#1a2016" stroke="#40a080" strokeWidth="1" />
          <path d="M0,-2 L2,2 L-2,2 Z" fill="#40a080" />
        </g>
      )}
    </g>
  );
}
