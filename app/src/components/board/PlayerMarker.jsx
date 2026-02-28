import { PLAYER_COLORS, PLAYER_LABELS } from '../../lib/constants';

export default function PlayerMarker({ cx, cy, playerIndex, isCurrentPlayer }) {
  const color = PLAYER_COLORS[playerIndex] || PLAYER_COLORS[0];
  const label = PLAYER_LABELS[playerIndex] || 'P?';

  // Offset multiple players so they don't overlap
  const offsetX = (playerIndex % 2 === 0 ? -8 : 8);
  const offsetY = (playerIndex < 2 ? -8 : 8);

  return (
    <g transform={`translate(${cx + offsetX},${cy + offsetY})`}>
      {/* Pulse ring for current player */}
      {isCurrentPlayer && (
        <circle r="8" fill="none" stroke={color} strokeWidth="1" opacity="0.4">
          <animate
            attributeName="r"
            values="6;10;6"
            dur="2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.4;0.1;0.4"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Marker circle */}
      <circle r="6" fill={color} stroke="#0d0f0a" strokeWidth="1.5" />

      {/* Label */}
      <text
        y="1"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#0d0f0a"
        style={{ fontSize: '8px', fontWeight: 'bold', fontFamily: 'JetBrains Mono, monospace' }}
      >
        {label}
      </text>
    </g>
  );
}
