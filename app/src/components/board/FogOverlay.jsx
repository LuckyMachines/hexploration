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
        fillOpacity={isReachable ? 0.55 : 0.7}
        stroke={isInventoryAssisted ? '#3a7cc4' : isIntent ? '#c4cbb8' : isReachable ? '#c4a64a' : '#2a3224'}
        strokeWidth={isIntent || isReachable ? 2 : 1}
        className="alive-tile"
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
