import { truncateAddress } from '../../lib/formatting';

export default function ReceiptDrawer({
  submission,
  hash,
  isPending,
  isConfirming,
  isSuccess,
  error,
}) {
  if (!submission && !hash && !isPending && !isConfirming && !isSuccess && !error) return null;

  const state = error
    ? 'Failed'
    : isSuccess
      ? 'Confirmed'
      : isConfirming
        ? 'Confirming'
        : isPending
          ? 'Signature'
          : 'Prepared';

  return (
    <details open className="rounded border border-blueprint/25 bg-blueprint/5 px-4 py-3">
      <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.28em] text-blueprint">
        Action receipt
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim">State</p>
          <p className="mt-1 font-mono text-xs text-exp-text">{state}</p>
        </div>
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim">Action</p>
          <p className="mt-1 font-mono text-xs text-compass-bright">{submission?.label || 'Pending'}</p>
        </div>
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim">Tx</p>
          <p className="mt-1 font-mono text-xs text-blueprint">{hash ? truncateAddress(hash) : 'Not sent'}</p>
        </div>
      </div>
      {submission?.options?.length > 0 && (
        <p className="mt-2 font-mono text-[11px] text-exp-text-dim">
          Options: {submission.options.join(' -> ')}
        </p>
      )}
      {submission?.drama && (
        <div className="mt-3 rounded border border-compass/25 bg-compass/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
            {submission.drama.title}
          </p>
          <p className="mt-1 font-mono text-[11px] text-exp-text">
            {submission.drama.receipt}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
            Cue hook: {submission.drama.cue}
          </p>
        </div>
      )}
      {error && (
        <p className="mt-2 break-all font-mono text-[11px] text-signal-red">
          {error.shortMessage || error.message || String(error)}
        </p>
      )}
    </details>
  );
}
