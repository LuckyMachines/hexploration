import { TurnState } from '../../lib/turnState';

function toneForTurnState(turnState) {
  if (turnState?.state === TurnState.SPECTATING) return 'neutral';
  if (turnState?.state === TurnState.RESOLVING) return 'blue';
  if (turnState?.state === TurnState.SUBMITTED || turnState?.state === TurnState.WAITING_CREW) return 'green';
  if (turnState?.state === TurnState.COMPLETE) return 'blue';
  return 'gold';
}

export default function MissionStatus({
  turnState,
  movePathLength = 0,
  moveValidation,
  crewCount = 0,
}) {
  const label = movePathLength > 0 && turnState?.state === TurnState.PLANNING
    ? 'Route Planned'
    : turnState?.label || 'Planning';
  const body = movePathLength > 0 && turnState?.state === TurnState.PLANNING
    ? (moveValidation?.ok
      ? 'Review the highlighted route. If it reveals enough without stranding you, submit from the Action Console.'
      : moveValidation?.reason || 'Adjust the route before submitting.')
    : turnState?.copy || 'Chart useful ground, protect the route home, and choose when to depart.';
  const toneClass = {
    gold: 'border-compass/40 bg-compass/10 text-compass-bright',
    green: 'border-oxide-green/40 bg-oxide-green/10 text-oxide-green',
    blue: 'border-blueprint/40 bg-blueprint/10 text-blueprint',
    neutral: 'border-exp-border bg-exp-dark/35 text-exp-text-dim',
  }[toneForTurnState(turnState)];

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded border border-exp-border bg-exp-panel/85 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-exp-text-dim">
            Current objective
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {body}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            data-testid="turn-state"
            className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.28em] ${toneClass}`}
          >
            {label}
          </span>
          <span className="rounded border border-exp-border bg-exp-dark/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-exp-text-dim">
            {turnState?.phaseLabel || 'Unknown'}
          </span>
          <span className="rounded border border-exp-border bg-exp-dark/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-exp-text-dim">
            {crewCount} aboard
          </span>
        </div>
      </div>
    </div>
  );
}
