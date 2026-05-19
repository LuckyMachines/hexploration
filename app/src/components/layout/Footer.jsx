import { useWallet } from '../../contexts/WalletContext';
import { Link } from 'react-router-dom';

export default function Footer() {
  const { chain, isConnected } = useWallet();
  const links = [
    ['/scenarios', 'Scenarios'],
    ['/challenge', 'Challenge'],
    ['/design-system', 'Design'],
    ['/simulator', 'Simulator'],
    ['/devlog', 'Devlog'],
    ['/progress', 'Progress'],
  ];

  return (
    <footer className="mt-auto border-t border-exp-border bg-exp-surface/70">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="font-display text-xl font-semibold uppercase tracking-[0.22em] text-compass">Xenovoya</p>
          <p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-exp-text-dim">
            Turn-based expedition board game with public scenarios, same-engine simulation, and live wallet-backed surveys.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <nav className="flex flex-wrap gap-2">
            {links.map(([to, label]) => (
              <Link key={to} to={to} className="rounded border border-exp-border/75 bg-exp-dark/35 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim hover:border-compass/40 hover:text-exp-text">
                {label}
              </Link>
            ))}
          </nav>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">
            {isConnected && chain ? `${chain.name} // Chain ${chain.id}` : 'Public discovery mode'}
          </span>
        </div>
      </div>
    </footer>
  );
}
