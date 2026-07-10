import { Link, useLocation } from 'react-router-dom';
import ConnectButton from '../wallet/ConnectButton';
import NetworkBadge from '../wallet/NetworkBadge';
import HelpButton from '../help/HelpButton';
import ScaleControl from './ScaleControl';
import AutomationStatus from '../shared/AutomationStatus';
import AudioControls from '../audio/AudioControls';
import { useWallet } from '../../contexts/WalletContext';

export default function Header({ onHelpClick, audio }) {
  const { isConnected } = useWallet();
  const { pathname } = useLocation();
  const publicLinks = [
    ['/', 'Home'],
    ['/play', 'Play'],
    ['/scenarios', 'Scenarios'],
    ['/challenge', 'Challenge'],
    ['/progress', 'Progress'],
  ];

  return (
    <header className="border-b border-exp-border bg-exp-surface/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-14 py-2 flex items-center gap-3 flex-wrap">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-lg sm:text-xl font-bold tracking-[0.3em] text-compass font-display uppercase">
            Xenovoya
          </span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3 flex-wrap">
          <nav className="flex max-w-full min-w-0 items-center gap-1.5 overflow-x-auto">
            {publicLinks.map(([to, label]) => {
              const isActive = to === '/'
                ? pathname === '/'
                : pathname === to || pathname.startsWith(`${to}/`);
              const className = isActive
                ? label === 'Challenge'
                  ? 'border-blueprint/45 bg-blueprint/10 text-blueprint'
                  : 'border-compass/45 bg-compass/10 text-compass-bright'
                : 'border-exp-border/75 bg-exp-dark/30 text-exp-text-dim hover:border-compass/40 hover:text-exp-text';

              return (
                <Link key={to} to={to} className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${className}`}>
                  {label}
                </Link>
              );
            })}
          </nav>
          {audio && (
            <AudioControls
              musicEnabled={audio.musicEnabled}
              sfxEnabled={audio.sfxEnabled}
              musicBlocked={audio.musicBlocked}
              musicTrack={audio.musicTrack}
              musicDirectorState={audio.musicDirectorState}
              onMusicToggle={audio.toggleMusic}
              onSfxToggle={audio.toggleSfx}
            />
          )}
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
