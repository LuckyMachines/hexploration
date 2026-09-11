import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
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
import SessionStatusBar from '../components/game/SessionStatusBar';
import { usePlayerSession } from '../contexts/PlayerSessionContext';
import { markSessionMilestone, measureSessionSpan } from '../lib/sessionTelemetry';

export default function GamePage() {
  const { gameId } = useParams();
  const { isConnected } = useWallet();
  const parsedGameId = parseUintId(gameId);
  const normalizedGameId = parsedGameId?.toString() ?? '';
  const { gameStarted, isLoading, error } = useGameState(normalizedGameId);
  const { isGameOver } = useGameOver(normalizedGameId);
  const session = usePlayerSession();

  useEffect(() => {
    if (parsedGameId !== null) {
      markSessionMilestone('game-load-start');
      session.beginGame(normalizedGameId);
    }
  }, [normalizedGameId, parsedGameId, session.beginGame]);

  useEffect(() => {
    if (parsedGameId === null || isLoading || error) return;
    if (isGameOver) session.terminal();
    else session.hydrated(gameStarted);
    markSessionMilestone('game-load-ready');
    measureSessionSpan('cold_resume_ms', 'game-load-start', 'game-load-ready');
  }, [error, gameStarted, isGameOver, isLoading, parsedGameId, session.hydrated, session.terminal]);

  return (
    <div className="mx-auto w-full max-w-[100rem] px-3 py-4 sm:px-4 sm:py-8 2xl:px-6">
      <SurveyTabletFrame
        title={parsedGameId === null ? 'Survey Tablet' : `Expedition #${normalizedGameId || 'Invalid'}`}
        subtitle="Chart the grid, manage the crew, and depart alive"
        status={parsedGameId === null ? 'INVALID ID' : isConnected ? 'ONLINE' : 'OBSERVING'}
      >
        <div className="space-y-5">
          {parsedGameId !== null && <SessionStatusBar />}
          {parsedGameId === null && (
            <div className="border border-signal-red/30 rounded bg-exp-panel p-8 text-center">
              <p className="font-mono text-xs text-signal-red tracking-wider uppercase">
                Invalid survey id
              </p>
            </div>
          )}

          {parsedGameId !== null && !isConnected && (
            <div className="rounded border border-blueprint/30 bg-blueprint/5 px-4 py-3">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-blueprint">Observer access - no wallet needed</p>
              <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
                The live 3D board, crew, and expedition state are open to inspect. Connect only when you choose to join the crew or submit an action.
              </p>
            </div>
          )}

          {parsedGameId !== null && isLoading && (
            <div className="border border-exp-border rounded bg-exp-panel p-12 flex items-center justify-center gap-3">
              <Spinner size="w-5 h-5" />
              <span className="font-mono text-xs text-exp-text-dim tracking-wider uppercase">
                Restoring expedition...
              </span>
              <ol className="sr-only">
                {(session.state.resumeSteps.length ? session.state.resumeSteps : ['identity', 'party', 'chain']).map((step) => <li key={step}>Checking {step}</li>)}
              </ol>
            </div>
          )}

          {parsedGameId !== null && error && (
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

          {parsedGameId !== null && !isLoading && !error && !gameStarted && (
            <GameLobby gameId={normalizedGameId} />
          )}

          {parsedGameId !== null && !isLoading && !error && gameStarted && !isGameOver && (
            <ExpeditionProvider gameId={normalizedGameId}>
              {isConnected && <ReturnLoopSync gameId={normalizedGameId} />}
              <ExpeditionBench />
            </ExpeditionProvider>
          )}

          {parsedGameId !== null && !isLoading && !error && gameStarted && isGameOver && (
            <ExpeditionProvider gameId={normalizedGameId}>
              {isConnected && <ReturnLoopSync gameId={normalizedGameId} isGameOver />}
              <GameOver gameId={normalizedGameId} />
            </ExpeditionProvider>
          )}
        </div>
      </SurveyTabletFrame>
    </div>
  );
}
