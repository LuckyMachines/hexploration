import { Link, useLocation } from 'react-router-dom';
import HelpButton from '../help/HelpButton';
import ScaleControl from './ScaleControl';
import AudioControls from '../audio/AudioControls';
import { internalToolsEnabled } from '../../lib/internalTools';

function SettingsMenu({ audio, onHelpClick }) {
  return (
    <details className="relative shrink-0">
      <summary
        aria-label="Open player settings"
        data-testid="player-settings-toggle"
        className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded border border-exp-border bg-exp-dark/40 text-exp-text-dim transition-colors hover:border-compass/40 hover:text-exp-text [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] space-y-4 rounded border border-exp-border bg-exp-surface p-4 shadow-2xl">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">Audio</p>
          {audio ? (
            <AudioControls
              musicEnabled={audio.musicEnabled}
              sfxEnabled={audio.sfxEnabled}
              musicBlocked={audio.musicBlocked}
              musicTrack={audio.musicTrack}
              musicDirectorState={audio.musicDirectorState}
              onMusicToggle={audio.toggleMusic}
              onSfxToggle={audio.toggleSfx}
            />
          ) : <p className="font-mono text-xs text-exp-text-dim">Audio controls unavailable.</p>}
        </div>
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">Interface scale</p>
          <ScaleControl alwaysVisible />
        </div>
        <div className="flex items-center justify-between border-t border-exp-border pt-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">Field manual</span>
          <HelpButton onClick={onHelpClick} />
        </div>
      </div>
    </details>
  );
}

export default function Header({ onHelpClick, audio }) {
  const { pathname } = useLocation();
  const publicLinks = internalToolsEnabled() ? [
    ['/', 'Home'],
    ['/play', 'Preview'],
    ['/scenarios', 'Scenarios'],
    ['/challenge', 'Challenge'],
    ['/progress', 'Progress'],
  ] : [['/#play-options', 'Play'], ['/guest', 'Solo']];

  return (
    <header className="sticky top-0 z-40 border-b border-exp-border bg-exp-surface/90 backdrop-blur-md">
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
          <SettingsMenu audio={audio} onHelpClick={onHelpClick} />
        </div>
      </div>
    </header>
  );
}
