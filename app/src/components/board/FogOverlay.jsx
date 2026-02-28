import { hexPoints } from '../../lib/hexmath';

export default function FogOverlay({ cx, cy, alias, onClick, isReachable }) {
  return (
    <g
      onClick={() => onClick?.(alias)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <polygon
        data-alias={alias}
        data-reachable={isReachable ? 'true' : 'false'}
        points={hexPoints(cx, cy)}
        fill={isReachable ? '#1a2016' : '#0d0f0a'}
        fillOpacity={isReachable ? 0.55 : 0.7}
        stroke={isReachable ? '#c4a64a' : '#2a3224'}
        strokeWidth={isReachable ? 2 : 1}
      />
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
