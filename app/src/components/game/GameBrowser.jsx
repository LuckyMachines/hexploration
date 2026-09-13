import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { usePlayerSession } from '../../contexts/PlayerSessionContext';
import { useAvailableGames } from '../../hooks/useAvailableGames';
import { useGameActions } from '../../hooks/useGameActions';
import GameCard from './GameCard';
import Spinner from '../shared/Spinner';
import TxStatus from '../shared/TxStatus';
import EmptyState from '../shared/EmptyState';

export default function GameBrowser() {
  const navigate = useNavigate();
  const { address } = useWallet();
  const { state: playerSession } = usePlayerSession();
  const {
    gameIDs,
    maxPlayers,
    currentRegistrations,
    isLoading,
    isFetching,
    dataUpdatedAt,
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
    lifecycle,
  } = useGameActions();

  const [playerCount, setPlayerCount] = useState(2);
  const [crewFilter, setCrewFilter] = useState('all');
  const [gameSearch, setGameSearch] = useState('');
  const [loadingDelayed, setLoadingDelayed] = useState(false);
  const availableGames = useMemo(() => gameIDs.map((id, index) => ({ id, maxPlayers: maxPlayers[index], registered: currentRegistrations[index] })), [currentRegistrations, gameIDs, maxPlayers]);
  const games = useMemo(() => availableGames.filter((game) => {
    if (gameSearch && !String(game.id).includes(gameSearch.trim())) return false;
    if (crewFilter === 'solo' && Number(game.maxPlayers) !== 1) return false;
    if (crewFilter === 'crew' && Number(game.maxPlayers) === 1) return false;
    if (crewFilter === 'open' && Number(game.registered) >= Number(game.maxPlayers)) return false;
    return true;
  }), [availableGames, crewFilter, gameSearch]);
  const quickPlay = games.filter((game) => Number(game.registered) < Number(game.maxPlayers)).sort((a, b) => Number(b.registered) - Number(a.registered))[0];

  useEffect(() => {
    if (!isLoading) {
      setLoadingDelayed(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setLoadingDelayed(true), 3500);
    return () => window.clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    if (!isSuccess) return;
    refetch();
  }, [isSuccess, refetch]);

  const refresh = () => {
    setLoadingDelayed(false);
    refetch();
  };

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const filteredEmpty = !isLoading && !error && availableGames.length > 0 && games.length === 0;

  return (
    <div id="available-expeditions" tabIndex={-1} className="scroll-mt-24 rounded border border-exp-border bg-exp-surface outline-none focus-visible:ring-2 focus-visible:ring-blueprint">
      {/* Header bar */}
      <div className="border-b border-exp-border px-4 py-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs tracking-[0.24em] text-exp-text uppercase">
            Available Expeditions
          </h2>
          <p className="mt-1 font-mono text-[11px] text-exp-text-dim" role="status">
            {!playerSession.online
              ? 'Offline - local expedition remains available'
              : isLoading
                ? loadingDelayed ? 'Registry is taking longer than usual' : 'Contacting the public registry'
                : error
                  ? 'Registry could not be reached'
                  : `${availableGames.length} live route${availableGames.length === 1 ? '' : 's'}${lastUpdated ? ` - updated ${lastUpdated}` : ''}`}
            {isFetching && !isLoading ? ' - refreshing' : ''}
          </p>
        </div>

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
            lifecycle={lifecycle}
          />
        </div>
      )}

      {/* Game list */}
      <div className="px-4 py-5 sm:px-6">
        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input value={gameSearch} onChange={(event) => setGameSearch(event.target.value.replace(/\D/g, ''))} inputMode="numeric" aria-label="Find expedition by number" placeholder="Find expedition number" className="min-h-11 rounded border border-exp-border bg-exp-dark px-3 font-mono text-xs text-exp-text placeholder:text-exp-text-dim" />
          <select value={crewFilter} onChange={(event) => setCrewFilter(event.target.value)} aria-label="Filter expeditions" className="min-h-11 rounded border border-exp-border bg-exp-dark px-3 font-mono text-xs text-exp-text"><option value="all">All expeditions</option><option value="open">Open seats</option><option value="solo">Solo</option><option value="crew">Crew play</option></select>
          <button type="button" disabled={!quickPlay} onClick={() => navigate(`/game/${quickPlay.id}`)} className="min-h-11 rounded border border-oxide-green/40 bg-oxide-green/5 px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-oxide-green disabled:opacity-40">{address ? 'Quick join' : 'Observe live'}</button>
        </div>
        {!playerSession.online ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <EmptyState
              tone="red"
              title="You are offline"
              body="No progress has been lost. Reconnect to inspect the live registry, or enter the local 3D expedition now."
              action="Retry live registry"
              onAction={refresh}
            />
            <PracticeExpeditionCard />
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-14">
            <div className="max-w-md rounded border border-exp-border/70 bg-exp-dark/35 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-compass-bright">
                <Spinner size="w-4 h-4" />
                {loadingDelayed ? 'Still contacting the registry' : 'Scanning expeditions'}
              </div>
              <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">
                {loadingDelayed ? 'You do not need to wait. The practice expedition uses the same 3D world and saves locally.' : 'Open expeditions will appear here when the registry responds.'}
              </p>
              {loadingDelayed && <Link to="/guest?mode=practice" className="mt-3 inline-flex min-h-11 items-center rounded border border-blueprint/45 bg-blueprint/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-blueprint">Open practice expedition</Link>}
            </div>
          </div>
        ) : error ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <EmptyState
              tone="red"
              title="Live registry unavailable"
              body="The network did not answer, but no action or progress was lost. Retry the public read or use the always-available practice expedition."
              action="Retry live registry"
              onAction={refresh}
            />
            <PracticeExpeditionCard />
          </div>
        ) : filteredEmpty ? (
          <EmptyState
            tone="blue"
            title="No routes match these filters"
            body="Live expeditions exist outside this view. Clear the expedition number and crew filter to see every route."
            action="Clear filters"
            onAction={() => { setGameSearch(''); setCrewFilter('all'); }}
          />
        ) : availableGames.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <EmptyState
              tone="gold"
              title="The live registry is quiet"
              body={address ? 'Create the next shared expedition, or practice the route before your crew arrives.' : 'Nothing is broken and no wallet is required. Practice the full reveal, relic, pressure, and departure loop now.'}
              action={address ? 'Refresh live registry' : undefined}
              onAction={address ? refresh : undefined}
            />
            <PracticeExpeditionCard />
          </div>
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

function PracticeExpeditionCard() {
  return (
    <div className="rounded border border-blueprint/35 bg-blueprint/5 px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-blueprint">Practice expedition</p>
      <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">A local, clearly labeled 3D route using the production board. Reveal terrain, recover a relic, and depart safely while live crews are quiet.</p>
      <Link to="/guest?mode=practice" className="mt-3 inline-flex min-h-11 items-center rounded border border-blueprint/45 bg-blueprint/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-blueprint">Enter practice world</Link>
    </div>
  );
}
