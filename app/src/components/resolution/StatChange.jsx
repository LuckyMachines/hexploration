import { STAT_LABELS } from '../../lib/constants';
import { statDelta } from '../../lib/formatting';
import { statDetail } from '../../lib/detailText';

export default function StatChange({ statUpdate }) {
  if (!statUpdate || statUpdate.length < 3) return null;

  const changes = statUpdate.map((val, i) => ({
    label: STAT_LABELS[i],
    value: Number(val),
  })).filter((c) => c.value !== 0);

  if (changes.length === 0) return null;
  const gains = changes.filter((change) => change.value > 0);
  const losses = changes.filter((change) => change.value < 0);

  return (
    <div className="space-y-1">
      <div className="flex gap-2 flex-wrap">
        {gains.length > 0 && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-oxide-green">
            Recovered
          </span>
        )}
        {losses.length > 0 && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-red">
            Hurt
          </span>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
      {changes.map((change) => {
        const isPositive = change.value > 0;
        return (
          <span
            key={change.label}
            className={`font-mono text-xs px-1.5 py-0.5 rounded border
              ${isPositive
                ? 'text-oxide-green border-oxide-green/30 bg-oxide-green/5'
                : 'text-signal-red border-signal-red/30 bg-signal-red/5'
              }
            `}
          >
            {change.label} {statDelta(change.value)}
            <span className="ml-1 opacity-70">
              {statDetail(change.value)}
            </span>
          </span>
        );
      })}
      </div>
    </div>
  );
}
