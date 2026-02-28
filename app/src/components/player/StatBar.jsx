import { MAX_STAT } from '../../lib/constants';

const STAT_COLORS = {
  Movement: 'bg-compass',
  Agility: 'bg-oxide-green',
  Dexterity: 'bg-blueprint',
};

export default function StatBar({ label, value, max = MAX_STAT }) {
  const color = STAT_COLORS[label] || 'bg-compass';

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs tracking-wider text-exp-text-dim uppercase w-14 shrink-0">
        {label.slice(0, 3)}
      </span>
      <div className="flex gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-sm border transition-colors duration-300
              ${i < value
                ? `${color} border-transparent`
                : 'bg-exp-dark border-exp-border'
              }
            `}
          />
        ))}
      </div>
      <span className="font-mono text-xs text-exp-text-dim tabular-nums w-4 text-right">
        {value}
      </span>
    </div>
  );
}
