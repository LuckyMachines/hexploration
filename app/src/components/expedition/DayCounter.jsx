import { useReadContract } from 'wagmi';
import { gameSummaryRead } from '../../config/contracts';
import { parseUintId, safeUintId } from '../../lib/ids';

export default function DayCounter({ gameId }) {
  const gid = parseUintId(gameId);
  const { data } = useReadContract({
    ...gameSummaryRead('currentDay', [safeUintId(gid)]),
    query: {
      enabled: gid !== null,
      refetchInterval: 5000,
    },
  });

  const day = data !== undefined ? Number(data) : 0;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-exp-border bg-exp-dark/40">
      <span className="font-display text-xs tracking-[0.3em] text-exp-text-dim uppercase">Day</span>
      <span className="font-mono text-sm text-compass-bright tabular-nums">{day}</span>
    </div>
  );
}
