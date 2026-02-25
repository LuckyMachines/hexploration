import { useState, useCallback } from 'react';
import { isAdjacent } from '../../lib/hexmath';
import { Action } from '../../lib/constants';
import Spinner from '../shared/Spinner';

export default function MoveControl({ gameId, playerID, currentLocation, movement, onSubmit, disabled }) {
  const [path, setPath] = useState([]);

  const handleTileClick = useCallback((alias) => {
    setPath((prev) => {
      // If clicking the last tile in the path, remove it (undo)
      if (prev.length > 0 && prev[prev.length - 1] === alias) {
        return prev.slice(0, -1);
      }

      // Start from current location
      const lastTile = prev.length > 0 ? prev[prev.length - 1] : currentLocation;

      // Must be adjacent
      if (!isAdjacent(lastTile, alias)) return prev;

      // Can't exceed movement
      if (prev.length >= movement) return prev;

      // Can't revisit
      if (prev.includes(alias)) return prev;

      return [...prev, alias];
    });
  }, [currentLocation, movement]);

  const handleSubmit = () => {
    if (path.length === 0) return;
    // Submit options as the movement path
    onSubmit(Action.MOVE, path);
    setPath([]);
  };

  const handleClear = () => setPath([]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-exp-text-dim">
          Click adjacent tiles to build a path. Movement: <span className="text-compass">{movement}</span> tiles available.
        </p>
        <span className="font-mono text-xs text-compass tabular-nums">
          {path.length}/{movement}
        </span>
      </div>

      {/* Current path display */}
      {path.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-mono text-[10px] text-exp-text-dim uppercase tracking-wider">Path:</span>
          <span className="font-mono text-xs text-compass">{currentLocation}</span>
          {path.map((alias, i) => (
            <span key={i} className="flex items-center gap-1">
              <svg className="w-3 h-3 text-exp-text-dim" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 2l4 4-4 4" />
              </svg>
              <span className="font-mono text-xs text-compass">{alias}</span>
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={disabled || path.length === 0}
          className="px-4 py-2 bg-compass/10 border border-compass/40 rounded text-compass text-xs font-mono tracking-widest uppercase
                     hover:bg-compass/20 hover:border-compass/60 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Submit Move
        </button>
        {path.length > 0 && (
          <button
            onClick={handleClear}
            className="px-3 py-2 border border-exp-border rounded text-exp-text-dim text-xs font-mono tracking-wider uppercase
                       hover:border-exp-text-dim/40 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
