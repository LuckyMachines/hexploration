import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBoardSize } from '../../hooks/useBoardSize';
import { useActiveZones } from '../../hooks/useActiveZones';
import { useAllPlayerLocations } from '../../hooks/useAllPlayerLocations';
import { useLandingSite } from '../../hooks/useLandingSite';
import { useExpeditionInputController } from '../../hooks/useExpeditionInputController';
import { Action, ProcessingPhase, Tile } from '../../lib/constants';
import { buildReachableTiles, validateMoveStep } from '../../lib/moveValidation';
import { emitFeedbackEvent } from '../../lib/feedbackEvents';
import { buildRouteStatus } from '../../lib/routeStatus';
import {
  hexToPixel,
  gridViewBox,
  toAlias,
  aliasToPixel,
  parseAlias,
  getAdjacent,
} from '../../lib/hexmath';
import HexTile from './HexTile';
import FogOverlay from './FogOverlay';
import PlayerMarker from './PlayerMarker';
import LandingMarker from './LandingMarker';
import PathOverlay from './PathOverlay';
import BoardPresence from './BoardPresence';
import TerrainLegend from './TerrainLegend';
import Spinner from '../shared/Spinner';

function submittedAction(action) {
  return action && action !== '' && action !== 'Idle';
}

function adjacentAliases(alias) {
  const coord = parseAlias(alias);
  return coord ? getAdjacent(coord.col, coord.row) : [];
}

