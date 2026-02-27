import { useState } from 'react';
import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useAvailableGames } from '../../hooks/useAvailableGames';
import { useGameActions } from '../../hooks/useGameActions';
import GameCard from './GameCard';
import Spinner from '../shared/Spinner';
import TxStatus from '../shared/TxStatus';

export default function GameBrowser() {
  const { address } = useAccount();
  const {
    gameIDs,
    maxPlayers,
    currentRegistrations,
    isLoading,
    error,
    refetch,
  } = useAvailableGames();
  const {
    requestNewGame,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: txError,
  } = useGameActions();

  const [playerCount, setPlayerCount] = useState(2);

  useEffect(() => {
    if (!isSuccess) return;
    refetch();
  }, [isSuccess, refetch]);

  return (
    <div className="border border-exp-border rounded bg-exp-surface">
      {/* Header bar */}
      <div className="border-b border-exp-border px-6 py-4 flex items-center justify-between">
        <h2 className="font-mono text-[10px] tracking-[0.3em] text-exp-text-dim uppercase">
          Available Expeditions
        </h2>

        {address && (
          <div className="flex items-center gap-3">
            <select
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
              className="bg-exp-dark border border-exp-border rounded text-xs font-mono text-exp-text-dim
                         px-2 py-1.5 cursor-pointer hover:border-compass/40 transition-colors"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n} className="bg-exp-dark text-exp-text">
                  {n} Player{n > 1 ? 's' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => requestNewGame(playerCount)}
              disabled={isPending || isConfirming}
              className="px-4 py-2 bg-compass/10 border border-compass/40 rounded text-compass text-xs font-mono tracking-widest uppercase
                         hover:bg-compass/20 hover:border-compass/60 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming ? (
                <span className="flex items-center gap-2">
                  <Spinner size="w-3 h-3" /> Creating...
                </span>
              ) : (
                'New Expedition'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Transaction feedback */}
      {(hash || isPending || txError) && (
        <div className="px-6 pt-4">
          <TxStatus
            hash={hash}
            isPending={isPending}
            isConfirming={isConfirming}
            isSuccess={isSuccess}
            error={txError}
          />
        </div>
      )}

      {/* Game list */}
      <div className="px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Spinner size="w-5 h-5" />
            <span className="font-mono text-xs text-exp-text-dim tracking-wider uppercase">
              Scanning expeditions...
            </span>
          </div>
        ) : error ? (
          <div className="text-center py-12 space-y-2">
            <p className="font-mono text-xs text-signal-red tracking-wider uppercase">
              Failed to load expeditions
            </p>
            <p className="font-mono text-[10px] text-exp-text-dim break-all max-w-lg mx-auto">
              {error?.shortMessage || error?.message || String(error)}
            </p>
          </div>
        ) : gameIDs.length === 0 ? (
          <div className="text-center py-12">
            <p className="font-mono text-xs text-exp-text-dim italic">
              No expeditions found. Launch one to begin exploring.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gameIDs.map((id, i) => (
              <GameCard
                key={Number(id)}
                gameId={Number(id)}
                maxPlayers={Number(maxPlayers[i])}
                registered={Number(currentRegistrations[i])}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
