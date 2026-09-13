import { useWallet } from '../../contexts/WalletContext';
import { SUPPORTED_CHAINS } from '../../config/chains';
import { getRuntimeMode } from '../../lib/runtimeMode';
import { useState } from 'react';

export default function NetworkBadge() {
  const { chain, isConnected, switchChain, isSwitching: isPending } = useWallet();
  const targetChain = getRuntimeMode().chain;
  const [switchError, setSwitchError] = useState('');

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 text-xs font-mono text-exp-text-dim">
        <span className="inline-block w-2 h-2 rounded-full bg-signal-red shadow-[0_0_4px_var(--color-signal-red)]" />
        <span className="tracking-wider uppercase">Disconnected</span>
      </div>
    );
  }

  const isSupported = chain && SUPPORTED_CHAINS.some((c) => c.id === chain.id);
  const isCorrectChain = isSupported && chain.id === targetChain.id;
  const handleSwitch = async () => {
    setSwitchError('');
    try {
      await switchChain({ chainId: targetChain.id });
    } catch (error) {
      setSwitchError(error?.code === 4001 || /reject|denied/i.test(error?.message || '')
        ? `Switch cancelled. Your action is preserved; switch to ${targetChain.name} when ready.`
        : `Could not switch automatically. Open your wallet and select ${targetChain.name}, then retry.`);
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      <span
        className={`
          inline-block w-2 h-2 rounded-full
          ${isCorrectChain ? 'bg-oxide-green shadow-[0_0_4px_var(--color-oxide-green)]' : 'bg-signal-red shadow-[0_0_4px_var(--color-signal-red)]'}
        `}
      />

      {isCorrectChain ? (
        <span className="inline-flex min-h-11 items-center rounded border border-exp-border px-3 font-mono text-xs uppercase tracking-wider text-exp-text-dim">{chain.name}</span>
      ) : (
        <button
          onClick={handleSwitch}
          disabled={isPending}
          className="
            border border-signal-red/50 bg-signal-red/10 rounded
            text-xs font-mono text-signal-red tracking-wider uppercase
            min-h-11 px-3 py-1 cursor-pointer
            hover:bg-signal-red/20 transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
          "
        >
          {isPending ? 'Switching...' : `Switch to ${targetChain.name}`}
        </button>
      )}
      {switchError && <p className="absolute right-0 top-full z-40 mt-2 w-80 rounded border border-signal-red/40 bg-exp-dark px-3 py-2 font-mono text-xs normal-case tracking-normal text-signal-red" role="alert">{switchError}</p>}
    </div>
  );
}
