import { useWallet } from '../../contexts/WalletContext';
import { useState } from 'react';
import { trackUXError, trackUXRecovery } from '../../lib/uxTelemetry';

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ConnectButton() {
  const { address, isConnected, connect, disconnect } = useWallet();
  const [error, setError] = useState('');

  const handleConnect = async () => {
    const recovering = Boolean(error);
    setError('');
    try {
      await connect();
      if (recovering) trackUXRecovery({ surface: 'lobby', recovery: 'retry' });
    } catch (err) {
      trackUXError({ surface: 'lobby', errorType: 'wallet', severity: 'high' });
      setError(err?.message === 'No wallet found'
        ? 'No wallet extension was detected. Install or unlock a wallet, then try again.'
        : err?.shortMessage || err?.message || 'Wallet connection failed.');
    }
  };

  if (isConnected) {
    return (
      <button
        onClick={() => {
          setError('');
          disconnect();
        }}
        className="
          border border-exp-border bg-exp-panel
          hover:bg-exp-surface hover:border-compass/40
          text-exp-text font-mono text-xs tracking-wider
          min-h-[44px] px-3 py-2 sm:min-h-11 sm:px-4 rounded
          transition-colors duration-150 cursor-pointer
        "
      >
        {truncateAddress(address)}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleConnect}
        className="
          border border-compass/50 bg-exp-panel
          hover:bg-compass/10 hover:border-compass
          text-compass font-display font-semibold text-[12px] sm:text-sm tracking-widest uppercase
          min-h-[44px] px-3 py-2 sm:min-h-11 sm:px-5 rounded
          transition-colors duration-150 cursor-pointer
        "
      >
        Connect
      </button>
      {error && (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded border border-signal-red/35 bg-exp-dark px-3 py-2 font-mono text-xs text-signal-red shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
