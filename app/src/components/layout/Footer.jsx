import { useWallet } from '../../contexts/WalletContext';
import { Link } from 'react-router-dom';
import { internalToolsEnabled } from '../../lib/internalTools';

export default function Footer() {
  const { chain, isConnected } = useWallet();
  const links = internalToolsEnabled() ? [
    ['/play', 'Preview'],
    ['/scenarios', 'Scenarios'],
    ['/challenge', 'Challenge'],
    ['/progress', 'Progress'],
  ] : [];

  return (
    <footer className="mt-auto border-t border-exp-border bg-exp-surface/70">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="font-display text-xl font-semibold uppercase tracking-[0.22em] text-compass">Xenovoya</p>
          <p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-exp-text-dim">
            Cooperative on-chain hex exploration where crews chart an alien grid, share discoveries, and escape together.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-2">
            {links.map(([to, label]) => (
              <Link key={to} to={to} className="inline-flex min-h-11 items-center rounded border border-exp-border/75 bg-exp-dark/35 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim hover:border-compass/40 hover:text-exp-text">
                {label}
              </Link>
            ))}
            <a href="/#live-expedition" className="inline-flex min-h-11 items-center rounded border border-compass/45 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright hover:border-compass/70">
              Live lobby
            </a>
            <Link to="/privacy" className="inline-flex min-h-11 items-center rounded border border-exp-border/75 bg-exp-dark/35 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim hover:border-compass/40 hover:text-exp-text">
              Data &amp; privacy
            </Link>
          </nav>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">
            {isConnected && chain ? `${chain.name} // Chain ${chain.id}` : 'Public discovery mode'}
          </span>
        </div>
      </div>
    </footer>
  );
}
