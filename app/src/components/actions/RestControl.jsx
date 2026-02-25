import { useState } from 'react';
import { STAT_LABELS } from '../../lib/constants';

export default function RestControl({ onSubmit, disabled }) {
  const [selectedStat, setSelectedStat] = useState('');

  const statOptions = ['Movement', 'Agility', 'Dexterity'];

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-exp-text-dim">
        Recover one point in a chosen attribute. Resting at a campsite gives better results.
      </p>

      <div className="flex gap-2">
        {statOptions.map((stat) => (
          <button
            key={stat}
            onClick={() => setSelectedStat(stat)}
            className={`
              px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider
              border rounded transition-all duration-200
              ${selectedStat === stat
                ? 'text-blueprint bg-blueprint/10 border-blueprint/40'
                : 'text-exp-text-dim bg-exp-dark/40 border-exp-border hover:text-exp-text hover:border-exp-text-dim/40'
              }
            `}
          >
            {stat}
          </button>
        ))}
      </div>

      <button
        onClick={() => {
          if (selectedStat) onSubmit(selectedStat);
        }}
        disabled={disabled || !selectedStat}
        className="px-4 py-2 bg-blueprint/10 border border-blueprint/40 rounded text-blueprint text-xs font-mono tracking-widest uppercase
                   hover:bg-blueprint/20 hover:border-blueprint/60 transition-colors
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Rest ({selectedStat || '...'})
      </button>
    </div>
  );
}
