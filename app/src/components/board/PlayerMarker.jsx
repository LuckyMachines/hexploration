import { PLAYER_COLORS, PLAYER_LABELS } from '../../lib/constants';

export default function PlayerMarker({ cx, cy, playerIndex, isCurrentPlayer, isFocused, onClick }) {
  const color = PLAYER_COLORS[playerIndex] || PLAYER_COLORS[0];
  const label = PLAYER_LABELS[playerIndex] || 'P?';

  // Offset multiple players so they don't overlap
  const offsetX = (playerIndex % 2 === 0 ? -8 : 8);
  const offsetY = (playerIndex < 2 ? -8 : 8);

  return (
    <g
      transform={`translate(${cx + offsetX},${cy + offsetY})`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {(isCurrentPlayer || isFocused) && (
        <circle r="12" fill={color} opacity={isCurrentPlayer ? '0.12' : '0.06'} className="alive-marker-aura" />
      )}
      {isCurrentPlayer && (
        <circle r="10" fill="none" stroke={color} strokeWidth="1.4" opacity="0.55">
          <animate
            attributeName="r"
            values="8;15;8"
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

      <path
        d="M0,-12 L12,-4 L8,11 L0,15 L-8,11 L-12,-4 Z"
        fill="#0d0f0a"
        stroke={isFocused ? '#3a7cc4' : color}
        strokeWidth={isCurrentPlayer ? '2' : '1.4'}
      />
      <circle r="7" fill={color} stroke="#0d0f0a" strokeWidth="1.4" />
      {isCurrentPlayer && (
        <path d="M0,-17 L4,-10 L0,-12 L-4,-10 Z" fill="#e8c860" />
      )}

      <text
        y="0.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#0d0f0a"
        style={{ fontSize: '7px', fontWeight: 'bold', fontFamily: 'JetBrains Mono, monospace' }}
      >
        {label}
      </text>
    </g>
  );
}
