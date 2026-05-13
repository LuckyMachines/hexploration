import { useFeedbackLog } from '../../hooks/useFeedbackLog';
import { getActionMeta } from '../../lib/actionMeta';

function DebugCell({ label, value }) {
  return (
    <div className="rounded border border-exp-border/60 bg-exp-dark/45 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-exp-text-dim">
        {label}
      </div>
      <div className="mt-1 break-all font-mono text-xs text-compass-bright">
        {value ?? 'none'}
      </div>
    </div>
  );
}

export default function ExpeditionDebugOverlay({ view }) {
  const feedback = useFeedbackLog(8);
  const actionMeta = getActionMeta(view.activeTab);

  return (
    <section className="rounded border border-blueprint/35 bg-blueprint/5 px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-blueprint">
            Integration Debug
          </h3>
          <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
            Single view model, turn state, intent path, queue state, and feedback events.
          </p>
        </div>
        <span className="rounded border border-blueprint/40 bg-exp-dark/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-blueprint">
          {view.turnState.state}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <DebugCell label="Action" value={`${actionMeta.label} / ${actionMeta.stance}`} />
        <DebugCell label="Location" value={view.location || 'unknown'} />
        <DebugCell label="Intent Path" value={view.movePath.length > 0 ? view.movePath.join(' -> ') : 'empty'} />
        <DebugCell label="Validation" value={view.moveValidation.reason} />
        <DebugCell label="Queue" value={`#${view.queueTelemetry.queueID?.toString?.() || 0} ${view.turnState.phaseLabel}`} />
        <DebugCell label="Submissions" value={`${view.queueTelemetry.submittedCount}/${view.queueTelemetry.totalPlayers}`} />
        <DebugCell label="Player" value={view.playerID?.toString?.() || view.playerID || 'none'} />
        <DebugCell label="Stats" value={`M${view.stats.movement} A${view.stats.agility} D${view.stats.dexterity}`} />
      </div>

      <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/45 px-3 py-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.26em] text-exp-text-dim">
          Feedback Events
        </div>
        <div className="mt-2 grid gap-1">
          {feedback.length === 0 ? (
            <p className="font-mono text-xs text-exp-text-dim">No feedback events yet.</p>
          ) : feedback.map((event, index) => (
            <p key={`${event.at}-${index}`} className="font-mono text-xs text-exp-text-dim">
              <span className="text-blueprint">{event.source}</span> / {event.kind} / {event.inputMode || 'n/a'} / {event.turnState || 'n/a'}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
