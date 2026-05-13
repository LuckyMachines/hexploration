import { Action, ACTION_LABELS, TILE_COLORS, TILE_LABELS, Tile } from '../../lib/constants';
import { aliasToPixel } from '../../lib/hexmath';

const ACTION_STANCE = {
  [Action.MOVE]: { label: 'Route', color: '#e8c860', lean: 4, tool: 'compass' },
  [Action.SETUP_CAMP]: { label: 'Camp', color: '#40a080', lean: 1, tool: 'stakes' },
  [Action.BREAK_DOWN_CAMP]: { label: 'Pack', color: '#40a080', lean: 1, tool: 'pack' },
  [Action.DIG]: { label: 'Dig', color: '#c4964a', lean: -2, tool: 'spade' },
  [Action.REST]: { label: 'Rest', color: '#5090c0', lean: 0, tool: 'breath' },
  [Action.HELP]: { label: 'Aid', color: '#9060c0', lean: 2, tool: 'signal' },
  [Action.FLEE]: { label: 'Flee', color: '#d44040', lean: 7, tool: 'flare' },
};

const TERRAIN_REACTION = {
  [Tile.NONE]: { glyph: '?', label: 'Uncharted', color: '#6a7560' },
  [Tile.JUNGLE]: { glyph: '///', label: 'Canopy rustle', color: TILE_COLORS[Tile.JUNGLE] },
  [Tile.PLAINS]: { glyph: '~', label: 'Wind grass', color: TILE_COLORS[Tile.PLAINS] },
  [Tile.DESERT]: { glyph: '...', label: 'Heat shimmer', color: TILE_COLORS[Tile.DESERT] },
  [Tile.MOUNTAIN]: { glyph: '^', label: 'Stone echo', color: TILE_COLORS[Tile.MOUNTAIN] },
  [Tile.LANDING]: { glyph: 'LZ', label: 'Beacon lock', color: TILE_COLORS[Tile.LANDING] },
  [Tile.RELIC]: { glyph: '*', label: 'Relic hum', color: TILE_COLORS[Tile.RELIC] },
};

function routePoints(origin, path) {
  return (origin ? [origin, ...path] : path).filter(Boolean).map((alias) => ({
    alias,
    ...aliasToPixel(alias),
  }));
}

function directionAngle(fromAlias, toAlias) {
  if (!fromAlias || !toAlias) return 0;
  const from = aliasToPixel(fromAlias);
  const to = aliasToPixel(toAlias);
  return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
}

function MemoryMarks({ origin, path, activeAction, hasSubmitted }) {
  const points = routePoints(origin, path);

  return (
    <g className="alive-memory">
      {points.slice(1).map((point, index) => (
        <g key={`${point.alias}-${index}`} transform={`translate(${point.x},${point.y})`}>
          <ellipse
            rx="4.5"
            ry="2.5"
            fill="#0d0f0a"
            opacity="0.42"
            transform={`rotate(${index % 2 === 0 ? -18 : 18})`}
          />
          <circle r="2" fill="#e8c860" opacity={hasSubmitted ? '0.62' : '0.36'} />
        </g>
      ))}

      {activeAction === Action.DIG && origin && (() => {
        const pos = aliasToPixel(origin);
        return (
          <g transform={`translate(${pos.x},${pos.y + 20})`} opacity="0.78">
            <ellipse rx="15" ry="4" fill="#c4964a" opacity="0.16" />
            <path d="M-9,0 C-4,-4 2,4 9,0" fill="none" stroke="#c4964a" strokeWidth="1" />
          </g>
        );
      })()}

      {activeAction === Action.SETUP_CAMP && origin && (() => {
        const pos = aliasToPixel(origin);
        return (
          <g transform={`translate(${pos.x + 17},${pos.y - 18})`} opacity="0.86">
            <path d="M-5,5 L0,-6 L6,5 Z" fill="#1a2016" stroke="#40a080" strokeWidth="1" />
            <path className="alive-smoke" d="M1,-9 C-5,-15 8,-18 1,-25" fill="none" stroke="#c4cbb8" strokeWidth="1" opacity="0.32" />
          </g>
        );
      })()}
    </g>
  );
}

