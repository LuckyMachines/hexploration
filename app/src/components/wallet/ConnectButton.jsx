import { useWallet } from '../../contexts/WalletContext';
import { useState } from 'react';

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ConnectButton() {
  const { address, isConnected, connect, disconnect } = useWallet();
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setError('');
    try {
      await connect();
    } catch (err) {
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
          px-4 py-2 rounded
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
          text-compass font-display font-semibold text-sm tracking-widest uppercase
          px-5 py-2 rounded
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
