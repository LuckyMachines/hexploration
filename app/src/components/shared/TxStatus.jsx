export default function TxStatus({ hash, isPending, isConfirming, isSuccess, error }) {
  if (!isPending && !isConfirming && !isSuccess && !error) return null;

  const truncateHash = (h) => h ? `${h.slice(0, 6)}...${h.slice(-4)}` : '';

  return (
    <div className="font-mono text-xs border border-exp-border rounded bg-exp-dark/60 px-3 py-2 mt-3">
      {isPending && (
        <div className="flex items-center gap-2 text-compass">
          <span className="w-1.5 h-1.5 rounded-full bg-compass animate-pulse" />
          <span className="tracking-wider uppercase">Awaiting signature...</span>
        </div>
      )}

      {isConfirming && (
        <div className="flex items-center gap-2 text-compass">
          <span className="w-1.5 h-1.5 rounded-full bg-compass animate-pulse" />
          <span className="tracking-wider uppercase">Confirming...</span>
          {hash && (
            <span className="text-exp-text-dim ml-1">
              tx {truncateHash(hash)}
            </span>
          )}
        </div>
      )}

      {isSuccess && (
        <div className="flex items-center gap-2 text-oxide-green">
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 8 7 12 13 4" />
          </svg>
          <span className="tracking-wider uppercase">Confirmed</span>
          {hash && (
            <span className="text-exp-text-dim ml-1">
              tx {truncateHash(hash)}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="text-signal-red">
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
            <span className="tracking-wider uppercase">Failed</span>
          </div>
          <p className="text-signal-red/70 mt-1 pl-5 break-all leading-relaxed">
            {error.shortMessage || error.message}
          </p>
        </div>
      )}
    </div>
  );
}
