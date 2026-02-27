import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { useGamePhase } from '../../hooks/useGamePhase';
import { useAllPlayers } from '../../hooks/useAllPlayers';
import { useAllPlayerLocations } from '../../hooks/useAllPlayerLocations';
import { usePlayerID } from '../../hooks/usePlayerID';
import { usePlayerSummary } from '../../hooks/usePlayerSummary';
import { useGameEvents } from '../../hooks/useGameEvents';
import { usePlayerMovement } from '../../hooks/usePlayerMovement';
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
import HexGrid from '../board/HexGrid';
import PlayerDossier from '../player/PlayerDossier';
import ActionPanel from '../actions/ActionPanel';
import TurnResolution from '../resolution/TurnResolution';
import EventLog from '../shared/EventLog';

export default function ExpeditionBench({ gameId }) {
  const { address } = useAccount();
  const { phase } = useGamePhase(gameId);
  const { players } = useAllPlayers(gameId);
  const { playerIDs: locPlayerIDs, playerZones } = useAllPlayerLocations(gameId);
  const { playerID } = usePlayerID(gameId, address);
  const { stats, location, action } = usePlayerSummary(gameId, playerID);
  const { movement } = usePlayerMovement(gameId, playerID);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DayNightBadge phase={phase} />
        <PhaseIndicator currentPhase={queueTelemetry.phase} />
        <DayCounter gameId={gameId} />
      </div>

      <TurnTimeline queueTelemetry={queueTelemetry} events={events} />

      <ReadinessMatrix
        players={enrichedPlayers}
        readinessByPlayerID={readinessByPlayerID}
        queueActive={queueTelemetry.hasActiveQueue}
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-exp-border rounded bg-exp-panel p-4 min-h-[400px]">
          <HexGrid
            gameId={gameId}
            selectedPath={movePath}
            onTileClick={activeTab === Action.MOVE ? handleMapTileClick : undefined}
            currentPlayerIndex={currentPlayerIndex}
            currentLocation={location}
            movement={movement}
            isMovePlanning={activeTab === Action.MOVE && !isSpectator}
          />
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          <h3 className="font-mono text-[10px] tracking-[0.3em] text-exp-text-dim uppercase sticky top-0 bg-exp-dark py-1">
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

      <MatchReplay
        events={events}
        onLoadFullHistory={loadFullHistory}
        isLoadingFullHistory={isLoadingFullHistory}
      />

      <EventLog events={events} />
    </div>
  );
}
