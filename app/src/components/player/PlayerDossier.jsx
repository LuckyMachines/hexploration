import { truncateAddress, formatZoneAlias } from '../../lib/formatting';
import { PLAYER_COLORS, STAT_LABELS } from '../../lib/constants';
import StatBar from './StatBar';

export default function PlayerDossier({ player, index, isCurrentUser }) {
  const addr = player.playerAddress || '';
  const color = PLAYER_COLORS[index] || PLAYER_COLORS[0];

  return (
    <div className={`border rounded p-3 bg-exp-panel transition-colors
      ${isCurrentUser ? 'border-compass/40' : 'border-exp-border'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className={`font-mono text-xs ${isCurrentUser ? 'text-compass-bright' : 'text-exp-text'}`}>
            {truncateAddress(addr)}
          </span>
          {isCurrentUser && (
            <span className="text-[10px] text-compass/70 uppercase tracking-wider">(you)</span>
          )}
        </div>
        {!player.isActive && player.playerAddress && (
          <span className="text-[10px] font-mono text-signal-red uppercase tracking-wider">Inactive</span>
        )}
      </div>

      {/* Location */}
      <div className="mb-2">
        <span className="font-mono text-[10px] text-exp-text-dim tracking-wider uppercase">
          Zone: </span>
        <span className="font-mono text-xs text-compass">
          {formatZoneAlias(player.currentZone)}
        </span>
      </div>

      {/* Stats */}
      <div className="space-y-1">
        <StatBar label={STAT_LABELS[0]} value={player.movement ?? 0} />
        <StatBar label={STAT_LABELS[1]} value={player.agility ?? 0} />
        <StatBar label={STAT_LABELS[2]} value={player.dexterity ?? 0} />
      </div>

      {/* Action submitted badge */}
      {player.action && player.action !== '' && player.action !== 'Idle' && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blueprint" />
          <span className="font-mono text-[10px] text-blueprint uppercase tracking-wider">
            Action: {player.action}
          </span>
        </div>
      )}
    </div>
  );
}
