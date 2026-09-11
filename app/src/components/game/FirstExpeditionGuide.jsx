import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { useAvailableGames } from '../../hooks/useAvailableGames';
import { useGameActions } from '../../hooks/useGameActions';
import Spinner from '../shared/Spinner';
import TxStatus from '../shared/TxStatus';
import { trackJourneyEvent } from '../../lib/analytics';

function Step({ number, title, detail, active, complete }) {
  return (
    <div
      className={`rounded border px-3 py-3 ${
        active
          ? 'border-compass/50 bg-compass/10'
          : complete
            ? 'border-oxide-green/35 bg-oxide-green/5'
            : 'border-exp-border bg-exp-dark/35'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border font-mono text-xs ${
            complete
              ? 'border-oxide-green/50 text-oxide-green'
              : active
                ? 'border-compass/60 text-compass-bright'
                : 'border-exp-border text-exp-text-dim'
          }`}
        >
          {complete ? 'OK' : number}
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
            {title}
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {detail}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FirstExpeditionGuide() {
  const navigate = useNavigate();
  const { address, isConnected } = useWallet();
  const { gameIDs, maxPlayers, currentRegistrations, isLoading, error, refetch } = useAvailableGames();
  const {
    requestNewGame,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: txError,
  } = useGameActions();
  const firstOpenGame = useMemo(() => {
    const index = gameIDs.findIndex((id, i) => Number(currentRegistrations[i]) < Number(maxPlayers[i]));
    return index >= 0 ? Number(gameIDs[index]) : null;
  }, [gameIDs, maxPlayers, currentRegistrations]);

  useEffect(() => {
    if (!isSuccess) return;
    refetch();
  }, [isSuccess, refetch]);

  const canCreate = isConnected && !isPending && !isConfirming;
  const hasOpenGame = firstOpenGame !== null;
  const primaryAction = !isConnected
    ? hasOpenGame ? 'Observe Expedition' : 'Explore in 3D'
    : hasOpenGame
      ? 'Enter Expedition'
      : 'Create Expedition';

  const handlePrimary = () => {
    if (!isConnected) {
      navigate(hasOpenGame ? `/game/${firstOpenGame}` : '/guest');
      return;
    }
    if (hasOpenGame) {
      trackJourneyEvent('live_join', { game_context: 'open_registry' }, { dedupeKey: String(firstOpenGame) });
      navigate(`/game/${firstOpenGame}`);
      return;
    }
    if (canCreate) requestNewGame(2);
  };

  return (
    <section className="border border-compass/30 rounded bg-exp-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="border-b border-exp-border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-compass-bright">
              First expedition
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold uppercase tracking-[0.18em] text-exp-text">
              Launch your first shared survey
            </h2>
            <p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-exp-text-dim">
              Enter an expedition, reveal useful ground, and preserve a route to depart with what the crew finds.
            </p>
          </div>
          <button
            onClick={handlePrimary}
            disabled={isPending || isConfirming}
            className="min-h-11 min-w-44 rounded border border-compass/50 bg-compass/10 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-widest text-compass-bright transition-colors hover:border-compass hover:bg-compass/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending || isConfirming ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="w-3.5 h-3.5" />
                Working
              </span>
            ) : primaryAction}
          </button>
        </div>
      </div>

      <div className="grid gap-3 p-5 lg:grid-cols-3">
        <Step
          number="1"
          title="Explore"
          detail="Open the 3D world or inspect a live board before connecting anything."
          active={!isConnected}
          complete={isConnected}
        />
        <Step
          number="2"
          title="Join"
          detail={address ? `Wallet ${address.slice(0, 6)}...${address.slice(-4)} can sign a live crew action.` : 'Connect only when you choose to reserve a live seat or submit a shared action.'}
          active={isConnected && !hasOpenGame}
          complete={isConnected}
        />
        <Step
          number="3"
          title="Depart"
          detail={isLoading ? 'Scanning live expeditions.' : hasOpenGame ? `Expedition #${firstOpenGame} is open. Reveal useful ground, then return before redline.` : 'Reveal useful ground, preserve the route home, and leave with the discovery.'}
          active={isConnected && hasOpenGame}
          complete={false}
        />
      </div>

      {(hash || isPending || txError || error) && (
        <div className="px-5 pb-5">
          <TxStatus
            hash={hash}
            isPending={isPending}
            isConfirming={isConfirming}
            isSuccess={isSuccess}
            error={txError || error}
          />
        </div>
      )}
    </section>
  );
}
