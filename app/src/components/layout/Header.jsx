import { Link } from 'react-router-dom';
import ConnectButton from '../wallet/ConnectButton';
import NetworkBadge from '../wallet/NetworkBadge';
import HelpButton from '../help/HelpButton';
import ScaleControl from './ScaleControl';
import AutomationStatus from '../shared/AutomationStatus';

export default function Header({ onHelpClick }) {
  return (
    <header className="border-b border-exp-border bg-exp-surface/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-14 py-2 flex items-center justify-between gap-3 flex-wrap">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-lg sm:text-xl font-bold tracking-[0.3em] text-compass font-display uppercase">
            Xenovoya
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Link to="/play" className="rounded border border-compass/30 bg-compass/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">
            Play
          </Link>
          <Link to="/challenge" className="rounded border border-blueprint/30 bg-blueprint/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">
            Challenge
          </Link>
          <HelpButton onClick={onHelpClick} />
          <ScaleControl />
          <AutomationStatus />
          <NetworkBadge />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
