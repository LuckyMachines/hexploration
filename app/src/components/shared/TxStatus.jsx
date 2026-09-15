import { useEffect, useRef } from 'react';
import { trackUXError, trackUXRecovery } from '../../lib/uxTelemetry';
import { normalizeTransactionError } from '../../lib/transactionExperience';

const PHASE_COPY = {
  simulating: ['Checking action', 'The game is validating this exact choice.'],
  ready: ['Ready', 'The game can accept this action.'],
  awaiting_signature: ['Submitting', 'Your action is being sent securely.'],
  submitted: ['Action received', 'The game is processing your choice.'],
  confirming: ['Resolving turn', 'The current board stays visible while the result settles.'],
  replaced: ['Action updated', 'Tracking moved to the latest version automatically.'],
  confirmed: ['Complete', 'The result is final and the board is refreshing.'],
  reverted: ['Action declined', 'Nothing changed. Your planned action remains available to revise.'],
  failed: ['Could not submit', 'Nothing changed. Review the recovery detail below.'],
  unresolved: ['Recovery active', 'The result is taking longer than usual. This device will keep checking safely.'],
};

function fallbackPhase({ isPending, isConfirming, isSuccess, error }) {
  if (error) return 'failed';
  if (isSuccess) return 'confirmed';
  if (isConfirming) return 'confirming';
  if (isPending) return 'awaiting_signature';
  return 'idle';
}

export default function TxStatus({ hash, isPending, isConfirming, isSuccess, error, lifecycle }) {
  const failureRecorded = useRef(false);
  const phase = lifecycle?.phase || fallbackPhase({ isPending, isConfirming, isSuccess, error });
  const normalizedError = lifecycle?.error || normalizeTransactionError(error);

  useEffect(() => {
    if (error && !failureRecorded.current) {
      failureRecorded.current = true;
      trackUXError({ surface: 'action', errorType: 'transaction', severity: 'high' });
    } else if (isSuccess && failureRecorded.current) {
      failureRecorded.current = false;
      trackUXRecovery({ surface: 'action', recovery: 'retry' });
    }
  }, [error, isSuccess]);

  if (phase === 'idle') return null;
  const [title, body] = PHASE_COPY[phase] || PHASE_COPY.confirming;
  const failed = phase === 'failed' || phase === 'reverted';
  const success = phase === 'confirmed';

  return (
    <div
      className={`mt-3 rounded border px-3 py-3 font-mono text-xs ${
        failed
          ? 'border-signal-red/40 bg-signal-red/5'
          : success
            ? 'border-oxide-green/40 bg-oxide-green/5'
            : 'border-blueprint/35 bg-blueprint/5'
      }`}
      role="status"
      aria-live="polite"
      data-transaction-phase={phase}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${failed ? 'bg-signal-red' : success ? 'bg-oxide-green' : 'animate-pulse bg-blueprint'}`} />
        <span className={`uppercase tracking-[0.18em] ${failed ? 'text-signal-red' : success ? 'text-oxide-green' : 'text-blueprint'}`}>
          {title}
        </span>
      </div>
      <p className="mt-1 pl-4 leading-relaxed text-exp-text-dim">{body}</p>
      {normalizedError && (
        <div className="mt-2 rounded border border-signal-red/25 bg-exp-dark/35 px-3 py-2">
          <p className="text-signal-red">{normalizedError.title}</p>
          <p className="mt-1 leading-relaxed text-exp-text-dim">{normalizedError.message}</p>
        </div>
      )}
    </div>
  );
}
