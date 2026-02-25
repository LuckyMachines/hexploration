import { aliasToPixel } from '../../lib/hexmath';

export default function PathOverlay({ path = [] }) {
  if (path.length < 2) return null;

  const points = path.map((alias) => aliasToPixel(alias));

  return (
    <g>
      {/* Path line */}
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="#e8c860"
        strokeWidth="2"
        strokeDasharray="6 3"
        opacity="0.7"
      />

      {/* Direction arrows at each segment midpoint */}
      {points.slice(0, -1).map((p1, i) => {
        const p2 = points[i + 1];
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);

        return (
          <g key={i} transform={`translate(${mx},${my}) rotate(${angle})`}>
            <path d="M-3,-3 L3,0 L-3,3" fill="#e8c860" opacity="0.6" />
          </g>
        );
      })}

      {/* Waypoint dots */}
      {points.slice(1, -1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#e8c860" opacity="0.5" />
      ))}
    </g>
  );
}
