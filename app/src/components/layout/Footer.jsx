import { useWallet } from '../../contexts/WalletContext';

export default function Footer() {
  const { chain, isConnected } = useWallet();

  return (
    <footer className="border-t border-exp-border bg-exp-surface/60 mt-auto">
      <div className="max-w-7xl mx-auto px-6 h-10 flex items-center justify-between text-xs font-mono text-exp-text-dim">
        <span className="tracking-wider uppercase">
          {isConnected && chain ? `${chain.name} // Chain ${chain.id}` : 'No network'}
        </span>
        <span className="tracking-[0.2em] text-compass/60 uppercase font-display font-semibold">
          Hexploration
        </span>
      </div>
    </footer>
  );
}