function IntentCursor({
  intentAlias,
  intentTile,
  currentLocation,
  activeAction,
  invalidPulse,
  isObserving,
  inputMode,
}) {
  if (!intentAlias) return null;

  const pos = aliasToPixel(intentAlias);
  const terrain = TERRAIN_REACTION[intentTile?.tileType ?? Tile.NONE] || TERRAIN_REACTION[Tile.NONE];
  const action = ACTION_STANCE[activeAction] || ACTION_STANCE[Action.MOVE];
  const angle = directionAngle(currentLocation, intentAlias);
  const terrainLabel = TILE_LABELS[intentTile?.tileType ?? Tile.NONE] || 'Unknown';

  return (
    <g transform={`translate(${pos.x},${pos.y})`} className={invalidPulse ? 'alive-invalid' : ''}>
      <circle
        className={isObserving ? 'alive-slow-scan' : 'alive-cursor-pulse'}
        r="29"
        fill="none"
        stroke={invalidPulse ? '#d44040' : terrain.color}
        strokeWidth="1.2"
        strokeDasharray="4 4"
        opacity="0.82"
      />
      <circle r="20" fill={terrain.color} opacity="0.06" />
      <path
        d="M0,-26 L4,-18 L0,-20 L-4,-18 Z"
        fill={action.color}
        opacity="0.9"
        transform={`rotate(${angle + 90})`}
      />
      <g className="alive-reticle" stroke={action.color} strokeWidth="1.2" opacity="0.85">
        <path d="M-32,0 L-22,0" />
        <path d="M22,0 L32,0" />
        <path d="M0,-32 L0,-22" />
        <path d="M0,22 L0,32" />
      </g>
      <text
        y="-36"
        textAnchor="middle"
        fill={terrain.color}
        style={{ fontSize: '8px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}
      >
        {terrain.glyph} {terrainLabel}
      </text>
      <text
        y="38"
        textAnchor="middle"
        fill={action.color}
        style={{ fontSize: '7px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em' }}
      >
        {inputMode.toUpperCase()} / {terrain.label}
      </text>
    </g>
  );
}

function LivingExplorer({
  currentLocation,
  intentAlias,
  activeAction,
  hasSubmitted,
  isResolving,
  isSpectator,
  isObserving,
  currentPlayerIndex = 0,
}) {
  if (!currentLocation) return null;

  const pos = aliasToPixel(currentLocation);
  const action = ACTION_STANCE[activeAction] || ACTION_STANCE[Action.MOVE];
  const angle = directionAngle(currentLocation, intentAlias || currentLocation);
  const stateLabel = isSpectator
    ? 'Observing'
    : isResolving
      ? 'Braced'
      : hasSubmitted
        ? 'Ready'
        : isObserving
          ? 'Listening'
          : action.label;
  const bodyClass = [
    'alive-explorer',
    isResolving ? 'alive-explorer-resolving' : '',
    hasSubmitted ? 'alive-explorer-ready' : '',
    isObserving ? 'alive-explorer-observing' : '',
  ].filter(Boolean).join(' ');

  return (
    <g transform={`translate(${pos.x},${pos.y})`} className={bodyClass}>
      <g transform={`rotate(${Math.max(-18, Math.min(18, angle / 8 + action.lean))})`}>
        <ellipse cx="0" cy="13" rx="13" ry="5" fill="#0d0f0a" opacity="0.44" />
        <path
          d="M-8,8 C-7,-4 -3,-13 2,-14 C8,-12 10,-2 8,8 C4,13 -3,13 -8,8 Z"
          fill="#1a2016"
          stroke={action.color}
          strokeWidth="1.5"
        />
        <circle cx="0" cy="-17" r="6" fill="#c4cbb8" stroke="#0d0f0a" strokeWidth="1.2" />
        <path d="M-9,-5 L-18,4" stroke={action.color} strokeWidth="2" strokeLinecap="round" />
        <path d="M8,-5 L17,-1" stroke={action.color} strokeWidth="2" strokeLinecap="round" />
        <path d="M-4,10 L-8,20" stroke="#c4cbb8" strokeWidth="2" strokeLinecap="round" />
        <path d="M5,10 L10,20" stroke="#c4cbb8" strokeWidth="2" strokeLinecap="round" />
        <circle cx="5" cy="-18" r="1.2" fill="#0d0f0a" />
        <path d="M0,-24 L10,-26" stroke={action.color} strokeWidth="1" opacity="0.85" />

        {action.tool === 'compass' && <circle cx="18" cy="-1" r="4" fill="none" stroke={action.color} strokeWidth="1" />}
        {action.tool === 'spade' && <path d="M17,-2 L25,8 M23,8 L27,12 L20,13 Z" stroke={action.color} fill="none" strokeWidth="1.3" />}
        {action.tool === 'flare' && <path d="M17,-1 L24,-10 M24,-10 L29,-15" stroke="#d44040" strokeWidth="1.4" />}
        {action.tool === 'signal' && <path d="M17,-1 C25,-9 31,-9 38,-2" fill="none" stroke={action.color} strokeWidth="1" opacity="0.7" />}
        {action.tool === 'breath' && <path className="alive-breath-mark" d="M10,-18 C20,-24 27,-17 17,-12" fill="none" stroke={action.color} strokeWidth="1" opacity="0.55" />}
      </g>

      <line
        x1="0"
        y1="-18"
        x2="0"
        y2="-31"
        stroke={action.color}
        strokeWidth="1"
        opacity="0.35"
        transform={`rotate(${angle + 90})`}
      />
      <text
        y="-36"
        textAnchor="middle"
        fill={action.color}
        style={{ fontSize: '8px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em' }}
      >
        P{currentPlayerIndex + 1} {stateLabel}
      </text>
    </g>
  );
}

function ActionTelemetry({ currentLocation, intentAlias, path, activeAction, hasSubmitted, isResolving }) {
  if (!currentLocation) return null;
  const pos = aliasToPixel(currentLocation);
  const action = ACTION_STANCE[activeAction] || ACTION_STANCE[Action.MOVE];
  const label = ACTION_LABELS[activeAction] || 'Move';
  const detail = isResolving ? 'resolving' : hasSubmitted ? 'locked' : path.length > 0 ? `${path.length} steps` : 'awaiting intent';

  return (
    <g transform={`translate(${pos.x - 48},${pos.y + 42})`}>
      <rect x="0" y="0" width="96" height="20" rx="2" fill="#0d0f0a" opacity="0.72" stroke={action.color} strokeWidth="0.8" />
      <text x="48" y="8" textAnchor="middle" fill={action.color} style={{ fontSize: '6.8px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em' }}>
        {label}
      </text>
      <text x="48" y="16" textAnchor="middle" fill="#6a7560" style={{ fontSize: '6.2px', fontFamily: 'JetBrains Mono, monospace' }}>
        {intentAlias || currentLocation} / {detail}
      </text>
    </g>
  );
}

export default function BoardPresence({
  currentLocation,
  intentAlias,
  intentTile,
  activeAction,
  path = [],
  hasSubmitted = false,
  isResolving = false,
  isSpectator = false,
  isObserving = false,
  invalidPulse = false,
  inputMode = 'mouse',
  currentPlayerIndex = 0,
}) {
  return (
    <g pointerEvents="none">
      <MemoryMarks origin={currentLocation} path={path} activeAction={activeAction} hasSubmitted={hasSubmitted} />
      <IntentCursor
        intentAlias={intentAlias}
        intentTile={intentTile}
        currentLocation={currentLocation}
        activeAction={activeAction}
        invalidPulse={invalidPulse}
        isObserving={isObserving}
        inputMode={inputMode}
      />
      <LivingExplorer
        currentLocation={currentLocation}
        intentAlias={intentAlias}
        activeAction={activeAction}
        hasSubmitted={hasSubmitted}
        isResolving={isResolving}
        isSpectator={isSpectator}
        isObserving={isObserving}
        currentPlayerIndex={currentPlayerIndex}
      />
      <ActionTelemetry
        currentLocation={currentLocation}
        intentAlias={intentAlias}
        path={path}
        activeAction={activeAction}
        hasSubmitted={hasSubmitted}
        isResolving={isResolving}
      />
    </g>
  );
}
