import { ProcessingPhase, PROCESSING_LABELS } from '../../lib/constants';
import { useAutomationStatus } from '../../hooks/useAutomationStatus';
import Spinner from '../shared/Spinner';

function formatTime(ts) {
  if (!ts) return '--:--:--';
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function TurnTimeline({ queueTelemetry, events = [] }) {
  const { mode } = useAutomationStatus();
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const phaseLabel = PROCESSING_LABELS[queueTelemetry.phase] || 'Unknown';

  const isProcessing = queueTelemetry.phase === ProcessingPhase.PROCESSING
    || queueTelemetry.phase === ProcessingPhase.PLAY_THROUGH;
  const isWaitingForSubmissions = queueTelemetry.phase === ProcessingPhase.SUBMISSION
    && queueTelemetry.submittedCount > 0
    && queueTelemetry.submittedCount < queueTelemetry.totalPlayers;

  return (
    <div className="border border-exp-border rounded bg-exp-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
          Turn Timeline
        </h3>
        <span className="font-mono text-xs uppercase tracking-wider text-exp-text-dim">
          Queue #{queueTelemetry.queueID.toString()}
        </span>
      </div>

      <div className="grid sm:grid-cols-4 gap-2">
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="font-mono text-xs text-exp-text-dim uppercase">Phase</div>
          <div className="font-mono text-xs text-compass">{phaseLabel}</div>
        </div>
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="font-mono text-xs text-exp-text-dim uppercase">Submissions</div>
          <div className="font-mono text-xs text-compass">
            {queueTelemetry.submittedCount}/{queueTelemetry.totalPlayers}
          </div>
        </div>
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="font-mono text-xs text-exp-text-dim uppercase">Randomness</div>
          <div className="font-mono text-xs text-compass">{queueTelemetry.randomnessCount} words</div>
        </div>
        <div className="border border-exp-border/60 rounded bg-exp-dark/40 px-2 py-1.5">
          <div className="font-mono text-xs text-exp-text-dim uppercase">VRF Mode</div>
          <div className="font-mono text-xs text-compass">{mode}</div>
        </div>
      </div>

      {isProcessing && (
        <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded border border-compass/30 bg-compass/5">
          <Spinner size="w-3 h-3" />
          <span className="font-mono text-xs text-compass tracking-wider uppercase">
            Processing turn — worker is advancing the game loop...
          </span>
        </div>
      )}

      {isWaitingForSubmissions && (
        <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded border border-blueprint/30 bg-blueprint/5">
          <span className="w-1.5 h-1.5 rounded-full bg-blueprint animate-pulse" />
          <span className="font-mono text-xs text-blueprint tracking-wider uppercase">
            Waiting for {queueTelemetry.totalPlayers - queueTelemetry.submittedCount} more player{queueTelemetry.totalPlayers - queueTelemetry.submittedCount !== 1 ? 's' : ''} to submit actions
          </span>
        </div>
      )}

      <div className="mt-2 font-mono text-xs text-exp-text-dim">
        Last event: {latestEvent ? `${latestEvent.name} @ block ${latestEvent.blockNumber?.toString?.() || latestEvent.blockNumber} (${formatTime(latestEvent.timestamp)})` : 'No events yet'}
      </div>
    </div>
  );
}
