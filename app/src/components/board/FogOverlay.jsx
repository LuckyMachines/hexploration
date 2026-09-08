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
        fill={isReachable ? '#20281b' : '#151a12'}
        fillOpacity={isIntent ? 0.88 : isReachable ? 0.78 : 0.84}
        stroke={isInventoryAssisted ? '#3a7cc4' : isIntent ? '#c4cbb8' : isReachable ? '#c4a64a' : '#46513f'}
        strokeWidth={isIntent || isReachable ? 2 : 1}
        className={`alive-tile ${isIntent ? 'alive-fog-intent' : 'alive-fog-tile'}`}
      />
      <path
        d={`M${cx - 18},${cy - 10} C${cx - 3},${cy - 20} ${cx + 6},${cy - 1} ${cx + 18},${cy - 11} M${cx - 22},${cy + 11} C${cx - 9},${cy + 1} ${cx + 8},${cy + 20} ${cx + 22},${cy + 8}`}
        fill="none"
        stroke={isReachable ? '#c4a64a' : '#7d8973'}
        strokeWidth="0.8"
        opacity={isIntent ? '0.38' : '0.26'}
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
        fill={isReachable ? '#c4a64a' : '#8a957f'}
        style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}
      >
        {isReachable ? '\u25CE' : '?'}
      </text>
    </g>
  );
}
