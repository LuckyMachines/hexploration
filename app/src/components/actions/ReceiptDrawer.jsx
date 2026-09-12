import { truncateAddress } from '../../lib/formatting';
import { getDefaultChainId } from '../../config/clients';
import { getChainById } from '../../config/chains';
import { formatEstimatedGas, transactionExplorerUrl } from '../../lib/transactionExperience';

export default function ReceiptDrawer({
  submission,
  hash,
  isPending,
  isConfirming,
  isSuccess,
  error,
  simulation,
  lifecycle,
}) {
  if (!submission && !hash && !isPending && !isConfirming && !isSuccess && !error) return null;
  const chain = getChainById(lifecycle?.chainId || getDefaultChainId());

  const state = lifecycle?.phase === 'simulating'
    ? 'Preflight'
    : lifecycle?.phase === 'awaiting_signature'
      ? 'Signature'
      : error
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
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.15em] text-exp-text-dim">
        <span>Preflight: {simulation?.status === 'ready' ? 'passed' : simulation?.status || 'not run'}</span>
        {simulation?.estimatedGas != null && <span>Estimate: {formatEstimatedGas(simulation.estimatedGas)}</span>}
        {hash && transactionExplorerUrl(chain, hash) && (
          <a href={transactionExplorerUrl(chain, hash)} target="_blank" rel="noreferrer" className="text-blueprint underline decoration-blueprint/40 underline-offset-4">
            Open chain receipt
          </a>
        )}
      </div>
      {(isPending || isConfirming) && submission && (
        <p className="mt-2 rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-blueprint">
          Optimistic intent is visible now. Authoritative stats and turn state update only after confirmation.
        </p>
      )}
      {submission?.options?.length > 0 && (
        <p className="mt-2 font-mono text-[11px] text-exp-text-dim">
          Options: {submission.options.join(' -> ')}
        </p>
      )}
      {submission?.rescue && (
        <div className="mt-3 rounded border border-oxide-green/35 bg-oxide-green/10 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-oxide-green">
              {isSuccess ? 'Rescue intent confirmed' : 'Rescue intent'}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-oxide-green">
              Crew +{submission.rescue.crewGain}
            </p>
          </div>
          <p className="mt-1 font-mono text-[11px] text-exp-text">
            P{submission.rescue.helperID} {submission.rescue.statLabel} {submission.rescue.helperBefore} to {submission.rescue.helperAfter}; P{submission.rescue.targetID} rallies across all three stats when the turn resolves.
          </p>
        </div>
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
