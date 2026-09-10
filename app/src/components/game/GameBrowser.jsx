import { useState } from 'react';
import { useEffect } from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { useAvailableGames } from '../../hooks/useAvailableGames';
import { useGameActions } from '../../hooks/useGameActions';
import GameCard from './GameCard';
import Spinner from '../shared/Spinner';
import TxStatus from '../shared/TxStatus';
import EmptyState from '../shared/EmptyState';

export default function GameBrowser() {
  const navigate = useNavigate();
  const { address } = useWallet();
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
  const [crewFilter, setCrewFilter] = useState('all');
  const [gameSearch, setGameSearch] = useState('');
  const games = useMemo(() => gameIDs.map((id, index) => ({ id, maxPlayers: maxPlayers[index], registered: currentRegistrations[index] })).filter((game) => {
    if (gameSearch && !String(game.id).includes(gameSearch.trim())) return false;
    if (crewFilter === 'solo' && Number(game.maxPlayers) !== 1) return false;
    if (crewFilter === 'crew' && Number(game.maxPlayers) === 1) return false;
    if (crewFilter === 'open' && Number(game.registered) >= Number(game.maxPlayers)) return false;
    return true;
  }), [crewFilter, currentRegistrations, gameIDs, gameSearch, maxPlayers]);
  const quickPlay = games.filter((game) => Number(game.registered) < Number(game.maxPlayers)).sort((a, b) => Number(b.registered) - Number(a.registered))[0];

  useEffect(() => {
    if (!isSuccess) return;
    refetch();
  }, [isSuccess, refetch]);

  return (
    <div className="border border-exp-border rounded bg-exp-surface">
      {/* Header bar */}
      <div className="border-b border-exp-border px-4 py-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
          Available Expeditions
        </h2>

        {address && (
          <div className="flex items-center gap-3">
            <select
              value={playerCount}
              onChange={(e) => setPlayerCount(Number(e.target.value))}
              aria-label="Expedition crew size"
              className="bg-exp-dark border border-exp-border rounded text-xs font-mono text-exp-text-dim
                         min-h-11 px-2 py-1.5 cursor-pointer hover:border-compass/40 transition-colors"
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
              className="min-h-11 px-4 py-2 bg-compass/10 border border-compass/40 rounded text-compass text-xs font-mono tracking-widest uppercase
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
      <div className="px-4 py-5 sm:px-6">
        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input value={gameSearch} onChange={(event) => setGameSearch(event.target.value.replace(/\D/g, ''))} inputMode="numeric" aria-label="Find expedition by number" placeholder="Find expedition number" className="min-h-11 rounded border border-exp-border bg-exp-dark px-3 font-mono text-xs text-exp-text placeholder:text-exp-text-dim" />
          <select value={crewFilter} onChange={(event) => setCrewFilter(event.target.value)} aria-label="Filter expeditions" className="min-h-11 rounded border border-exp-border bg-exp-dark px-3 font-mono text-xs text-exp-text"><option value="all">All expeditions</option><option value="open">Open seats</option><option value="solo">Solo</option><option value="crew">Crew play</option></select>
          <button type="button" disabled={!quickPlay} onClick={() => navigate(`/game/${quickPlay.id}`)} className="min-h-11 rounded border border-oxide-green/40 bg-oxide-green/5 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-oxide-green disabled:opacity-40">Quick join</button>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-14">
            <div className="max-w-md rounded border border-exp-border/70 bg-exp-dark/35 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-compass-bright">
                <Spinner size="w-4 h-4" />
                Scanning expeditions
              </div>
              <p className="mt-2 font-mono text-xs text-exp-text-dim">
                Open expeditions will appear here when the registry responds.
              </p>
            </div>
          </div>
        ) : error ? (
          <EmptyState
            tone="red"
            title="Failed to load expeditions"
            body={error?.shortMessage || error?.message || String(error)}
            action="Retry"
            onAction={refetch}
          />
        ) : games.length === 0 ? (
          <EmptyState
            tone="gold"
            title="No expeditions found"
            body={address ? 'Launch a new expedition to seed the map, share discoveries, and race for extraction.' : 'Connect a wallet to create or join a live on-chain expedition.'}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard
                key={Number(game.id)}
                gameId={Number(game.id)}
                maxPlayers={Number(game.maxPlayers)}
                registered={Number(game.registered)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
