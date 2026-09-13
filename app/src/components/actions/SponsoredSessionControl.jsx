import TxStatus from '../shared/TxStatus';

export default function SponsoredSessionControl({ sponsored }) {
  if (!sponsored.configured) return null;
  const remaining = sponsored.authorization?.remainingActions || 0;
  const expiresAt = sponsored.authorization?.expiresAt
    ? new Date(sponsored.authorization.expiresAt * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const busy = sponsored.authorizationTx.isPending || sponsored.authorizationTx.isConfirming;
  const now = Math.floor(Date.now() / 1000);
  const recovery = sponsored.relayError
    ? 'Sponsor relay is unavailable. Your action is preserved; use the direct wallet action below.'
    : sponsored.relay?.paused
      ? 'Sponsored turns are paused by the relay. Direct wallet actions remain available.'
      : sponsored.relayMatches === false
        ? 'The relay does not match this expedition. Sponsored signing is disabled; direct wallet actions remain available.'
        : sponsored.session && sponsored.authorization?.expiresAt <= now
          ? 'This scoped authorization expired safely. Renew it or continue with direct wallet actions.'
          : sponsored.session && sponsored.authorization?.remainingActions === 0
            ? 'The sponsored-turn allowance is used up. Renew it or continue with direct wallet actions.'
            : sponsored.relayStatus === 'pending'
              ? 'Checking sponsor capacity. Direct wallet actions remain available while this loads.'
              : '';

  return (
    <div className={`player-readable mx-4 mt-3 rounded border px-3 py-3 ${sponsored.isReady ? 'border-oxide-green/35 bg-oxide-green/5' : 'border-blueprint/30 bg-blueprint/5'}`} data-testid="sponsored-session-control">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-blueprint">Gas-sponsored turns</p>
          <p className="mt-1 font-mono text-xs text-exp-text">
            {sponsored.isReady ? `${remaining} sponsored turns remain - expires ${expiresAt}` : 'Approve one scoped session to play without repeated wallet popups.'}
          </p>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-exp-text-dim">
            The temporary key stays in this browser tab and works only for this board and expedition. It expires within eight hours and can be revoked at any time.
          </p>
        </div>
        {sponsored.isReady ? (
          <button type="button" onClick={() => sponsored.revoke().catch(() => {})} disabled={busy} className="min-h-11 rounded border border-signal-red/35 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal-red disabled:opacity-40">
            Revoke sponsored turns
          </button>
        ) : (
          <button type="button" onClick={() => sponsored.authorize().catch(() => {})} disabled={busy || sponsored.relayStatus === 'pending' || sponsored.relay?.paused || sponsored.relayMatches === false} className="min-h-11 rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint disabled:opacity-40">
            {busy ? 'Approving...' : 'Enable sponsored turns'}
          </button>
        )}
      </div>
      {recovery && <p className="mt-2 rounded border border-signal-red/30 bg-exp-dark/35 px-3 py-2 font-mono text-[11px] leading-relaxed text-signal-red" role="status">{recovery}</p>}
      {(sponsored.authorizationTx.data || busy || sponsored.authorizationTx.error) && (
        <div className="mt-2">
          <TxStatus
            hash={sponsored.authorizationTx.data}
            isPending={sponsored.authorizationTx.isPending}
            isConfirming={sponsored.authorizationTx.isConfirming}
            isSuccess={sponsored.authorizationTx.isSuccess}
            error={sponsored.authorizationTx.error}
            lifecycle={sponsored.authorizationTx.lifecycle}
          />
        </div>
      )}
    </div>
  );
}
