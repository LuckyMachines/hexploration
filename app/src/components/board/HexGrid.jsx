import { useMemo, useState } from 'react';
import { useBoardSize } from '../../hooks/useBoardSize';
import { useActiveZones } from '../../hooks/useActiveZones';
import { useAllPlayerLocations } from '../../hooks/useAllPlayerLocations';
import { useLandingSite } from '../../hooks/useLandingSite';
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
import TerrainLegend from './TerrainLegend';
import Spinner from '../shared/Spinner';

export default function HexGrid({
  gameId,
  selectedPath = [],
  onTileClick,
  currentPlayerIndex,
  currentLocation = '',
  movement = 0,
  isMovePlanning = false,
}) {
  const { rows, columns, isLoading: loadingSize } = useBoardSize();
  const { zones, tiles, campsites } = useActiveZones(gameId);
  const { playerIDs, playerZones } = useAllPlayerLocations(gameId);
  const { zoneAlias: landingSite } = useLandingSite(gameId);
  const [hoveredTile, setHoveredTile] = useState(null);

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

  if (loadingSize || !rows || !columns) {
    return (
      <div className="flex items-center justify-center h-full gap-3">
        <Spinner size="w-5 h-5" />
        <span className="font-mono text-xs text-exp-text-dim tracking-wider uppercase">
          Loading grid...
        </span>
      </div>
    );
  }

  const viewBox = gridViewBox(columns, rows);

  const allHexes = [];
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < rows; row++) {
      const alias = toAlias(col, row);
      const { x, y } = hexToPixel(col, row);
      allHexes.push({ alias, x, y });
    }
  }

  return (
    <div>
      <svg
        viewBox={viewBox}
        className="w-full h-auto"
        style={{ maxHeight: '450px' }}
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
                isReachable={reachableTiles.has(alias)}
                onClick={onTileClick}
                onHover={setHoveredTile}
              />
            );
          }

          return (
            <FogOverlay
              key={alias}
              cx={x}
              cy={y}
              alias={alias}
              onClick={onTileClick}
              isReachable={reachableTiles.has(alias)}
            />
          );
        })}

        {landingSite && (() => {
          const pos = aliasToPixel(landingSite);
          return <LandingMarker cx={pos.x} cy={pos.y} />;
        })()}

        <PathOverlay origin={currentLocation} path={selectedPath} />

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

      <TerrainLegend />
    </div>
  );
}
