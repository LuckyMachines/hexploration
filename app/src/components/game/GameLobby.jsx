import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useAllPlayers } from '../../hooks/useAllPlayers';
import { useGameActions } from '../../hooks/useGameActions';
import { usePlayerSummary } from '../../hooks/usePlayerSummary';
import { usePlayerID } from '../../hooks/usePlayerID';
import { truncateAddress } from '../../lib/formatting';
import TxStatus from '../shared/TxStatus';
import Spinner from '../shared/Spinner';

export default function GameLobby({ gameId }) {
  const { address } = useAccount();
  const { players, isLoading: loadingPlayers, refetch: refetchPlayers } = useAllPlayers(gameId);
  const { playerID, refetch: refetchPlayerID } = usePlayerID(gameId, address);
  const { isRegistered: isRegisteredBySummary, refetch: refetchPlayerSummary } = usePlayerSummary(gameId, playerID);

  const {
    registerForGame,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  } = useGameActions();

  const isRegisteredByRoster = (players || []).some(
    (player) => (player.playerAddress || player)?.toLowerCase?.() === address?.toLowerCase(),
  );
  const isRegistered = isRegisteredBySummary || isRegisteredByRoster;

  useEffect(() => {
    if (!isSuccess) return;
    refetchPlayers();
    refetchPlayerID?.();
    refetchPlayerSummary?.();
  }, [isSuccess, refetchPlayers, refetchPlayerID, refetchPlayerSummary]);

  return (
    <div className="border border-exp-border rounded bg-exp-panel">
      <div className="border-b border-exp-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-[0.25em] text-compass uppercase font-display">
            Expedition Briefing
          </h2>
          <span className="font-mono text-xs text-exp-text-dim bg-exp-dark/50 border border-exp-border rounded px-2 py-0.5">
            #{gameId}
          </span>
        </div>
        <span className="font-mono text-xs tracking-widest uppercase text-compass-bright border border-compass/30 rounded px-2 py-0.5 bg-compass/5">
          Staging
        </span>
      </div>

      <div className="px-6 py-5 space-y-5">
        <div>
          <h3 className="font-mono text-[10px] tracking-[0.3em] text-exp-text-dim uppercase mb-3">
            Crew Manifest ({players.length} enrolled)
          </h3>

          {loadingPlayers ? (
            <div className="flex items-center gap-2 text-exp-text-dim text-xs">
              <Spinner size="w-3.5 h-3.5" />
              <span>Loading roster...</span>
            </div>
          ) : players.length === 0 ? (
            <p className="font-mono text-xs text-exp-text-dim italic">
              No explorers registered yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {players.map((player, i) => {
                const addr = player.playerAddress || player;
                return (
                  <li key={i} className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-exp-text-dim w-4 text-right">{i + 1}.</span>
                    <span className={`${addr?.toLowerCase() === address?.toLowerCase() ? 'text-compass-bright' : 'text-exp-text'}`}>
                      {truncateAddress(addr)}
                    </span>
                    {addr?.toLowerCase() === address?.toLowerCase() && (
                      <span className="text-[10px] text-compass/70 uppercase tracking-wider">(you)</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-exp-border/50">
          {!isRegistered && address && (
            <button
              onClick={() => registerForGame(gameId)}
              disabled={isPending || isConfirming}
              className="px-4 py-2 bg-compass/10 border border-compass/40 rounded text-compass text-xs font-mono tracking-widest uppercase
                         hover:bg-compass/20 hover:border-compass/60 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending || isConfirming ? (
                <span className="flex items-center gap-2">
                  <Spinner size="w-3 h-3" /> Processing...
                </span>
              ) : (
                'Join Expedition'
              )}
            </button>
          )}

          {isRegistered && (
            <p className="self-center font-mono text-xs text-oxide-green tracking-wider uppercase">
              Registered - waiting for all explorers
            </p>
          )}
        </div>

        <TxStatus
          hash={hash}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={error}
        />
      </div>
    </div>
  );
}
