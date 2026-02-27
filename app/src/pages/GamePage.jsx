import { useParams } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';
import GameLobby from '../components/game/GameLobby';
import ExpeditionBench from '../components/expedition/ExpeditionBench';
import GameOver from '../components/game/GameOver';
import Spinner from '../components/shared/Spinner';
import { parseUintId } from '../lib/ids';

export default function GamePage() {
  const { gameId } = useParams();
  const parsedGameId = parseUintId(gameId);
  const normalizedGameId = parsedGameId?.toString() ?? '';
  const { gameStarted, currentPhase, isLoading, error } = useGameState(normalizedGameId);

  const isGameOver = currentPhase === 'The End';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
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

      {parsedGameId !== null && isLoading && (
        <div className="border border-exp-border rounded bg-exp-panel p-12 flex items-center justify-center gap-3">
          <Spinner size="w-5 h-5" />
          <span className="font-mono text-xs text-exp-text-dim tracking-wider uppercase">
            Loading expedition data...
          </span>
        </div>
      )}

      {parsedGameId !== null && error && (
        <div className="border border-signal-red/30 rounded bg-exp-panel p-8 text-center">
          <p className="font-mono text-xs text-signal-red tracking-wider uppercase">
            Failed to load expedition data
          </p>
        </div>
      )}

      {parsedGameId !== null && !isLoading && !error && !gameStarted && (
        <GameLobby gameId={normalizedGameId} />
      )}

      {parsedGameId !== null && !isLoading && !error && gameStarted && !isGameOver && (
        <ExpeditionBench gameId={normalizedGameId} />
      )}

      {parsedGameId !== null && !isLoading && !error && gameStarted && isGameOver && (
        <GameOver gameId={normalizedGameId} />
      )}
    </div>
  );
}
