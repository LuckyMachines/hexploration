import { Link } from 'react-router-dom';
import ConnectButton from '../wallet/ConnectButton';
import NetworkBadge from '../wallet/NetworkBadge';
import HelpButton from '../help/HelpButton';
import ScaleControl from './ScaleControl';
import AutomationStatus from '../shared/AutomationStatus';
import { useWallet } from '../../contexts/WalletContext';

export default function Header({ onHelpClick }) {
  const { isConnected } = useWallet();
  const publicLinks = [
    ['/', 'Home'],
    ['/play', 'Play'],
    ['/scenarios', 'Scenarios'],
    ['/challenge', 'Challenge'],
    ['/devlog', 'Devlog'],
    ['/simulator', 'Simulator'],
  ];

  return (
    <header className="border-b border-exp-border bg-exp-surface/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-14 py-2 flex items-center justify-between gap-3 flex-wrap">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-lg sm:text-xl font-bold tracking-[0.3em] text-compass font-display uppercase">
            Xenovoya
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <nav className="flex items-center gap-1.5 overflow-x-auto">
            {publicLinks.map(([to, label]) => (
              <Link key={to} to={to} className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
                label === 'Play'
                  ? 'border-compass/35 bg-compass/5 text-compass-bright'
                  : label === 'Challenge'
                    ? 'border-blueprint/35 bg-blueprint/5 text-blueprint'
                    : 'border-exp-border/75 bg-exp-dark/30 text-exp-text-dim hover:border-compass/40 hover:text-exp-text'
              }`}>
                {label}
              </Link>
            ))}
          </nav>
          <HelpButton onClick={onHelpClick} />
          <ScaleControl />
          {isConnected && <AutomationStatus />}
          {isConnected && <NetworkBadge />}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
