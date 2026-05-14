import { hexPoints } from '../../lib/hexmath';

export default function FogOverlay({ cx, cy, alias, onClick, isReachable, isInventoryAssisted, isIntent, onHover }) {
  return (
    <g
      onClick={() => onClick?.(alias)}
      onMouseEnter={() => onHover?.(alias)}
      onMouseLeave={() => onHover?.(null)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <polygon
        data-alias={alias}
        data-reachable={isReachable ? 'true' : 'false'}
        points={hexPoints(cx, cy)}
        fill={isReachable ? '#1a2016' : '#0d0f0a'}
        fillOpacity={isIntent ? 0.82 : isReachable ? 0.62 : 0.72}
        stroke={isInventoryAssisted ? '#3a7cc4' : isIntent ? '#c4cbb8' : isReachable ? '#c4a64a' : '#2a3224'}
        strokeWidth={isIntent || isReachable ? 2 : 1}
        className={`alive-tile ${isIntent ? 'alive-fog-intent' : 'alive-fog-tile'}`}
      />
      <path
        d={`M${cx - 18},${cy - 10} C${cx - 3},${cy - 20} ${cx + 6},${cy - 1} ${cx + 18},${cy - 11} M${cx - 22},${cy + 11} C${cx - 9},${cy + 1} ${cx + 8},${cy + 20} ${cx + 22},${cy + 8}`}
        fill="none"
        stroke={isReachable ? '#c4a64a' : '#6a7560'}
        strokeWidth="0.8"
        opacity={isIntent ? '0.32' : '0.18'}
        className="alive-fog-line"
      />
      {isInventoryAssisted && (
        <circle
          cx={cx}
          cy={cy}
          r="21"
          fill="none"
          stroke="#3a7cc4"
          strokeWidth="0.8"
          strokeDasharray="2 5"
          opacity="0.5"
          className="alive-route-preview"
        />
      )}
      <text
        x={cx}
        y={cy + 2}
        textAnchor="middle"
        fill={isReachable ? '#c4a64a' : '#6a7560'}
        style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}
      >
        {isReachable ? '\u25CE' : '?'}
      </text>
    </g>
  );
}
