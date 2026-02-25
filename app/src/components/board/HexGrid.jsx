import { useState, useMemo } from 'react';
import { useBoardSize } from '../../hooks/useBoardSize';
import { useActiveZones } from '../../hooks/useActiveZones';
import { useAllPlayerLocations } from '../../hooks/useAllPlayerLocations';
import { useLandingSite } from '../../hooks/useLandingSite';
import { hexToPixel, gridViewBox, toAlias, aliasToPixel } from '../../lib/hexmath';
import HexTile from './HexTile';
import FogOverlay from './FogOverlay';
import PlayerMarker from './PlayerMarker';
import LandingMarker from './LandingMarker';
import PathOverlay from './PathOverlay';
import TerrainLegend from './TerrainLegend';
import Spinner from '../shared/Spinner';

export default function HexGrid({ gameId, selectedPath = [], onTileClick, currentPlayerIndex }) {
  const { rows, columns, isLoading: loadingSize } = useBoardSize();
  const { zones, tiles, campsites } = useActiveZones(gameId);
  const { playerIDs, playerZones } = useAllPlayerLocations(gameId);
  const { zoneAlias: landingSite } = useLandingSite(gameId);
  const [hoveredTile, setHoveredTile] = useState(null);

  // Build a map of revealed zones
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

  // Build player location map: alias → [playerIndex, ...]
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

  // Build all hex positions
  const allHexes = [];
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < rows; row++) {
      const alias = toAlias(col, row);
      const { x, y } = hexToPixel(col, row);
      allHexes.push({ col, row, alias, x, y });
    }
  }

  return (
    <div>
      <svg
        viewBox={viewBox}
        className="w-full h-auto"
        style={{ maxHeight: '450px' }}
      >
        {/* All hexes */}
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
            />
          );
        })}

        {/* Landing site marker */}
        {landingSite && (() => {
          const pos = aliasToPixel(landingSite);
          return <LandingMarker cx={pos.x} cy={pos.y} />;
        })()}

        {/* Movement path overlay */}
        <PathOverlay path={selectedPath} />

        {/* Player markers */}
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
          })
        )}
      </svg>

      <TerrainLegend />
    </div>
  );
}