export default function HexGrid({
  gameId,
  selectedPath = [],
  onTileClick,
  onBacktrack,
  currentPlayerIndex,
  currentLocation = '',
  movement = 0,
  isMovePlanning = false,
  activeAction = Action.MOVE,
  currentAction = '',
  queuePhase,
  isSpectator = false,
  stats = {},
  activeInventory = {},
  turnState,
  onPlayerFocus,
  onInputSnapshot,
}) {
  const { rows, columns, isLoading: loadingSize } = useBoardSize();
  const { zones, tiles, campsites } = useActiveZones(gameId);
  const { playerIDs, playerZones } = useAllPlayerLocations(gameId);
  const { zoneAlias: landingSite } = useLandingSite(gameId);
  const [hoveredTile, setHoveredTile] = useState(null);
  const [intentTile, setIntentTile] = useState(null);

  const revealedMap = useMemo(() => {
    const map = {};
    if (zones && tiles) {
      zones.forEach((alias, i) => {
        map[alias] = {
          tileType: Number(tiles[i] || 0),
          hasCampsite: campsites?.[i] ?? false,
        };
      });
    }
    return map;
  }, [zones, tiles, campsites]);

  const playerLocationMap = useMemo(() => {
    const map = {};
    if (playerIDs && playerZones) {
      playerZones.forEach((zone, i) => {
        if (!zone) return;
        if (!map[zone]) map[zone] = [];
        map[zone].push(i);
      });
    }
    return map;
  }, [playerIDs, playerZones]);

  const allHexes = useMemo(() => {
    const hexes = [];
    for (let col = 0; col < columns; col++) {
      for (let row = 0; row < rows; row++) {
        const alias = toAlias(col, row);
        const { x, y } = hexToPixel(col, row);
        hexes.push({ alias, x, y });
      }
    }
    return hexes;
  }, [columns, rows]);

  const reachableTiles = useMemo(() => {
    if (!isMovePlanning || !currentLocation || movement <= 0 || !rows || !columns) {
      return new Set();
    }
    return buildReachableTiles({
      currentLocation,
      movement,
      rows,
      columns,
      revealedZones: zones,
    });
  }, [isMovePlanning, currentLocation, movement, rows, columns, zones]);

  useEffect(() => {
    if (currentLocation) setIntentTile(currentLocation);
  }, [currentLocation]);

  const canChooseTile = useCallback((alias) => {
    if (!onTileClick) return false;
    if (!isMovePlanning) return true;
    return validateMoveStep({
      alias,
      currentLocation,
      selectedPath,
      movement,
      reachableTiles,
    }).ok;
  }, [currentLocation, isMovePlanning, movement, onTileClick, reachableTiles, selectedPath]);

  const intentAlias = hoveredTile || intentTile || currentLocation || landingSite || allHexes[0]?.alias || '';
  const intentTileData = revealedMap[intentAlias] || null;

  const input = useExpeditionInputController({
    columns,
    rows,
    allHexes,
    currentLocation,
    intentAlias,
    selectedPath,
    canChooseTile,
    onIntentMove: (alias) => {
      setHoveredTile(null);
      setIntentTile(alias);
    },
    onCommit: (alias) => onTileClick?.(alias, reachableTiles),
    onBacktrack,
    emitFeedback: (kind, mode) => {
      emitFeedbackEvent({
        source: 'board',
        kind,
        inputMode: mode,
        activeAction,
        turnState: turnState?.state,
      });
    },
  });

  const handleHover = useCallback((alias) => {
    input.markInput('mouse', 'hover', 0.25);
    setHoveredTile(alias);
    if (alias) setIntentTile(alias);
  }, [input]);

  const handleTileClick = useCallback((alias) => {
    setIntentTile(alias);
    input.commitIntent(alias, 'mouse', 0.75);
  }, [input]);

  useEffect(() => {
    onInputSnapshot?.({
      inputMode: input.inputMode,
      inputCadence: input.inputCadence,
      lastInputKind: input.lastInputKind,
      analogPressure: input.analogPressure,
      isObserving: input.isObserving,
    });
  }, [
    input.analogPressure,
    input.inputCadence,
    input.inputMode,
    input.isObserving,
    input.lastInputKind,
    onInputSnapshot,
  ]);

  if (loadingSize || !rows || !columns) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="w-full max-w-xl rounded border border-exp-border bg-exp-dark/45 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4 border-b border-exp-border/60 pb-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-exp-text-dim">
                Survey scan
              </p>
              <p className="mt-1 font-mono text-xs text-exp-text-dim">
                Boarding map and terrain data are still arriving.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-compass">
              <Spinner size="w-4 h-4" />
              Loading
            </div>
          </div>

          <div className="mt-4 grid grid-cols-6 gap-2 opacity-60">
            {Array.from({ length: 24 }).map((_, index) => (
              <div
                key={index}
                className="hex-clip aspect-square border border-exp-border/60 bg-exp-surface/60 animate-pulse"
                style={{ animationDelay: `${(index % 6) * 80}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const viewBox = gridViewBox(columns, rows);
  const [, , viewBoxWidth, viewBoxHeight] = viewBox.split(' ').map(Number);
  const boardAspect = viewBoxWidth && viewBoxHeight ? viewBoxWidth / viewBoxHeight : 1;
  const boardMaxWidthPx = Math.round(760 * boardAspect);
  const boardMaxWidthSvh = Number((75 * boardAspect).toFixed(3));
  const boardMaxWidth = `min(100%, ${boardMaxWidthPx}px, ${boardMaxWidthSvh}svh)`;
  const hasSubmitted = submittedAction(currentAction);
  const isResolving = queuePhase === ProcessingPhase.PROCESSING || queuePhase === ProcessingPhase.PLAY_THROUGH;
  const heavyRoute = selectedPath.length >= Math.max(2, movement - 1);
  const previewPath = canChooseTile(intentAlias) && !selectedPath.includes(intentAlias)
    ? [...selectedPath, intentAlias]
    : selectedPath;
  const intentNeighbors = new Set(adjacentAliases(intentAlias));
  const companionLocations = Object.entries(playerLocationMap)
    .flatMap(([zone, playerIndices]) => playerIndices
      .filter((index) => index !== currentPlayerIndex)
      .map((index) => ({ zone, index, isNearIntent: intentNeighbors.has(zone) })));
  const revealedAliases = new Set(zones || []);
  const intentIsFog = Boolean(intentAlias && !revealedAliases.has(intentAlias));
  const intentIsDanger = intentTileData?.tileType === Tile.RELIC || intentIsFog || activeAction === Action.FLEE;
  const fatigue = Math.min(1, Math.max(
    selectedPath.length / Math.max(1, movement || 1),
    stats.movement <= 1 ? 0.75 : 0,
  ));
  const routeStatus = buildRouteStatus({
    currentLocation,
    path: selectedPath,
    movement,
    validation: {
      ok: !onTileClick || !intentAlias || canChooseTile(intentAlias),
      reason: 'Intent tile is not reachable from this route.',
    },
    activeInventory,
    companionLocations,
  });
  const controlFeel = {
    analogPressure: input.analogPressure,
    inputCadence: input.isObserving ? 'idle' : input.inputCadence,
    lastInputKind: input.lastInputKind,
    backtrackCount: input.backtrackCount,
    invalidCount: input.invalidCount,
    commitCount: input.commitCount,
    lanternPing: input.lanternPing,
    fatigue,
    intentIsDanger,
    intentIsFog,
    pathIsHeavy: heavyRoute,
    lowStats: stats.movement <= 1 || stats.agility <= 1 || stats.dexterity <= 1,
    activeInventory,
    routeStatus,
  };

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 justify-center">
        <div
          ref={input.boardRef}
          data-testid="hex-board-viewport"
          tabIndex={0}
          role="application"
          aria-label="Expedition survey board"
          onKeyDown={input.handleKeyDown}
          onMouseDown={() => input.boardRef.current?.focus()}
          className={`w-full min-w-0 outline-none transition-[filter] duration-500 focus-visible:ring-2 focus-visible:ring-compass/60 ${input.isObserving ? 'alive-observation-mode' : ''}`}
          style={{ maxWidth: boardMaxWidth }}
        >
          <svg
            viewBox={viewBox}
            className="block h-auto w-full max-h-[min(75svh,760px)]"
            style={{ aspectRatio: `${viewBoxWidth} / ${viewBoxHeight}` }}
          >
            {allHexes.map(({ alias, x, y }) => {
              const revealed = revealedMap[alias];

              if (revealed) {
                return (
                  <HexTile
                    key={alias}
                    cx={x}
                    cy={y}
                    tileType={revealed.tileType}
                    alias={alias}
                    hasCampsite={revealed.hasCampsite}
                    isSelected={selectedPath.includes(alias)}
                    isHovered={hoveredTile === alias}
                    isIntent={intentAlias === alias}
                    isReachable={reachableTiles.has(alias)}
                    isInventoryAssisted={Boolean(
                      activeInventory.shield && reachableTiles.has(alias)
                      || activeInventory.relic && intentAlias === alias,
                    )}
                    isCommitted={hasSubmitted && selectedPath.includes(alias)}
                    onClick={onTileClick ? handleTileClick : undefined}
                    onHover={handleHover}
                  />
                );
              }

              return (
                <FogOverlay
                  key={alias}
                  cx={x}
                  cy={y}
                  alias={alias}
                  onClick={onTileClick ? handleTileClick : undefined}
                  isReachable={reachableTiles.has(alias)}
                  isInventoryAssisted={Boolean(activeInventory.artifact && reachableTiles.has(alias))}
                  isIntent={intentAlias === alias}
                  onHover={handleHover}
                />
              );
            })}

            {landingSite && (() => {
              const pos = aliasToPixel(landingSite);
              return <LandingMarker cx={pos.x} cy={pos.y} />;
            })()}

            <PathOverlay
              origin={currentLocation}
              path={selectedPath}
              isCommitted={hasSubmitted}
              isHeavy={heavyRoute}
            />

            <BoardPresence
              currentLocation={currentLocation}
              intentAlias={intentAlias}
              intentTile={intentTileData}
              activeAction={activeAction}
              path={selectedPath}
              previewPath={previewPath}
              hasSubmitted={hasSubmitted}
              isResolving={turnState?.isResolving ?? isResolving}
              isSpectator={isSpectator}
              isObserving={input.isObserving}
              invalidPulse={input.invalidPulse}
              inputMode={input.inputMode}
              currentPlayerIndex={Math.max(0, currentPlayerIndex)}
              movement={movement}
              stats={stats}
              companionLocations={companionLocations}
              controlFeel={controlFeel}
            />

            {Object.entries(playerLocationMap).map(([zone, playerIndices]) =>
              playerIndices.map((pIdx) => {
                const pos = aliasToPixel(zone);
                return (
                  <PlayerMarker
                    key={`p-${pIdx}`}
                    cx={pos.x}
                    cy={pos.y}
                  playerIndex={pIdx}
                  isCurrentPlayer={pIdx === currentPlayerIndex}
                  onClick={() => onPlayerFocus?.(pIdx + 1)}
                />
                );
              }))}
          </svg>
        </div>
      </div>

      <TerrainLegend />
    </div>
  );
}
