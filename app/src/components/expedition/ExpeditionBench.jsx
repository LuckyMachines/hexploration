import { useMemo, useState } from 'react';
import { useExpedition } from '../../contexts/ExpeditionContext';
import { Action } from '../../lib/constants';
import DayNightBadge from './DayNightBadge';
import DayCounter from './DayCounter';
import PhaseIndicator from './PhaseIndicator';
import TurnTimeline from './TurnTimeline';
import ReadinessMatrix from './ReadinessMatrix';
import MatchReplay from './MatchReplay';
import SpectatorBanner from './SpectatorBanner';
import MissionStatus from './MissionStatus';
import TurnReadinessStrip from './TurnReadinessStrip';
import HexGrid from '../board/HexGrid';
import PlayerDossier from '../player/PlayerDossier';
import ActionPanel from '../actions/ActionPanel';
import TurnResolution from '../resolution/TurnResolution';
import EventLog from '../shared/EventLog';
import ExpeditionDebugOverlay from './ExpeditionDebugOverlay';
import ErrorBoundary from '../shared/ErrorBoundary';
import { buildRouteStatus } from '../../lib/routeStatus';
import { getAdjacent, parseAlias } from '../../lib/hexmath';

export default function ExpeditionBench() {
  const view = useExpedition();
  const [focusedPlayerID, setFocusedPlayerID] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [boardInput, setBoardInput] = useState({ inputMode: 'mouse', inputCadence: 'idle', lastInputKind: 'idle' });
  const debugEnabled = import.meta.env.DEV
    || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'));

  const {
    address,
    phase,
    playerID,
    enrichedPlayers,
    readinessByPlayerID,
    isSpectator,
    currentPlayerIndex,
    stats,
    location,
    action,
    movement,
    activeInventory,
    events,
    loadFullHistory,
    isLoadingFullHistory,
    queueTelemetry,
    activeTab,
    setActiveTab,
    movePath,
    applyMoveStep,
    clearMovePath,
    backtrackMovePath,
    moveValidation,
    turnState,
  } = view;

  const queueLabel = queueTelemetry.hasActiveQueue
    ? `Queue #${queueTelemetry.queueID ?? 0} active`
    : 'Queue idle';
  const queueDetail = queueTelemetry.hasActiveQueue
    ? 'Submissions resolve through the live queue.'
    : 'Waiting for the expedition to create a queue.';

  const focusedPlayer = useMemo(
    () => enrichedPlayers.find((player) => player.playerID === focusedPlayerID),
    [enrichedPlayers, focusedPlayerID],
  );
  const intentAlias = movePath[movePath.length - 1] || location;
  const intentNeighbors = useMemo(() => {
    const coord = parseAlias(intentAlias);
    return new Set(coord ? getAdjacent(coord.col, coord.row) : []);
  }, [intentAlias]);
  const companionLocations = useMemo(
    () => enrichedPlayers
      .map((player, index) => ({ player, index }))
      .filter(({ player, index }) => index !== currentPlayerIndex && player.currentZone)
      .map(({ player, index }) => ({
        zone: player.currentZone,
        index,
        isNearIntent: player.currentZone === intentAlias || intentNeighbors.has(player.currentZone),
      })),
    [currentPlayerIndex, enrichedPlayers, intentAlias, intentNeighbors],
  );
  const routeStatus = useMemo(
    () => buildRouteStatus({
      currentLocation: location,
      path: movePath,
      movement,
      validation: moveValidation,
      activeInventory,
      companionLocations,
    }),
    [activeInventory, companionLocations, location, movePath, moveValidation, movement],
  );

  return (
    <div className="space-y-4">
      <div className="rounded border border-exp-border bg-exp-panel/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <DayNightBadge phase={phase} />
          <PhaseIndicator currentPhase={queueTelemetry.phase} />
          <DayCounter gameId={view.gameId} />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
            {phase || 'Unknown'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
            {queueLabel}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
            {enrichedPlayers.length} aboard
          </span>
          {debugEnabled && (
            <button
              type="button"
              onClick={() => setShowDebug((value) => !value)}
              className="rounded border border-exp-border/70 bg-exp-dark/35 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim transition-colors hover:border-compass/50 hover:text-compass"
            >
              Debug
            </button>
          )}
        </div>
        <p className="mt-2 font-mono text-[11px] text-exp-text-dim">
          {queueDetail}
        </p>
      </div>

      <MissionStatus
        turnState={turnState}
        movePathLength={movePath.length}
        moveValidation={moveValidation}
        crewCount={enrichedPlayers.length}
      />
      <TurnReadinessStrip
        players={enrichedPlayers}
        readinessByPlayerID={readinessByPlayerID}
        currentPlayerIndex={currentPlayerIndex}
        turnState={turnState}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)] 2xl:grid-cols-[minmax(0,760px)_minmax(360px,1fr)]">
        <div className="min-w-0 border border-exp-border rounded bg-exp-panel p-2 sm:p-4 min-h-[360px] sm:min-h-[520px] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-exp-border/50 pb-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-exp-text-dim">
                Survey board
              </p>
              <p className="mt-1 font-mono text-xs text-exp-text-dim">
                Trace revealed tiles to plan movement. Fogged cells stay locked.
              </p>
            </div>
            {location && (
              <div className="flex flex-wrap items-center gap-2 rounded border border-exp-border/60 bg-exp-dark/40 px-3 py-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-exp-text-dim">
                    Current location
                  </p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-widest text-compass-bright">
                    {location}
                  </p>
                </div>
                {movePath.length > 0 && (
                  <button
                    type="button"
                    onClick={backtrackMovePath}
                    className="alive-cancel-button rounded border border-blueprint/35 bg-blueprint/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-blueprint hover:border-blueprint/60"
                  >
                    Undo
                  </button>
                )}
              </div>
            )}
          </div>
          <ErrorBoundary>
            <HexGrid
              gameId={view.gameId}
              selectedPath={movePath}
              onTileClick={activeTab === Action.MOVE ? applyMoveStep : undefined}
              onBacktrack={backtrackMovePath}
              currentPlayerIndex={currentPlayerIndex}
              currentLocation={location}
              movement={movement}
              isMovePlanning={activeTab === Action.MOVE && !isSpectator}
              activeAction={activeTab}
              currentAction={action}
              queuePhase={queueTelemetry.phase}
              isSpectator={isSpectator}
              stats={stats}
              activeInventory={activeInventory}
              turnState={turnState}
              focusedPlayerID={focusedPlayerID}
              onPlayerFocus={setFocusedPlayerID}
              onInputSnapshot={setBoardInput}
            />
          </ErrorBoundary>
        </div>

        <div className="min-w-0 space-y-3 max-h-[340px] lg:max-h-[620px] 2xl:max-h-[min(720px,calc(100svh-13rem))] overflow-y-auto">
          <h3 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase sticky top-0 bg-exp-dark py-1">
            Expedition Crew
          </h3>
          {enrichedPlayers.length === 0 && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded border border-exp-border bg-exp-panel p-3">
                  <div className="h-3 w-28 animate-pulse rounded bg-exp-border/70" />
                  <div className="mt-3 grid gap-2">
                    <div className="h-2 animate-pulse rounded bg-exp-border/50" />
                    <div className="h-2 animate-pulse rounded bg-exp-border/40" />
                    <div className="h-2 animate-pulse rounded bg-exp-border/30" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {enrichedPlayers.map((player, i) => (
            <PlayerDossier
              key={i}
              player={player}
              index={i}
              isCurrentUser={player.playerAddress?.toLowerCase() === address?.toLowerCase()}
              isFocused={focusedPlayerID === player.playerID}
              isNearIntent={player.currentZone === intentAlias || intentNeighbors.has(player.currentZone)}
              onFocus={() => setFocusedPlayerID(player.playerID)}
            />
          ))}
        </div>
      </div>

      <details className="group rounded border border-exp-border bg-exp-panel/70 px-4 py-3">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
          <div>
            <h3 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
              Mission telemetry
            </h3>
            <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
              Queue phase, submission readiness, and turn history.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-compass-bright border border-compass/30 rounded px-2 py-1 bg-compass/5">
            Details
          </span>
        </summary>
        <div className="mt-3 space-y-3">
          <TurnTimeline queueTelemetry={queueTelemetry} events={events} />
          <ReadinessMatrix
            players={enrichedPlayers}
            readinessByPlayerID={readinessByPlayerID}
            queueActive={queueTelemetry.hasActiveQueue}
          />
        </div>
      </details>

      {isSpectator && <SpectatorBanner />}

      {!isSpectator && (
        <ErrorBoundary>
          <ActionPanel
            gameId={view.gameId}
            playerID={playerID}
            currentLocation={location}
            stats={stats}
            currentAction={action}
            movement={movement}
            movePath={movePath}
            onMoveSubmit={clearMovePath}
            onMoveClear={clearMovePath}
            onMoveBacktrack={backtrackMovePath}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isSpectator={isSpectator}
            moveValidation={moveValidation}
            routeStatus={routeStatus}
            boardInput={boardInput}
            turnState={turnState}
          />
        </ErrorBoundary>
      )}

      {focusedPlayer && (
        <div className="rounded border border-blueprint/30 bg-blueprint/5 px-4 py-2 font-mono text-xs text-blueprint">
          Roster focus linked to board: P{focusedPlayer.playerID} at {focusedPlayer.currentZone || 'unknown'}.
        </div>
      )}

      <ErrorBoundary>
        <TurnResolution gameId={view.gameId} events={events} turnState={turnState} turnReplay={view.turnReplay} />
      </ErrorBoundary>

      <details className="group rounded border border-exp-border bg-exp-panel/70 px-4 py-3">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
          <div>
            <h3 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
              Expedition history
            </h3>
            <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
              Full replay and event log for the current run.
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-compass-bright border border-compass/30 rounded px-2 py-1 bg-compass/5">
            Details
          </span>
        </summary>
        <div className="mt-3 space-y-3">
          <MatchReplay
            events={events}
            onLoadFullHistory={loadFullHistory}
            isLoadingFullHistory={isLoadingFullHistory}
          />
          <EventLog events={events} />
        </div>
      </details>

      {debugEnabled && showDebug && <ExpeditionDebugOverlay view={view} />}
    </div>
  );
}
