import { useEffect, useMemo, useState } from 'react';
import {
  HELP_STAT_KEYS,
  getHelpTargetState,
  playerLocation,
  playerNumber,
  rankHelpTargets,
  recommendedHelpStat,
  statLabelFor,
} from '../../lib/helpRescue';
import { truncateAddress } from '../../lib/formatting';

function targetCondition(player) {
  const minimum = Math.min(...HELP_STAT_KEYS.map((key) => Number(player?.[key] ?? 0)));
  if (minimum <= 0) return { label: 'Collapsing', tone: 'text-signal-red' };
  if (minimum <= 1) return { label: 'Critical', tone: 'text-signal-red' };
  if (minimum <= 2) return { label: 'Strained', tone: 'text-compass' };
  return { label: 'Stable', tone: 'text-oxide-green' };
}

export default function HelpControl({
  currentPlayerID,
  currentLocation,
  helperStats,
  crew = [],
  onSubmit,
  disabled,
}) {
  const helper = useMemo(() => ({
    ...(crew.find((player) => playerNumber(player) === Number(currentPlayerID)) || {}),
    playerID: Number(currentPlayerID),
    currentZone: currentLocation,
    ...helperStats,
  }), [crew, currentLocation, currentPlayerID, helperStats]);
  const targets = useMemo(
    () => rankHelpTargets({ helper, crew, currentLocation }),
    [crew, currentLocation, helper],
  );
  const [targetPID, setTargetPID] = useState('');
  const [selectedStat, setSelectedStat] = useState('');
  const selectedTarget = targets.find((player) => playerNumber(player) === Number(targetPID));
  const reachableTargets = targets.filter((player) => playerLocation(player) === String(currentLocation || ''));

  useEffect(() => {
    if (selectedTarget) return;
    const firstTarget = reachableTargets[0];
    setTargetPID(firstTarget ? String(playerNumber(firstTarget)) : '');
  }, [reachableTargets, selectedTarget]);

  useEffect(() => {
    if (!selectedTarget) {
      setSelectedStat('');
      return;
    }
    const currentPreview = getHelpTargetState({
      helper,
      target: selectedTarget,
      stat: selectedStat,
      currentLocation,
    });
    if (!currentPreview.valid) {
      setSelectedStat(recommendedHelpStat({ helper, target: selectedTarget, currentLocation }));
    }
  }, [currentLocation, helper, selectedStat, selectedTarget]);

  const preview = getHelpTargetState({
    helper,
    target: selectedTarget,
    stat: selectedStat,
    currentLocation,
  });

  return (
    <div className="space-y-3">
      <div className="rounded border border-compass/30 bg-compass/5 px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
          Shared momentum
        </p>
        <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
          Give 1 selected stat. Your teammate restores 2 there and 1 in both other stats - enough to rally before the next hazard.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Choose teammate
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
            {reachableTargets.length} in reach
          </p>
        </div>
        {targets.length === 0 ? (
          <p className="rounded border border-exp-border/70 bg-exp-dark/35 px-3 py-2 font-mono text-xs text-exp-text-dim">
            No other active explorers are in this expedition.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {targets.map((player) => {
              const pid = playerNumber(player);
              const reachable = playerLocation(player) === String(currentLocation || '');
              const condition = targetCondition(player);
              const selected = pid === Number(targetPID);
              return (
                <button
                  type="button"
                  key={pid}
                  disabled={!reachable || disabled}
                  onClick={() => {
                    setTargetPID(String(pid));
                    setSelectedStat('');
                  }}
                  className={`rounded border px-3 py-2 text-left transition-colors ${
                    selected
                      ? 'border-compass/55 bg-compass/10'
                      : 'border-exp-border/70 bg-exp-dark/35 hover:border-compass/30'
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-exp-text">
                      P{pid} {player.playerAddress ? truncateAddress(player.playerAddress) : ''}
                    </span>
                    <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${condition.tone}`}>
                      {reachable ? condition.label : 'Out of reach'}
                    </span>
                  </span>
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-exp-text-dim">
                    M {player.movement ?? 0} / A {player.agility ?? 0} / D {player.dexterity ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
          Choose stat
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {HELP_STAT_KEYS.map((stat) => {
            const optionPreview = getHelpTargetState({ helper, target: selectedTarget, stat, currentLocation });
            return (
              <button
                type="button"
                key={stat}
                onClick={() => setSelectedStat(stat)}
                disabled={disabled || !optionPreview.valid}
                title={optionPreview.reason || `${optionPreview.statLabel}: you ${optionPreview.helperBefore} to ${optionPreview.helperAfter}; P${optionPreview.targetID} ${optionPreview.targetBefore} to ${optionPreview.targetAfter}`}
                className={`rounded border px-3 py-2 text-left transition-colors ${
                  selectedStat === stat
                    ? 'border-blueprint/55 bg-blueprint/10 text-blueprint'
                    : 'border-exp-border/70 bg-exp-dark/35 text-exp-text hover:border-blueprint/30'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className="block font-mono text-[10px] uppercase tracking-[0.18em]">
                  {statLabelFor(stat)}
                </span>
                <span className="mt-1 block font-mono text-[10px] text-exp-text-dim">
                  You {optionPreview.helperBefore} to {optionPreview.helperAfter} / P{optionPreview.targetID || '-'} {optionPreview.targetBefore} to {optionPreview.targetAfter}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedTarget && selectedStat && (
        <div className={`rounded border px-3 py-2 ${
          preview.valid
            ? preview.isRescue
              ? 'border-oxide-green/45 bg-oxide-green/10'
              : 'border-blueprint/35 bg-blueprint/5'
            : 'border-signal-red/35 bg-signal-red/5'
        }`} role="status">
          <p className={`font-mono text-[10px] uppercase tracking-[0.24em] ${preview.valid ? 'text-oxide-green' : 'text-signal-red'}`}>
            {preview.valid ? (preview.isRescue ? 'Rescue ready' : 'Support ready') : 'Cannot help yet'}
          </p>
          <p className="mt-1 font-mono text-xs text-exp-text">
            {preview.valid
              ? `You: ${preview.statLabel} ${preview.helperBefore} to ${preview.helperAfter}. P${preview.targetID}: ${preview.statLabel} ${preview.targetBefore} to ${preview.targetAfter}, plus 1 in both other stats. Crew gains ${preview.crewGain}.`
              : preview.reason}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (preview.valid) onSubmit(String(preview.targetID), preview.statLabel, preview);
        }}
        disabled={disabled || !preview.valid}
        className="rounded border border-compass/45 bg-compass/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-compass-bright transition-colors hover:border-compass/65 hover:bg-compass/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {preview.valid && preview.isRescue ? `Rescue P${preview.targetID}` : 'Help Explorer'}
      </button>
    </div>
  );
}
