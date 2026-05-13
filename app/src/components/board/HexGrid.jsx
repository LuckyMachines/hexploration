import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBoardSize } from '../../hooks/useBoardSize';
import { useActiveZones } from '../../hooks/useActiveZones';
import { useAllPlayerLocations } from '../../hooks/useAllPlayerLocations';
import { useLandingSite } from '../../hooks/useLandingSite';
import { Action, ProcessingPhase } from '../../lib/constants';
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
}) {
  const { rows, columns, isLoading: loadingSize } = useBoardSize();
  const { zones, tiles, campsites } = useActiveZones(gameId);
  const { playerIDs, playerZones } = useAllPlayerLocations(gameId);
  const { zoneAlias: landingSite } = useLandingSite(gameId);
  const [hoveredTile, setHoveredTile] = useState(null);
  const [intentTile, setIntentTile] = useState(null);
  const [inputMode, setInputMode] = useState('mouse');
  const [invalidPulse, setInvalidPulse] = useState(false);
  const [isObserving, setIsObserving] = useState(false);
  const boardRef = useRef(null);
  const lastInputAtRef = useRef(Date.now());
  const audioContextRef = useRef(null);

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

    const start = parseAlias(currentLocation);
    if (!start) return new Set();

    const revealed = new Set(zones || []);
    const inBounds = (alias) => {
      const coord = parseAlias(alias);
      return coord
        && coord.col >= 0 && coord.col < columns
        && coord.row >= 0 && coord.row < rows;
    };

    const visited = new Set([currentLocation]);
    const reachable = new Set();
    let frontier = [currentLocation];

    for (let step = 0; step < movement; step++) {
      const next = [];
      frontier.forEach((alias) => {
        const coord = parseAlias(alias);
        if (!coord) return;
        getAdjacent(coord.col, coord.row).forEach((neighbor) => {
          if (!inBounds(neighbor) || !revealed.has(neighbor) || visited.has(neighbor)) return;
          visited.add(neighbor);
          reachable.add(neighbor);
          next.push(neighbor);
        });
      });
      frontier = next;
      if (frontier.length === 0) break;
    }

    return reachable;
  }, [isMovePlanning, currentLocation, movement, rows, columns, zones]);

  useEffect(() => {
    if (currentLocation) setIntentTile(currentLocation);
  }, [currentLocation]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsObserving(Date.now() - lastInputAtRef.current > 2400);
    }, 400);
    return () => window.clearInterval(timer);
  }, []);

  const markInput = useCallback((mode) => {
    lastInputAtRef.current = Date.now();
    setIsObserving(false);
    setInputMode(mode);
  }, []);

  const pulseInvalid = useCallback(() => {
    setInvalidPulse(true);
    window.setTimeout(() => setInvalidPulse(false), 260);
  }, []);

  const triggerFeedback = useCallback((kind) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(kind === 'invalid' ? 34 : kind === 'commit' ? 18 : 8);
    }

    if (typeof window === 'undefined') return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      audioContextRef.current ||= new AudioContextCtor();
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      oscillator.type = kind === 'invalid' ? 'square' : 'triangle';
      oscillator.frequency.setValueAtTime(kind === 'invalid' ? 120 : kind === 'commit' ? 420 : 260, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === 'invalid' ? 0.024 : 0.014, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.09);
    } catch {
      // Audio is a progressive enhancement; ignored when browsers block it.
    }
  }, []);

  const canChooseTile = useCallback((alias) => {
    if (!onTileClick) return false;
    if (!isMovePlanning) return true;
    if (!currentLocation || movement <= 0) return false;

    const lastSelected = selectedPath[selectedPath.length - 1];
    if (alias === lastSelected) return true;
    if (selectedPath.includes(alias)) return false;
    if (selectedPath.length >= movement) return false;

    const lastTile = lastSelected || currentLocation;
    const coord = parseAlias(lastTile);
    return Boolean(coord && reachableTiles.has(alias) && getAdjacent(coord.col, coord.row).includes(alias));
  }, [currentLocation, isMovePlanning, movement, onTileClick, reachableTiles, selectedPath]);

  const handleHover = useCallback((alias) => {
    markInput('mouse');
    setHoveredTile(alias);
    if (alias) setIntentTile(alias);
  }, [markInput]);

  const handleTileClick = useCallback((alias) => {
    markInput('mouse');
    setIntentTile(alias);

    if (!canChooseTile(alias)) {
      pulseInvalid();
      triggerFeedback('invalid');
      return;
    }

    triggerFeedback('commit');
    onTileClick?.(alias);
  }, [canChooseTile, markInput, onTileClick, pulseInvalid, triggerFeedback]);

  const intentAlias = hoveredTile || intentTile || currentLocation || landingSite || allHexes[0]?.alias || '';
  const intentTileData = revealedMap[intentAlias] || null;

  const moveIntentBy = useCallback((deltaCol, deltaRow, mode = 'keyboard') => {
    markInput(mode);
    const current = parseAlias(intentAlias || currentLocation || allHexes[0]?.alias);
    if (!current) return;

    const nextCol = Math.max(0, Math.min(columns - 1, current.col + deltaCol));
    const nextRow = Math.max(0, Math.min(rows - 1, current.row + deltaRow));
    const nextAlias = toAlias(nextCol, nextRow);
    setHoveredTile(null);
    setIntentTile(nextAlias);
    triggerFeedback('move');
  }, [allHexes, columns, currentLocation, intentAlias, markInput, rows, triggerFeedback]);

  const commitIntent = useCallback((mode = 'keyboard') => {
    if (!intentAlias) return;
    markInput(mode);
    if (!canChooseTile(intentAlias)) {
      pulseInvalid();
      triggerFeedback('invalid');
      return;
    }
    triggerFeedback('commit');
    onTileClick?.(intentAlias);
  }, [canChooseTile, intentAlias, markInput, onTileClick, pulseInvalid, triggerFeedback]);

  const backtrackIntent = useCallback((mode = 'keyboard') => {
    markInput(mode);
    if (selectedPath.length === 0) {
      pulseInvalid();
      triggerFeedback('invalid');
      return;
    }
    triggerFeedback('move');
    onBacktrack?.();
  }, [markInput, onBacktrack, pulseInvalid, selectedPath.length, triggerFeedback]);

  const handleKeyDown = useCallback((event) => {
    const key = event.key.toLowerCase();
    const keyMoves = {
      arrowup: [0, -1],
      w: [0, -1],
      arrowdown: [0, 1],
      s: [0, 1],
      arrowleft: [-1, 0],
      a: [-1, 0],
      arrowright: [1, 0],
      d: [1, 0],
    };

    if (keyMoves[key]) {
      event.preventDefault();
      moveIntentBy(keyMoves[key][0], keyMoves[key][1], 'keys');
      return;
    }

    if (key === 'enter' || key === ' ') {
      event.preventDefault();
      commitIntent('keys');
      return;
    }

    if (key === 'escape' || key === 'backspace') {
      event.preventDefault();
      backtrackIntent('keys');
    }
  }, [backtrackIntent, commitIntent, moveIntentBy]);

  useEffect(() => {
    let frame = 0;
    let lastStepAt = 0;
    let lastCommitAt = 0;

    const pollGamepad = () => {
      const pads = navigator.getGamepads?.() || [];
      const pad = Array.from(pads).find(Boolean);
      const now = performance.now();

      if (pad) {
        const horizontal = Math.abs(pad.axes[0] || 0) > 0.45 ? Math.sign(pad.axes[0]) : 0;
        const vertical = Math.abs(pad.axes[1] || 0) > 0.45 ? Math.sign(pad.axes[1]) : 0;

        if ((horizontal || vertical) && now - lastStepAt > 170) {
          moveIntentBy(horizontal, vertical, 'pad');
          lastStepAt = now;
        }

        if (pad.buttons[0]?.pressed && now - lastCommitAt > 260) {
          commitIntent('pad');
          lastCommitAt = now;
        }

        if (pad.buttons[1]?.pressed && now - lastCommitAt > 260) {
          backtrackIntent('pad');
          lastCommitAt = now;
        }
      }

      frame = window.requestAnimationFrame(pollGamepad);
    };

    frame = window.requestAnimationFrame(pollGamepad);
    return () => window.cancelAnimationFrame(frame);
  }, [backtrackIntent, commitIntent, moveIntentBy]);

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

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 justify-center">
        <div
          ref={boardRef}
          data-testid="hex-board-viewport"
          tabIndex={0}
          role="application"
          aria-label="Expedition survey board"
          onKeyDown={handleKeyDown}
          onMouseDown={() => boardRef.current?.focus()}
          className={`w-full min-w-0 outline-none transition-[filter] duration-500 ${isObserving ? 'alive-observation-mode' : ''}`}
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
              hasSubmitted={hasSubmitted}
              isResolving={isResolving}
              isSpectator={isSpectator}
              isObserving={isObserving}
              invalidPulse={invalidPulse}
              inputMode={inputMode}
              currentPlayerIndex={Math.max(0, currentPlayerIndex)}
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
