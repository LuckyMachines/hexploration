import { PROCESSING_LABELS, ProcessingPhase } from '../../lib/constants';

function statusCopy({ isSpectator, hasSubmitted, queueTelemetry, movePathLength }) {
  if (isSpectator) {
    return {
      label: 'Watching',
      tone: 'neutral',
      body: 'This wallet is not on the crew. You can inspect the board and turn history.',
    };
  }

  if (queueTelemetry.phase === ProcessingPhase.PROCESSING || queueTelemetry.phase === ProcessingPhase.PLAY_THROUGH) {
    return {
      label: 'Resolving',
      tone: 'blue',
      body: 'The queue is processing submitted actions. Results will appear after the on-chain update lands.',
    };
  }

  if (hasSubmitted) {
    return {
      label: 'Submitted',
      tone: 'green',
      body: 'Your action is locked. Wait for the rest of the crew or the submission timer.',
    };
  }

  if (movePathLength > 0) {
    return {
      label: 'Route planned',
      tone: 'gold',
      body: 'Review the highlighted path, then submit from the Action Console.',
    };
  }

  return {
    label: 'Choose action',
    tone: 'gold',
    body: 'Pick a tile path or switch actions. Submit once your plan matches the board state.',
  };
}

export default function MissionStatus({
  isSpectator,
  currentAction,
  queueTelemetry,
  movePathLength = 0,
  crewCount = 0,
}) {
  const hasSubmitted = currentAction && currentAction !== '' && currentAction !== 'Idle';
  const copy = statusCopy({ isSpectator, hasSubmitted, queueTelemetry, movePathLength });
  const toneClass = {
    gold: 'border-compass/40 bg-compass/10 text-compass-bright',
    green: 'border-oxide-green/40 bg-oxide-green/10 text-oxide-green',
    blue: 'border-blueprint/40 bg-blueprint/10 text-blueprint',
    neutral: 'border-exp-border bg-exp-dark/35 text-exp-text-dim',
  }[copy.tone];
  const phaseLabel = PROCESSING_LABELS[queueTelemetry.phase] || 'Unknown';

  return (
    <div className="rounded border border-exp-border bg-exp-panel/85 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-exp-text-dim">
            Current objective
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {copy.body}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.28em] ${toneClass}`}>
            {copy.label}
          </span>
          <span className="rounded border border-exp-border bg-exp-dark/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-exp-text-dim">
            {phaseLabel}
          </span>
          <span className="rounded border border-exp-border bg-exp-dark/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.28em] text-exp-text-dim">
            {crewCount} aboard
          </span>
        </div>
      </div>
    </div>
  );
}
