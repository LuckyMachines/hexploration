import { truncateAddress, formatZoneAlias } from '../../lib/formatting';
import { PLAYER_COLORS, STAT_LABELS } from '../../lib/constants';
import { conditionForStats, statDetail } from '../../lib/detailText';
import { deriveCharacterState, getRole, resolveCharacterVisual, resolvePlayerCharacter } from '../../lib/characters';
import StatBar from './StatBar';

export default function PlayerDossier({ player, index, isCurrentUser, isFocused, isNearIntent, onFocus }) {
  const addr = player.playerAddress || '';
  const color = PLAYER_COLORS[index] || PLAYER_COLORS[0];
  const condition = conditionForStats(player);
  const character = resolvePlayerCharacter(player, index);
  const role = getRole(character.roleId);
  const actionLabel = player.action && player.action !== '' ? player.action : 'Idle';
  const characterState = deriveCharacterState({
    player,
    isCurrent: true,
    activeAction: actionLabel,
    lowStats: condition.tone === 'red',
  });
  const portrait = resolveCharacterVisual({ characterId: character.id, state: characterState });
  const idlePosture = actionLabel === 'Idle' || actionLabel === '0'
    ? 'Listening posture: no locked action yet.'
    : `Committed posture: ${actionLabel}.`;

  return (
    <button
      type="button"
      onClick={onFocus}
      className={`block w-full text-left border rounded p-3 bg-exp-panel transition-colors
      ${isFocused ? 'border-blueprint/60 bg-blueprint/5 shadow-[0_0_0_1px_rgba(58,124,196,0.25)]' : isCurrentUser ? 'border-compass/40' : 'border-exp-border'}`}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded border border-exp-border bg-[radial-gradient(circle_at_50%_38%,rgba(232,200,96,0.13),transparent_58%),rgba(8,12,9,0.82)]">
          <img src={portrait.path} alt="" className="h-full w-full object-contain object-bottom drop-shadow-[0_6px_7px_rgba(0,0,0,0.75)]" />
          <span className="absolute bottom-1 left-1 grid h-5 min-w-5 place-items-center rounded border border-exp-border bg-exp-dark/90 px-1 font-mono text-[8px] font-bold" style={{ color }}>P{index + 1}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className={`block truncate font-mono text-xs ${isCurrentUser ? 'text-compass-bright' : 'text-exp-text'}`}>
                {character.name}
              </span>
              <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.18em] text-blueprint">
                {role?.label} / {formatZoneAlias(player.currentZone)}
              </span>
            </div>
            {isCurrentUser && (
              <span className="rounded border border-compass/30 bg-compass/5 px-1.5 py-0.5 text-[10px] text-compass uppercase tracking-wider">you</span>
            )}
          </div>
          <span className="mt-1 block truncate font-mono text-[9px] text-exp-text-dim">{truncateAddress(addr)}</span>
          <p className="mt-1 font-sans text-[11px] leading-snug text-exp-text-dim">{character.fantasy}</p>
        </div>
      </div>

      {!player.isActive && player.playerAddress && (
        <span className="mb-2 inline-flex rounded border border-signal-red/35 bg-signal-red/5 px-2 py-1 text-[10px] font-mono text-signal-red uppercase tracking-wider">Inactive</span>
      )}

      <div className={`mb-2 rounded border px-2 py-1 ${
        condition.tone === 'red'
          ? 'border-signal-red/30 bg-signal-red/5'
          : condition.tone === 'gold'
            ? 'border-compass/30 bg-compass/5'
            : condition.tone === 'green'
              ? 'border-oxide-green/30 bg-oxide-green/5'
              : 'border-blueprint/25 bg-blueprint/5'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text">
            {condition.label}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
            {idlePosture}
          </span>
        </div>
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-exp-text-dim">
          {condition.detail}
        </p>
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

      <div className="mt-2 grid grid-cols-3 gap-1">
        {[player.movement, player.agility, player.dexterity].map((value, statIndex) => (
          <span key={STAT_LABELS[statIndex]} className="rounded border border-exp-border/50 bg-exp-dark/35 px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text-dim">
            {STAT_LABELS[statIndex][0]} {statDetail(value)}
          </span>
        ))}
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
