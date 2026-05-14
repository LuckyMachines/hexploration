import { aliasToPixel } from '../../lib/hexmath';

export default function PathOverlay({
  origin = '',
  path = [],
  previewPath = [],
  invalidAlias = '',
  isCommitted = false,
  isHeavy = false,
}) {
  const route = origin ? [origin, ...path] : path;
  const previewRoute = origin ? [origin, ...previewPath] : previewPath;
  if (route.length < 2 && previewRoute.length < 2 && !invalidAlias) return null;

  const points = route.map((alias) => aliasToPixel(alias));
  const previewPoints = previewRoute.map((alias) => aliasToPixel(alias));
  const invalidPoint = invalidAlias ? aliasToPixel(invalidAlias) : null;
  const lineClass = isCommitted ? 'alive-route-locked' : isHeavy ? 'alive-route-heavy' : 'alive-route-preview';

  return (
    <g pointerEvents="none">
      {previewPoints.length >= 2 && previewPath.length > path.length && (
        <polyline
          points={previewPoints.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#c4cbb8"
          strokeWidth="1.4"
          strokeDasharray="2 6"
          opacity="0.42"
          className="alive-route-preview"
        />
      )}

      {points.length >= 2 && (
        <>
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#0d0f0a"
            strokeWidth={isHeavy ? '8' : '6'}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.54"
          />
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={isCommitted ? '#40a080' : isHeavy ? '#d44040' : '#e8c860'}
            strokeWidth={isHeavy ? '3.5' : '2.5'}
            strokeDasharray={isCommitted ? '0' : isHeavy ? '9 4' : '6 4'}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={isCommitted ? '0.96' : '0.82'}
            className={lineClass}
          />
        </>
      )}

      {points.slice(0, -1).map((p1, i) => {
        const p2 = points[i + 1];
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);

        return (
          <g key={i} transform={`translate(${mx},${my}) rotate(${angle})`}>
            <circle r="6" fill="#0d0f0a" opacity="0.5" />
            <path d="M-4,-4 L4,0 L-4,4" fill={isCommitted ? '#40a080' : '#e8c860'} opacity={isHeavy ? '0.92' : '0.72'} />
          </g>
        );
      })}

      {points.slice(1, -1).map((p, i) => (
        <g key={i} transform={`translate(${p.x},${p.y})`}>
          <circle r={isHeavy ? '6' : '5'} fill="#0d0f0a" opacity="0.64" />
          <circle r={isHeavy ? '3.6' : '3'} fill={isCommitted ? '#40a080' : '#e8c860'} opacity={isCommitted ? '0.88' : '0.64'} />
        </g>
      ))}

      {invalidPoint && (
        <g transform={`translate(${invalidPoint.x},${invalidPoint.y})`} className="alive-invalid-tile-callout">
          <circle r="33" fill="none" stroke="#d44040" strokeWidth="1.4" strokeDasharray="4 4" opacity="0.88" />
          <path d="M-9,-9 L9,9 M9,-9 L-9,9" stroke="#d44040" strokeWidth="2" strokeLinecap="round" />
          <rect x="-28" y="29" width="56" height="14" rx="2" fill="#0d0f0a" stroke="#d44040" strokeWidth="0.8" opacity="0.88" />
          <text y="39" textAnchor="middle" fill="#d44040" style={{ fontSize: '7px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em' }}>
            INVALID
          </text>
        </g>
      )}
    </g>
  );
}
