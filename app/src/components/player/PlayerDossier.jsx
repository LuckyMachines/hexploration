import { truncateAddress, formatZoneAlias } from '../../lib/formatting';
import { PLAYER_COLORS, STAT_LABELS } from '../../lib/constants';
import StatBar from './StatBar';

export default function PlayerDossier({ player, index, isCurrentUser, isFocused, isNearIntent, onFocus }) {
  const addr = player.playerAddress || '';
  const color = PLAYER_COLORS[index] || PLAYER_COLORS[0];

  return (
    <button
      type="button"
      onClick={onFocus}
      className={`block w-full text-left border rounded p-3 bg-exp-panel transition-colors
      ${isFocused ? 'border-blueprint/60 bg-blueprint/5 shadow-[0_0_0_1px_rgba(58,124,196,0.25)]' : isCurrentUser ? 'border-compass/40' : 'border-exp-border'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded border border-exp-border bg-exp-dark/60" style={{ color }}>
            <span className="font-mono text-[10px] font-bold">P{index + 1}</span>
          </div>
          <div>
            <span className={`block font-mono text-xs ${isCurrentUser ? 'text-compass-bright' : 'text-exp-text'}`}>
              {truncateAddress(addr)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">
              {formatZoneAlias(player.currentZone)}
            </span>
          </div>
          {isCurrentUser && (
            <span className="rounded border border-compass/30 bg-compass/5 px-1.5 py-0.5 text-[10px] text-compass uppercase tracking-wider">you</span>
          )}
        </div>
        {!player.isActive && player.playerAddress && (
          <span className="text-xs font-mono text-signal-red uppercase tracking-wider">Inactive</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 border-t border-exp-border/50 pt-2">
        <span className="rounded border border-exp-border/50 bg-exp-dark/35 px-2 py-1 font-mono text-[10px] uppercase text-exp-text-dim">
          M {player.movement ?? 0}
        </span>
        <span className="rounded border border-exp-border/50 bg-exp-dark/35 px-2 py-1 font-mono text-[10px] uppercase text-exp-text-dim">
          A {player.agility ?? 0}
        </span>
        <span className="rounded border border-exp-border/50 bg-exp-dark/35 px-2 py-1 font-mono text-[10px] uppercase text-exp-text-dim">
          D {player.dexterity ?? 0}
        </span>
      </div>

      <div className="mt-2 space-y-1">
        <StatBar label={STAT_LABELS[0]} value={player.movement ?? 0} />
        <StatBar label={STAT_LABELS[1]} value={player.agility ?? 0} />
        <StatBar label={STAT_LABELS[2]} value={player.dexterity ?? 0} />
      </div>

      {player.action && player.action !== '' && player.action !== 'Idle' && (
        <div className="mt-2 flex items-center gap-1.5 rounded border border-blueprint/25 bg-blueprint/5 px-2 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blueprint" />
          <span className="font-mono text-[11px] text-blueprint uppercase tracking-wider">
            Action: {player.action}
          </span>
        </div>
      )}

      {isNearIntent && (
        <div className="mt-2 rounded border border-blueprint/25 bg-blueprint/5 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-blueprint">
          Near board intent
        </div>
      )}
    </button>
  );
}
