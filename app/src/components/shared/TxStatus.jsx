import { useEffect, useRef } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { trackUXError, trackUXRecovery } from '../../lib/uxTelemetry';
import { normalizeTransactionError, transactionExplorerUrl } from '../../lib/transactionExperience';

const PHASE_COPY = {
  simulating: ['Checking chain rules', 'No signature yet. The contract is validating this exact action.'],
  ready: ['Ready to sign', 'The latest chain state accepts this action.'],
  awaiting_signature: ['Awaiting signature', 'Approve this action in your wallet. Nothing is submitted until you sign.'],
  submitted: ['Broadcast to network', 'The signed action has been sent.'],
  confirming: ['Confirming on-chain', 'The optimistic board remains visible while finality settles.'],
  replaced: ['Transaction updated', 'Your wallet replaced the original transaction and tracking followed it automatically.'],
  confirmed: ['Confirmed', 'The action is final and the board is refreshing from authoritative state.'],
  reverted: ['Reverted', 'Chain state was unchanged. Your planned action remains available to revise.'],
  failed: ['Not submitted', 'Chain state was unchanged. Review the recovery detail below.'],
  unresolved: ['Receipt recovery active', 'The action was broadcast, but confirmation is not visible yet. This device will keep checking safely.'],
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
  const { chain } = useWallet();
  const phase = lifecycle?.phase || fallbackPhase({ isPending, isConfirming, isSuccess, error });
  const normalizedError = lifecycle?.error || normalizeTransactionError(error);
  const explorerUrl = transactionExplorerUrl(chain, hash);

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
        {hash && <span className="text-exp-text-dim">{hash.slice(0, 6)}...{hash.slice(-4)}</span>}
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noreferrer" className="ml-auto text-blueprint underline decoration-blueprint/40 underline-offset-4">
            View proof
          </a>
        )}
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
