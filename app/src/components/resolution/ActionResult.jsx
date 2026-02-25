import { truncateAddress } from '../../lib/formatting';

export default function ActionResult({ playerAction }) {
  if (!playerAction) return null;

  const pid = playerAction.playerID !== undefined ? Number(playerAction.playerID) : '?';
  const action = playerAction.action || playerAction.actionString || '?';
  const outcome = playerAction.outcome || playerAction.outcomeString || '';
  const zone = playerAction.zone || playerAction.currentZone || '';

  return (
    <div className="flex items-start gap-3 p-2 rounded border border-exp-border/50 bg-exp-dark/40">
      {/* Player badge */}
      <span className="shrink-0 w-6 h-6 rounded-full bg-compass/20 border border-compass/40
                       flex items-center justify-center text-compass text-[10px] font-mono tabular-nums">
        P{pid}
      </span>

      <div className="flex-1 min-w-0">
        {/* Action name */}
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-xs text-compass uppercase tracking-wider">
            {action}
          </span>
          {zone && (
            <span className="font-mono text-[10px] text-exp-text-dim">
              @ {zone}
            </span>
          )}
        </div>

        {/* Outcome */}
        {outcome && (
          <p className="font-mono text-[10px] text-exp-text-dim leading-relaxed">
            {outcome}
          </p>
        )}
      </div>
    </div>
  );
}
