import { useParams } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { useGameState } from '../hooks/useGameState';
import GameLobby from '../components/game/GameLobby';
import ExpeditionBench from '../components/expedition/ExpeditionBench';
import GameOver from '../components/game/GameOver';
import Spinner from '../components/shared/Spinner';
import SurveyTabletFrame from '../components/layout/SurveyTabletFrame';
import { useGameOver } from '../hooks/useGameOver';
import { parseUintId } from '../lib/ids';

export default function GamePage() {
  const { gameId } = useParams();
  const { isConnected, connect } = useWallet();
  const parsedGameId = parseUintId(gameId);
  const normalizedGameId = parsedGameId?.toString() ?? '';
  const { gameStarted, isLoading, error } = useGameState(normalizedGameId);
  const { isGameOver } = useGameOver(normalizedGameId);

  return (
    <div className="mx-auto w-full max-w-[100rem] px-3 py-4 sm:px-4 sm:py-8 2xl:px-6">
      <SurveyTabletFrame
        title={parsedGameId === null ? 'Survey Tablet' : `Survey #${normalizedGameId || 'Invalid'}`}
        subtitle="Live survey state, roster access, and mission actions"
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
                Connect your wallet to open this survey
              </p>
              <p className="font-mono text-xs text-exp-text-dim">
                You need a connected wallet to register, submit actions, and interact with the game.
              </p>
              <button
                onClick={() => connect()}
                className="px-5 py-2.5 bg-compass/10 border border-compass/50 rounded text-compass text-xs font-display font-semibold tracking-widest uppercase
                           hover:bg-compass/20 hover:border-compass transition-colors"
              >
                Connect Wallet
              </button>
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
            </div>
          )}

          {parsedGameId !== null && isConnected && !isLoading && !error && !gameStarted && (
            <GameLobby gameId={normalizedGameId} />
          )}

          {parsedGameId !== null && isConnected && !isLoading && !error && gameStarted && !isGameOver && (
            <ExpeditionBench gameId={normalizedGameId} />
          )}

          {parsedGameId !== null && isConnected && !isLoading && !error && gameStarted && isGameOver && (
            <GameOver gameId={normalizedGameId} />
          )}
        </div>
      </SurveyTabletFrame>
    </div>
  );
}
