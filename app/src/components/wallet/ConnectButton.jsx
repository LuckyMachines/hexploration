import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <button
        onClick={() => disconnect()}
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
    <button
      onClick={() => connect({ connector: injected() })}
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
  );
}
