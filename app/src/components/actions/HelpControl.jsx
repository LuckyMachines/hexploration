import { useState } from 'react';
import { useAllPlayers } from '../../hooks/useAllPlayers';
import { truncateAddress } from '../../lib/formatting';

export default function HelpControl({ gameId, currentPlayerID, onSubmit, disabled }) {
  const { players } = useAllPlayers(gameId);
  const [targetPID, setTargetPID] = useState('');
  const [selectedStat, setSelectedStat] = useState('');

  const statOptions = ['Movement', 'Agility', 'Dexterity'];

  const otherPlayers = (players || []).filter((player) => {
    const pid = player.playerID !== undefined ? Number(player.playerID) : 0;
    return pid !== Number(currentPlayerID || 0);
  });

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-exp-text-dim">
        Assist another player at your location by boosting one of their stats.
      </p>

      <div>
        <label className="font-mono text-xs text-exp-text-dim uppercase tracking-wider block mb-1">
          Target Explorer
        </label>
        <select
          value={targetPID}
          onChange={(e) => setTargetPID(e.target.value)}
          className="bg-exp-dark border border-exp-border rounded text-xs font-mono text-exp-text
                     px-3 py-1.5 cursor-pointer hover:border-compass/40 transition-colors w-full"
        >
          <option value="">Select target...</option>
          {otherPlayers.map((player, i) => {
            const pid = player.playerID !== undefined ? Number(player.playerID) : i + 1;
            const addr = player.playerAddress || '';
            return (
              <option key={pid} value={pid} className="bg-exp-dark text-exp-text">
                P{pid} - {truncateAddress(addr)}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <label className="font-mono text-xs text-exp-text-dim uppercase tracking-wider block mb-1">
          Attribute to Boost
        </label>
        <div className="flex gap-2">
          {statOptions.map((stat) => (
            <button
              key={stat}
              onClick={() => setSelectedStat(stat)}
              className={`
                px-3 py-1.5 text-xs font-mono uppercase tracking-wider
                border rounded transition-all duration-200
                ${selectedStat === stat
                  ? 'text-compass-bright bg-compass/10 border-compass/40'
                  : 'text-exp-text-dim bg-exp-dark/40 border-exp-border hover:text-exp-text hover:border-exp-text-dim/40'
                }
              `}
            >
              {stat}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => {
          if (targetPID && selectedStat) onSubmit(targetPID, selectedStat);
        }}
        disabled={disabled || !targetPID || !selectedStat}
        className="px-4 py-2 bg-compass/10 border border-compass/40 rounded text-compass text-xs font-mono tracking-widest uppercase
                   hover:bg-compass/20 hover:border-compass/60 transition-colors
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Help Explorer
      </button>
    </div>
  );
}
