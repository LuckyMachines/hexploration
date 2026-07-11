import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useGameState } from '../hooks/useGameState';
import GameLobby from '../components/game/GameLobby';
import ExpeditionBench from '../components/expedition/ExpeditionBench';
import GameOver from '../components/game/GameOver';
import Spinner from '../components/shared/Spinner';
import SurveyTabletFrame from '../components/layout/SurveyTabletFrame';
import { ExpeditionProvider } from '../contexts/ExpeditionContext';
import { useGameOver } from '../hooks/useGameOver';
import { parseUintId } from '../lib/ids';
import { ReturnLoopSync } from '../components/expedition/ReturnLoopPanel';

export default function GamePage() {
  const { gameId } = useParams();
  const { isConnected, connect } = useWallet();
  const [connectError, setConnectError] = useState('');
  const parsedGameId = parseUintId(gameId);
  const normalizedGameId = parsedGameId?.toString() ?? '';
  const { gameStarted, isLoading, error } = useGameState(normalizedGameId);
  const { isGameOver } = useGameOver(normalizedGameId);

  return (
    <div className="mx-auto w-full max-w-[100rem] px-3 py-4 sm:px-4 sm:py-8 2xl:px-6">
      <SurveyTabletFrame
        title={parsedGameId === null ? 'Survey Tablet' : `Expedition #${normalizedGameId || 'Invalid'}`}
        subtitle="Chart the grid, manage the crew, and escape alive"
        status={parsedGameId === null ? 'INVALID ID' : isConnected ? 'ONLINE' : 'LOCKED'}
      >
        <div className="space-y-5">
          {parsedGameId === null && (
            <div className="border border-signal-red/30 rounded bg-exp-panel p-8 text-center">
              <p className="font-mono text-xs text-signal-red tracking-wider uppercase">
                Invalid survey id
              </p>
            </div>
          )}

          {parsedGameId !== null && !isConnected && (
            <div className="border border-compass/30 rounded bg-exp-panel p-8 text-center space-y-4">
              <p className="font-mono text-sm text-compass tracking-wider">
                Connect your wallet to enter this expedition
              </p>
              <p className="font-mono text-xs text-exp-text-dim">
                Live expeditions use wallet-signed joins and actions so the route, discoveries, and outcome can be recorded.
              </p>
              <button
                onClick={async () => {
                  setConnectError('');
                  try {
                    await connect();
                  } catch (err) {
                    setConnectError(err?.message === 'No wallet found'
                      ? 'No wallet was detected. Install or unlock one, then try again.'
                      : err?.shortMessage || err?.message || 'Wallet connection failed.');
                  }
                }}
                className="px-5 py-2.5 bg-compass/10 border border-compass/50 rounded text-compass text-xs font-display font-semibold tracking-widest uppercase
                           hover:bg-compass/20 hover:border-compass transition-colors"
              >
                Connect Wallet
              </button>
              {connectError && (
                <p className="mx-auto max-w-md rounded border border-signal-red/30 bg-signal-red/5 px-3 py-2 font-mono text-xs text-signal-red">
                  {connectError}
                </p>
              )}
            </div>
          )}

          {parsedGameId !== null && isConnected && isLoading && (
            <div className="border border-exp-border rounded bg-exp-panel p-12 flex items-center justify-center gap-3">
              <Spinner size="w-5 h-5" />
              <span className="font-mono text-xs text-exp-text-dim tracking-wider uppercase">
                Loading survey data...
              </span>
            </div>
          )}

          {parsedGameId !== null && isConnected && error && (
            <div className="border border-signal-red/30 rounded bg-exp-panel p-8 text-center">
              <p className="font-mono text-xs text-signal-red tracking-wider uppercase">
                Failed to load survey data
              </p>
              <p className="mx-auto mt-2 max-w-xl break-all font-mono text-xs text-exp-text-dim">
                {error?.shortMessage || error?.message || String(error)}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 rounded border border-signal-red/40 px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] text-signal-red hover:bg-signal-red/10"
              >
                Reload
              </button>
            </div>
          )}

          {parsedGameId !== null && isConnected && !isLoading && !error && !gameStarted && (
            <GameLobby gameId={normalizedGameId} />
          )}

          {parsedGameId !== null && isConnected && !isLoading && !error && gameStarted && !isGameOver && (
            <ExpeditionProvider gameId={normalizedGameId}>
              <ReturnLoopSync gameId={normalizedGameId} />
              <ExpeditionBench />
            </ExpeditionProvider>
          )}

          {parsedGameId !== null && isConnected && !isLoading && !error && gameStarted && isGameOver && (
            <ExpeditionProvider gameId={normalizedGameId}>
              <ReturnLoopSync gameId={normalizedGameId} isGameOver />
              <GameOver gameId={normalizedGameId} />
            </ExpeditionProvider>
          )}
        </div>
      </SurveyTabletFrame>
    </div>
  );
}
