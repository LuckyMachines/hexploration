import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useGamePhase } from './useGamePhase';
import { useAllPlayers } from './useAllPlayers';
import { useAllPlayerLocations } from './useAllPlayerLocations';
import { usePlayerID } from './usePlayerID';
import { usePlayerSummary } from './usePlayerSummary';
import { usePlayerMovement } from './usePlayerMovement';
import { usePlayerInventory } from './usePlayerInventory';
import { useGameEvents } from './useGameEvents';
import { useQueueTelemetry } from './useQueueTelemetry';
import { useSubmissionReadiness } from './useSubmissionReadiness';
import { useGameOver } from './useGameOver';
import { Action } from '../lib/constants';
import { deriveTurnState } from '../lib/turnState';
import { validateMovePath, validateMoveStep } from '../lib/moveValidation';
import { buildTurnReplay } from '../lib/turnReplay';

export function useExpeditionViewModel(gameId) {
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
  const { isGameOver } = useGameOver(gameId);

  const [activeTab, setActiveTab] = useState(Action.MOVE);
  const [movePath, setMovePath] = useState([]);

  const playerIDs = useMemo(
    () => (players || []).map((player, index) => (
      player.playerID !== undefined ? player.playerID : BigInt(index + 1)
    )),
    [players],
  );

  const { readinessByPlayerID } = useSubmissionReadiness(queueTelemetry.queueID, playerIDs);

  const isParticipant = useMemo(
    () => (players || []).some(
      (player) => player.playerAddress?.toLowerCase() === address?.toLowerCase(),
    ),
    [players, address],
  );
  const isSpectator = !address || !isParticipant;

  const currentPlayerIndex = useMemo(
    () => (players || []).findIndex(
      (player) => player.playerAddress?.toLowerCase() === address?.toLowerCase(),
    ),
    [players, address],
  );

  const enrichedPlayers = useMemo(
    () => (players || []).map((player, i) => {
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
    }),
    [players, locPlayerIDs, playerZones],
  );

  const turnState = useMemo(
    () => deriveTurnState({
      isSpectator,
      currentAction: action,
      queueTelemetry,
      isGameOver,
    }),
    [action, isGameOver, isSpectator, queueTelemetry],
  );
  const turnReplay = useMemo(() => buildTurnReplay(events), [events]);

  useEffect(() => {
    if (activeTab !== Action.MOVE) setMovePath([]);
  }, [activeTab]);

  useEffect(() => {
    setMovePath([]);
  }, [gameId, playerID, location, movement]);

  const applyMoveStep = useCallback((alias, reachableTiles = new Set()) => {
    if (activeTab !== Action.MOVE || isSpectator || !location || movement <= 0) {
      return { ok: false, reason: 'Move planning is not active' };
    }

    let result = { ok: false, reason: 'Move not applied' };
    setMovePath((prev) => {
      result = validateMoveStep({
        alias,
        currentLocation: location,
        selectedPath: prev,
        movement,
        reachableTiles,
      });

      if (!result.ok) return prev;
      if (result.intent === 'backtrack') return prev.slice(0, -1);
      return [...prev, alias];
    });
    return result;
  }, [activeTab, isSpectator, location, movement]);

  const clearMovePath = useCallback(() => setMovePath([]), []);
  const backtrackMovePath = useCallback(() => setMovePath((prev) => prev.slice(0, -1)), []);

  const moveValidation = useMemo(
    () => validateMovePath({ currentLocation: location, path: movePath, movement }),
    [location, movePath, movement],
  );

  return {
    gameId,
    address,
    phase,
    playerID,
    players,
    enrichedPlayers,
    readinessByPlayerID,
    isParticipant,
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
    isGameOver,
    activeTab,
    setActiveTab,
    movePath,
    applyMoveStep,
    clearMovePath,
    backtrackMovePath,
    moveValidation,
    turnState,
    turnReplay,
  };
}
