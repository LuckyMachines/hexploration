import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { useGamePhase } from '../../hooks/useGamePhase';
import { useAllPlayers } from '../../hooks/useAllPlayers';
import { useAllPlayerLocations } from '../../hooks/useAllPlayerLocations';
import { usePlayerID } from '../../hooks/usePlayerID';
import { usePlayerSummary } from '../../hooks/usePlayerSummary';
import { useGameEvents } from '../../hooks/useGameEvents';
import { usePlayerMovement } from '../../hooks/usePlayerMovement';
import { usePlayerInventory } from '../../hooks/usePlayerInventory';
import { useQueueTelemetry } from '../../hooks/useQueueTelemetry';
import { useSubmissionReadiness } from '../../hooks/useSubmissionReadiness';
import { Action } from '../../lib/constants';
import { isAdjacent } from '../../lib/hexmath';
import DayNightBadge from './DayNightBadge';
import DayCounter from './DayCounter';
import PhaseIndicator from './PhaseIndicator';
import TurnTimeline from './TurnTimeline';
import ReadinessMatrix from './ReadinessMatrix';
import MatchReplay from './MatchReplay';
import SpectatorBanner from './SpectatorBanner';
import MissionStatus from './MissionStatus';
import HexGrid from '../board/HexGrid';
import PlayerDossier from '../player/PlayerDossier';
import ActionPanel from '../actions/ActionPanel';
import TurnResolution from '../resolution/TurnResolution';
import EventLog from '../shared/EventLog';

export default function ExpeditionBench({ gameId }) {
  const { address } = useWallet();
  const { phase } = useGamePhase(gameId);
  const { players } = useAllPlayers(gameId);
  const { playerIDs: locPlayerIDs, playerZones } = useAllPlayerLocations(gameId);
  const { playerID } = usePlayerID(gameId, address);
  const { stats, location, action } = usePlayerSummary(gameId, playerID);
  const { movement } = usePlayerMovement(gameId, playerID);
  const { active: activeInventory } = usePlayerInventory(gameId, playerID);
  const { events, loadFullHistory, isLoadingFullHistory } = useGameEvents(gameId);
  const queueTelemetry = useQueueTelemetry(gameId);

  const [activeTab, setActiveTab] = useState(Action.MOVE);
  const [movePath, setMovePath] = useState([]);

  const playerIDs = useMemo(
    () => (players || []).map((player, index) => (
      player.playerID !== undefined ? player.playerID : BigInt(index + 1)
    )),
    [players],
  );

  const { readinessByPlayerID } = useSubmissionReadiness(queueTelemetry.queueID, playerIDs);

  const isParticipant = (players || []).some(
    (player) => player.playerAddress?.toLowerCase() === address?.toLowerCase(),
  );
  const isSpectator = !address || !isParticipant;

  const currentPlayerIndex = (players || []).findIndex(
    (player) => player.playerAddress?.toLowerCase() === address?.toLowerCase(),
  );

  useEffect(() => {
    if (activeTab !== Action.MOVE) {
      setMovePath([]);
    }
  }, [activeTab]);

  useEffect(() => {
    setMovePath([]);
  }, [gameId, playerID, location, movement]);

  const handleMapTileClick = useCallback((alias) => {
    if (activeTab !== Action.MOVE || isSpectator || !location || movement <= 0) return;

    setMovePath((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === alias) {
        return prev.slice(0, -1);
      }

      const lastTile = prev.length > 0 ? prev[prev.length - 1] : location;
      if (!isAdjacent(lastTile, alias)) return prev;
      if (prev.length >= movement) return prev;
      if (prev.includes(alias)) return prev;
      return [...prev, alias];
    });
  }, [activeTab, isSpectator, location, movement]);

  const enrichedPlayers = (players || []).map((player, i) => {
    const pid = player.playerID !== undefined ? Number(player.playerID) : i + 1;
    const locIdx = (locPlayerIDs || []).findIndex((id) => Number(id) === pid);
    const currentZone = locIdx >= 0 ? playerZones[locIdx] : '';
    return {
      ...player,
      playerID: pid,
      currentZone,
      movement: player.movement !== undefined ? Number(player.movement) : 0,
      agility: player.agility !== undefined ? Number(player.agility) : 0,
      dexterity: player.dexterity !== undefined ? Number(player.dexterity) : 0,
    };
  });

  const queueLabel = queueTelemetry.hasActiveQueue
    ? `Queue #${queueTelemetry.queueID ?? 0} active`
    : 'Queue idle';
  const queueDetail = queueTelemetry.hasActiveQueue
    ? 'Submissions resolve through the live queue.'
    : 'Waiting for the expedition to create a queue.';

  return (
    <div className="space-y-4">
      <div className="rounded border border-exp-border bg-exp-panel/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <DayNightBadge phase={phase} />
          <PhaseIndicator currentPhase={queueTelemetry.phase} />
          <DayCounter gameId={gameId} />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
            {phase || 'Unknown'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
            {queueLabel}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-exp-text-dim">
            {enrichedPlayers.length} aboard
          </span>
        </div>
        <p className="mt-2 font-mono text-[11px] text-exp-text-dim">
          {queueDetail}
        </p>
      </div>

      <MissionStatus
        isSpectator={isSpectator}
        currentAction={action}
        queueTelemetry={queueTelemetry}
        movePathLength={movePath.length}
        crewCount={enrichedPlayers.length}
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
              <div className="rounded border border-exp-border/60 bg-exp-dark/40 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-exp-text-dim">
                  Current location
                </p>
                <p className="mt-1 font-mono text-xs uppercase tracking-widest text-compass-bright">
                  {location}
                </p>
              </div>
            )}
          </div>
          <HexGrid
            gameId={gameId}
            selectedPath={movePath}
            onTileClick={activeTab === Action.MOVE ? handleMapTileClick : undefined}
            onBacktrack={() => setMovePath((prev) => prev.slice(0, -1))}
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
          />
        </div>

        <div className="min-w-0 space-y-3 max-h-[340px] lg:max-h-[620px] 2xl:max-h-[min(720px,calc(100svh-13rem))] overflow-y-auto">
          <h3 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase sticky top-0 bg-exp-dark py-1">
            Expedition Crew
          </h3>
          {enrichedPlayers.map((player, i) => (
            <PlayerDossier
              key={i}
              player={player}
              index={i}
              isCurrentUser={player.playerAddress?.toLowerCase() === address?.toLowerCase()}
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
        <ActionPanel
          gameId={gameId}
          playerID={playerID}
          currentLocation={location}
          stats={stats}
          currentAction={action}
          movement={movement}
          movePath={movePath}
          onMoveSubmit={() => setMovePath([])}
          onMoveClear={() => setMovePath([])}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isSpectator={isSpectator}
        />
      )}

      <TurnResolution gameId={gameId} />

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
    </div>
  );
}
