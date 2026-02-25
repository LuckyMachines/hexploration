import { hexPoints } from '../../lib/hexmath';

export default function FogOverlay({ cx, cy, alias, onClick }) {
  return (
    <g
      onClick={() => onClick?.(alias)}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <polygon
        points={hexPoints(cx, cy)}
        fill="#0d0f0a"
        fillOpacity={0.7}
        stroke="#2a3224"
        strokeWidth={1}
      />
      <text
        x={cx}
        y={cy + 2}
        textAnchor="middle"
        fill="#6a7560"
        style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}
      >
        ?
      </text>
    </g>
  );
}
