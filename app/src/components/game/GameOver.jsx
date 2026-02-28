import { Link } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { useAllPlayers } from '../../hooks/useAllPlayers';
import { truncateAddress } from '../../lib/formatting';
import { PLAYER_COLORS } from '../../lib/constants';
import Spinner from '../shared/Spinner';

export default function GameOver({ gameId }) {
  const { address } = useWallet();
  const { players, isLoading } = useAllPlayers(gameId);

  if (isLoading) {
    return (
      <div className="border border-exp-border rounded bg-exp-panel p-12 flex items-center justify-center gap-3">
        <Spinner size="w-5 h-5" />
        <span className="font-mono text-xs text-exp-text-dim tracking-wider uppercase">
          Loading expedition report...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Final Briefing Header */}
      <div className="border border-exp-border rounded bg-exp-panel overflow-hidden">
        <div className="bg-exp-dark border-b border-exp-border px-4 py-2 flex items-center justify-between">
          <span className="font-display text-xs tracking-[0.3em] text-exp-text-dim uppercase">
            Expedition Report
          </span>
          <span className="font-mono text-xs text-exp-text-dim">
            Expedition #{gameId}
          </span>
        </div>

        <div className="relative p-8 text-center overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(196,166,74,0.08) 0%, transparent 60%)',
            }}
          />

          <div className="relative z-10 space-y-4">
            <h2 className="text-2xl font-display font-bold tracking-[0.3em] text-compass-bright uppercase">
              Expedition Complete
            </h2>

            <p className="font-mono text-sm text-exp-text-dim">
              The expedition has concluded. All explorers have returned or been lost to the planet.
            </p>
          </div>
        </div>
      </div>

      {/* Explorer Report */}
      <div className="border border-exp-border rounded bg-exp-panel overflow-hidden">
        <div className="bg-exp-dark border-b border-exp-border px-4 py-2">
          <span className="font-display text-xs tracking-[0.3em] text-exp-text-dim uppercase">
            Explorer Report
          </span>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-exp-border bg-exp-dark/50">
              <th className="px-4 py-2 text-left font-display text-xs tracking-widest text-exp-text-dim uppercase">
                Explorer
              </th>
              <th className="px-4 py-2 text-center font-display text-xs tracking-widest text-exp-text-dim uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {(players || []).map((player, i) => {
              const addr = player.playerAddress || player;
              const isYou = addr?.toLowerCase() === address?.toLowerCase();

              return (
                <tr key={i} className={`border-b border-exp-border/50 ${isYou ? 'bg-compass/5' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAYER_COLORS[i] }} />
                      <span className="font-mono text-xs text-exp-text">
                        {truncateAddress(addr)}
                      </span>
                      {isYou && (
                        <span className="font-display text-xs tracking-widest uppercase text-compass-bright border border-compass/30 rounded px-1.5 py-0.5 bg-compass/5">
                          YOU
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-display text-xs tracking-widest uppercase
                      ${player.isActive ? 'text-oxide-green' : 'text-exp-text-dim'}`}>
                      {player.isActive ? 'SURVIVED' : 'LOST'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <Link
          to="/"
          className="font-display text-xs tracking-widest uppercase text-exp-text-dim hover:text-exp-text border border-exp-border rounded px-4 py-2 bg-exp-panel hover:bg-exp-dark transition-colors"
        >
          Return to Console
        </Link>
        <Link
          to="/"
          className="font-display text-xs tracking-widest uppercase text-compass hover:text-compass-bright border border-compass/30 hover:border-compass/50 rounded px-4 py-2 bg-compass/5 hover:bg-compass/10 transition-colors"
        >
          New Expedition
        </Link>
      </div>

      <div className="flex items-center justify-center gap-2">
        <div className="h-px w-12 bg-exp-border" />
        <span className="font-display text-xs tracking-[0.4em] text-exp-text-dim uppercase">
          End of Report
        </span>
        <div className="h-px w-12 bg-exp-border" />
      </div>
    </div>
  );
}
