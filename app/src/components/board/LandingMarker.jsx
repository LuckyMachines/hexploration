export default function LandingMarker({ cx, cy }) {
  return (
    <g transform={`translate(${cx},${cy})`}>
      {/* Landing pad ring */}
      <circle r="12" fill="none" stroke="#5090c0" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />

      {/* Ship icon */}
      <path
        d="M0,-7 L4,-1 L3,3 L1,5 L-1,5 L-3,3 L-4,-1 Z"
        fill="#5090c0"
        fillOpacity="0.3"
        stroke="#5090c0"
        strokeWidth="0.8"
      />
      <line x1="0" y1="-4" x2="0" y2="2" stroke="#5090c0" strokeWidth="0.6" />
    </g>
  );
}
