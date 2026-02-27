import { Link } from 'react-router-dom';
import ConnectButton from '../wallet/ConnectButton';
import NetworkBadge from '../wallet/NetworkBadge';
import HelpButton from '../help/HelpButton';
import AutomationStatus from '../shared/AutomationStatus';

export default function Header({ onHelpClick }) {
  return (
    <header className="border-b border-exp-border bg-exp-surface/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-[0.3em] text-compass font-display uppercase">
            Hexploration
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <HelpButton onClick={onHelpClick} />
          <AutomationStatus />
          <NetworkBadge />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
