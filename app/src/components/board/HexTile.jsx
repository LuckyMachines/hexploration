import { hexPoints } from '../../lib/hexmath';
import { TILE_COLORS, Tile } from '../../lib/constants';
import { TERRAIN_ICONS } from '../../lib/terrainIcons';

export default function HexTile({
  cx, cy, tileType, alias, hasCampsite,
  isSelected, isHovered, isReachable, isInventoryAssisted, isIntent, isCommitted, trait, onClick, onHover,
}) {
  const fillColor = TILE_COLORS[tileType] || TILE_COLORS[Tile.NONE];
  const TerrainIcon = TERRAIN_ICONS[tileType];
  const isRelic = tileType === Tile.RELIC;
  const patternColor = isRelic ? '#e8c860' : tileType === Tile.MOUNTAIN ? '#c4cbb8' : '#0d0f0a';

  return (
    <g
      onClick={() => onClick?.(alias)}
      onMouseEnter={() => onHover?.(alias)}
      onMouseLeave={() => onHover?.(null)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Hex shape */}
      <polygon
        data-alias={alias}
        data-reachable={isReachable ? 'true' : 'false'}
        points={hexPoints(cx, cy)}
        fill={fillColor}
        fillOpacity={isIntent ? 0.52 : isHovered ? 0.46 : isReachable ? 0.36 : 0.25}
        stroke={
          isSelected ? '#e8c860'
            : isInventoryAssisted ? '#3a7cc4'
            : isIntent ? '#c4cbb8'
            : isHovered ? '#c4cbb8'
              : isReachable ? '#c4a64a'
                : '#2a3224'
        }
        strokeWidth={isSelected || isIntent ? 2.8 : isReachable ? 2 : 1}
        className={`alive-tile transition-all duration-200 ${isCommitted ? 'alive-committed-tile' : ''} ${isIntent ? 'alive-tile-intent' : ''} ${isRelic ? 'alive-relic-tile' : ''}`}
      />
      <path
        d={`M${cx - 22},${cy - 10} C${cx - 9},${cy - 18} ${cx + 8},${cy - 2} ${cx + 22},${cy - 10} M${cx - 20},${cy + 8} C${cx - 6},${cy + 1} ${cx + 7},${cy + 15} ${cx + 20},${cy + 6}`}
        fill="none"
        stroke={patternColor}
        strokeWidth="0.7"
        opacity={isIntent || isHovered ? '0.3' : '0.16'}
        className={isRelic ? 'alive-relic-line' : ''}
      />
      {isInventoryAssisted && (
        <circle
          cx={cx}
          cy={cy}
          r="23"
          fill="none"
          stroke="#3a7cc4"
          strokeWidth="0.8"
          strokeDasharray="2 5"
          opacity="0.55"
          className="alive-route-preview"
        />
      )}

      {/* Terrain icon */}
      {TerrainIcon && (
        <TerrainIcon transform={`translate(${cx},${cy})`} style={{ color: fillColor }} />
      )}
      {trait?.isKnown && (
        <g transform={`translate(${cx - 15},${cy - 16})`}>
          <title>{`${trait.label}: ${trait.summary}`}</title>
          <circle r="6" fill="#10140d" stroke={traitStroke(trait.tone)} strokeWidth="1" opacity="0.92" />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-exp-text"
            style={{ fontSize: '7px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
          >
            {trait.glyph}
          </text>
        </g>
      )}
      {isRelic && (
        <circle
          cx={cx}
          cy={cy}
          r="19"
          fill="none"
          stroke="#e8c860"
          strokeWidth="0.9"
          strokeDasharray="2 5"
          opacity="0.48"
          className="alive-relic-pulse"
        />
      )}

      {/* Zone label */}
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        className="fill-exp-text-dim"
        style={{ fontSize: '8px', fontFamily: 'JetBrains Mono, monospace' }}
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

function traitStroke(tone = '') {
  return {
    green: '#3a8a50',
    gold: '#e8c860',
    orange: '#c4964a',
    red: '#e0604f',
    blue: '#5090c0',
  }[tone] || '#7a8088';
}
