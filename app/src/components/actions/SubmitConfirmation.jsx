import Modal from '../shared/Modal';

export default function SubmitConfirmation({
  submission,
  routeStatus,
  traitPreview,
  isOpen,
  onCancel,
  onConfirm,
}) {
  if (!submission) return null;

  return (
    <Modal isOpen={isOpen} onClose={onCancel} ariaLabel="Confirm turn action">
      <div className="space-y-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
            Confirm turn action
          </p>
          <h2 className="mt-1 font-display text-xl uppercase tracking-[0.18em] text-compass-bright">
            {submission.drama?.title || submission.label}
          </h2>
          <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">
            {submission.drama?.body || 'This sends an on-chain transaction and locks the selected action for the turn.'}
          </p>
        </div>

        {submission.drama && (
          <div className={`rounded border px-3 py-2 ${
            submission.drama.riskScore >= 72
              ? 'alive-risk-redline border-signal-red/40 bg-signal-red/10 text-signal-red'
              : 'border-compass/30 bg-compass/5 text-compass-bright'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] opacity-80">
                {submission.drama.label}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-80">
                {submission.drama.riskLabel} / {submission.drama.cue}
              </p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded bg-exp-dark/60">
              <div
                className={submission.drama.riskScore >= 72 ? 'h-full rounded bg-signal-red' : 'h-full rounded bg-compass-bright'}
                style={{ width: `${submission.drama.riskScore}%` }}
              />
            </div>
          </div>
        )}

        {traitPreview?.trait && (
          <div className={`rounded border px-3 py-2 ${
            traitPreview.effect?.warning
              ? 'alive-risk-redline border-signal-red/40 bg-signal-red/10 text-signal-red'
              : traitPreview.effect?.matched
                ? 'border-oxide-green/35 bg-oxide-green/5 text-oxide-green'
                : 'border-blueprint/35 bg-blueprint/5 text-blueprint'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.26em] opacity-80">
                Tile consequence
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-80">
                {traitPreview.trait.label}
              </p>
            </div>
            <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">
              {traitPreview.body}
            </p>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded border border-exp-border bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
              Options
            </p>
            <p className="mt-1 font-mono text-xs text-exp-text">
              {submission.options.length > 0 ? submission.options.join(' -> ') : 'None'}
            </p>
          </div>
          <div className="rounded border border-exp-border bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
              Route
            </p>
            <p className={`mt-1 font-mono text-xs ${routeStatus?.isValid === false ? 'text-signal-red' : 'text-compass-bright'}`}>
              {routeStatus?.label || 'No route data'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-exp-border pt-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-exp-border px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-exp-text-dim hover:border-exp-text-dim/50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded border border-compass/45 bg-compass/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-compass-bright hover:bg-compass/15"
          >
            Send Transaction
          </button>
        </div>
      </div>
    </Modal>
  );
}
