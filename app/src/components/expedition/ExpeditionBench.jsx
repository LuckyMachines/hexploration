import { useAccount } from 'wagmi';
import { useGamePhase } from '../../hooks/useGamePhase';
import { useAllPlayers } from '../../hooks/useAllPlayers';
import { useAllPlayerLocations } from '../../hooks/useAllPlayerLocations';
import { usePlayerID } from '../../hooks/usePlayerID';
import { usePlayerSummary } from '../../hooks/usePlayerSummary';
import { useGameEvents } from '../../hooks/useGameEvents';
import DayNightBadge from './DayNightBadge';
import DayCounter from './DayCounter';
import PhaseIndicator from './PhaseIndicator';
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
  const { events } = useGameEvents(gameId);

  // Build enriched player list with locations
  const enrichedPlayers = (players || []).map((p, i) => {
    const pid = p.playerID !== undefined ? Number(p.playerID) : i + 1;
    const locIdx = (locPlayerIDs || []).findIndex((id) => Number(id) === pid);
    const currentZone = locIdx >= 0 ? playerZones[locIdx] : '';
    return {
      ...p,
      playerID: pid,
      currentZone,
      movement: p.movement !== undefined ? Number(p.movement) : 0,
      agility: p.agility !== undefined ? Number(p.agility) : 0,
      dexterity: p.dexterity !== undefined ? Number(p.dexterity) : 0,
    };
  });

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DayNightBadge phase={phase} />
        <PhaseIndicator currentPhase={0} />
        <DayCounter gameId={gameId} />
      </div>

      {/* Main split: hex grid + player dossiers */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Hex grid (takes 2 columns) */}
        <div className="lg:col-span-2 border border-exp-border rounded bg-exp-panel p-4 min-h-[400px]">
          <HexGrid gameId={gameId} />
        </div>

        {/* Player dossiers (right column) */}
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

      {/* Action panel */}
      <ActionPanel
        gameId={gameId}
        playerID={playerID}
        currentLocation={location}
        stats={stats}
        currentAction={action}
      />

      {/* Turn resolution */}
      <TurnResolution gameId={gameId} />

      {/* Event log */}
      <EventLog events={events} />
    </div>
  );
}
