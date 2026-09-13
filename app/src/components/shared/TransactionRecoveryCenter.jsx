import { useMemo } from 'react';
import { usePlayerSession } from '../../contexts/PlayerSessionContext';
import { useWallet } from '../../contexts/WalletContext';
import { getChainById } from '../../config/chains';
import { useWalletCapabilities } from '../../hooks/useWalletCapabilities';
import { isTransactionActive, transactionExplorerUrl } from '../../lib/transactionExperience';
import { truncateAddress } from '../../lib/formatting';

const STATUS_LABELS = {
  confirming: 'Confirming',
  submitted: 'Broadcast',
  replaced: 'Replaced',
  confirmed: 'Confirmed',
  reverted: 'Reverted',
  failed: 'Failed safely',
  unresolved: 'Checking receipt',
};

const STATUS_GUIDANCE = {
  confirming: 'Sent - waiting for final confirmation',
  submitted: 'Sent - safe to leave this panel open or return later',
  replaced: 'Updated by your wallet - tracking the replacement',
  confirmed: 'Final on-chain - authoritative state will refresh',
  reverted: 'Not applied - chain state stayed unchanged',
  failed: 'Not submitted - the planned action can be retried',
  unresolved: 'Sent - receipt recovery continues after reload',
};

function relativeReceiptTime(value) {
  const elapsed = Date.now() - Date.parse(value || '');
  if (!Number.isFinite(elapsed) || elapsed < 0) return '';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export default function TransactionRecoveryCenter() {
  const { state } = usePlayerSession();
  const { isConnected } = useWallet();
  const capabilities = useWalletCapabilities();
  const transactions = useMemo(
    () => [...state.pendingTransactions].sort((left, right) => Date.parse(right.recordedAt || 0) - Date.parse(left.recordedAt || 0)).slice(0, 5),
    [state.pendingTransactions],
  );
  const activeCount = transactions.filter((transaction) => isTransactionActive(transaction.status)).length;
  const protocolDelegationEnabled = import.meta.env.VITE_CONTROLLER_SUPPORTS_DELEGATION === 'true';
  const acceleration = !isConnected
    ? 'Read only'
    : protocolDelegationEnabled && capabilities.canDelegate
      ? 'Session permission available'
      : protocolDelegationEnabled && capabilities.canSponsor
        ? 'Sponsorship available'
        : 'Direct authorization';

  return (
    <details className="w-full border-t border-exp-border/60 pt-2" data-testid="transaction-recovery-center">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-exp-text-dim">
        <span>On-chain action center</span>
        <span className={activeCount ? 'text-compass-bright' : 'text-oxide-green'}>
          {activeCount ? `${activeCount} recovering` : acceleration}
        </span>
      </summary>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
        <div className="rounded border border-exp-border/70 bg-exp-dark/45 px-3 py-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-blueprint">Authorization</p>
          <p className="mt-1 font-mono text-xs text-exp-text">{acceleration}</p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            {!isConnected
              ? 'Public chain state remains available without connecting.'
              : protocolDelegationEnabled
                ? 'This controller can accept scoped session signatures; direct authorization remains the safe fallback.'
                : capabilities.canBatch || capabilities.canSponsor || capabilities.canDelegate
                  ? 'Your wallet advertises acceleration, but this controller release still requires the registered player to authorize each action.'
                  : 'Each state-changing action is simulated first, then explicitly signed by the registered player.'}
          </p>
        </div>
        <div className="rounded border border-exp-border/70 bg-exp-dark/45 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-blueprint">Recoverable receipts</p>
            <span className="font-mono text-[11px] text-exp-text-dim">Stored on this device</span>
          </div>
          {transactions.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-exp-text-dim">No recent actions. New receipts survive reloads and reconnect automatically.</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {transactions.map((transaction) => {
                const chain = getChainById(transaction.chainId);
                const explorer = transactionExplorerUrl(chain, transaction.hash);
                return (
                  <div key={transaction.hash} className="border-t border-exp-border/40 pt-2 font-mono text-[11px]">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={isTransactionActive(transaction.status) ? 'text-compass-bright' : transaction.status === 'confirmed' ? 'text-oxide-green' : 'text-signal-red'}>
                        {STATUS_LABELS[transaction.status] || transaction.status}
                      </span>
                      <span className="text-exp-text">{transaction.actionLabel || 'Expedition action'}</span>
                      <span className="text-exp-text-dim">{relativeReceiptTime(transaction.recordedAt || transaction.submittedAt)}</span>
                      {explorer && <a href={explorer} target="_blank" rel="noreferrer" className="ml-auto text-blueprint underline decoration-blueprint/40 underline-offset-4">View proof {truncateAddress(transaction.hash)}</a>}
                    </div>
                    <p className="mt-1 leading-relaxed text-exp-text-dim">{STATUS_GUIDANCE[transaction.status] || 'The receipt remains available on this device.'}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
