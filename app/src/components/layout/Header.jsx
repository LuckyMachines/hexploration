import { lazy, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ConnectButton from '../wallet/ConnectButton';
import NetworkBadge from '../wallet/NetworkBadge';
import HelpButton from '../help/HelpButton';
import ScaleControl from './ScaleControl';
import AudioControls from '../audio/AudioControls';
import { useWallet } from '../../contexts/WalletContext';
import { internalToolsEnabled } from '../../lib/internalTools';

const AutomationStatus = lazy(() => import('../shared/AutomationStatus'));

export default function Header({ onHelpClick, audio }) {
  const { isConnected } = useWallet();
  const { pathname } = useLocation();
  const publicLinks = internalToolsEnabled() ? [
    ['/', 'Home'],
    ['/play', 'Preview'],
    ['/scenarios', 'Scenarios'],
    ['/challenge', 'Challenge'],
    ['/progress', 'Progress'],
  ] : [['/', 'Home']];

  return (
    <header className="border-b border-exp-border bg-exp-surface/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto min-h-[60px] px-4 py-[8px] sm:min-h-14 sm:px-6 sm:py-2 flex items-center gap-2 sm:gap-3 flex-nowrap">
        <Link to="/" className="flex min-h-[44px] items-center gap-2 shrink-0 sm:min-h-11">
          <span className="text-[16px] sm:text-xl font-bold tracking-[0.22em] sm:tracking-[0.3em] text-compass font-display uppercase">
            Xenovoya
          </span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3 flex-wrap">
          <nav aria-label="Player navigation" className="hidden max-w-full min-w-0 items-center gap-1.5 overflow-x-auto sm:flex">
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
                <Link key={to} to={to} aria-current={isActive ? 'page' : undefined} className={`inline-flex min-h-11 items-center rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${className}`}>
                  {label}
                </Link>
              );
            })}
          </nav>
          {!internalToolsEnabled() && (
            <a href="/#live-expedition" className="hidden min-h-11 items-center rounded border border-compass/45 bg-compass/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-compass-bright sm:inline-flex">
              Live lobby
            </a>
          )}
          {audio && (
            <div className="hidden md:block">
              <AudioControls
                musicEnabled={audio.musicEnabled}
                sfxEnabled={audio.sfxEnabled}
                musicBlocked={audio.musicBlocked}
                musicTrack={audio.musicTrack}
                musicDirectorState={audio.musicDirectorState}
                onMusicToggle={audio.toggleMusic}
                onSfxToggle={audio.toggleSfx}
              />
            </div>
          )}
          <HelpButton onClick={onHelpClick} />
          <ScaleControl />
          {isConnected && (
            <div className="hidden lg:block">
              <Suspense fallback={null}><AutomationStatus /></Suspense>
            </div>
          )}
          {isConnected && <NetworkBadge />}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
