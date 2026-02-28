import { useParams } from 'react-router-dom';
import { useAccount, useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { useGameState } from '../hooks/useGameState';
import GameLobby from '../components/game/GameLobby';
import ExpeditionBench from '../components/expedition/ExpeditionBench';
import GameOver from '../components/game/GameOver';
import Spinner from '../components/shared/Spinner';
import { parseUintId } from '../lib/ids';

export default function GamePage() {
  const { gameId } = useParams();
  const { isConnected } = useAccount();
  const { connect } = useConnect();
  const parsedGameId = parseUintId(gameId);
  const normalizedGameId = parsedGameId?.toString() ?? '';
  const { gameStarted, currentPhase, isLoading, error } = useGameState(normalizedGameId);

  const isGameOver = currentPhase === 'The End';

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold tracking-widest text-compass uppercase font-display">
          Expedition
        </h1>
        <span className="font-mono text-sm text-exp-text-dim bg-exp-panel border border-exp-border rounded px-2 py-0.5">
          #{normalizedGameId || 'Invalid'}
        </span>
      </div>

      {parsedGameId === null && (
        <div className="border border-signal-red/30 rounded bg-exp-panel p-8 text-center">
          <p className="font-mono text-xs text-signal-red tracking-wider uppercase">
            Invalid expedition id
          </p>
        </div>
      )}

      {parsedGameId !== null && !isConnected && (
        <div className="border border-compass/30 rounded bg-exp-panel p-8 text-center space-y-4">
          <p className="font-mono text-sm text-compass tracking-wider">
            Connect your wallet to join this expedition
          </p>
          <p className="font-mono text-xs text-exp-text-dim">
            You need a connected wallet to register, submit actions, and interact with the game.
          </p>
          <button
            onClick={() => connect({ connector: injected() })}
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
            Loading expedition data...
          </span>
        </div>
      )}

      {parsedGameId !== null && isConnected && error && (
        <div className="border border-signal-red/30 rounded bg-exp-panel p-8 text-center">
          <p className="font-mono text-xs text-signal-red tracking-wider uppercase">
            Failed to load expedition data
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
  );
}
