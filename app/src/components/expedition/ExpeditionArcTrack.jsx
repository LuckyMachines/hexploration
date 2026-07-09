import { ARC_DEFINITIONS, ARC_ORDER, arcToneClass } from '../../lib/expeditionArc';

const PROGRESS_LABELS = [
  ['chartProgress', 'Chart'],
  ['valueProgress', 'Value'],
  ['routeProgress', 'Route'],
  ['crewProgress', 'Crew'],
];

export default function ExpeditionArcTrack({ arc }) {
  if (!arc) return null;
  const currentIndex = ARC_ORDER.indexOf(arc.id);

  return (
    <section
      aria-label={`Expedition arc: ${arc.label}`}
      className={`rounded border px-4 py-3 ${arcToneClass(arc)}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-75">
            Expedition arc
          </p>
          <h3 className="mt-1 font-display text-base uppercase tracking-[0.16em] text-exp-text">
            {arc.label}
          </h3>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {arc.summary}
          </p>
        </div>
        <div className="min-w-[12rem] max-w-sm rounded border border-current/20 bg-exp-dark/25 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
            Decision
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {arc.playerQuestion}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr]">
        <div className="rounded border border-current/20 bg-exp-dark/25 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
            Directive
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {arc.directive}
          </p>
        </div>
        <div className="rounded border border-current/20 bg-exp-dark/25 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
            Next threshold
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {arc.nextThreshold}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1" role="list" aria-label="Expedition arc chapters">
        {ARC_ORDER.map((id, index) => {
          const definition = ARC_DEFINITIONS[id];
          const isCurrent = id === arc.id;
          const isPast = index < currentIndex;
          return (
            <div
              key={id}
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
              className={`min-h-10 rounded border px-1.5 py-1 text-center font-mono text-[9px] uppercase tracking-[0.12em] ${
                isCurrent
                  ? 'border-current bg-exp-dark/35 text-exp-text'
                  : isPast
                    ? 'border-current/25 bg-current/10 opacity-80'
                    : 'border-current/15 bg-exp-dark/20 opacity-50'
              }`}
            >
              <span className="block h-1 rounded bg-current opacity-70" />
              <span className="mt-1 block leading-tight">{definition.shortLabel}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {PROGRESS_LABELS.map(([key, label]) => {
          const value = Number(arc.progress?.[key] || 0);
          return (
            <div key={key} className="rounded border border-current/20 bg-exp-dark/25 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
                  {label}
                </p>
                <p className="font-mono text-[10px] tabular-nums text-exp-text">
                  {value}
                </p>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-exp-dark/60">
                <div className="h-full rounded bg-current" style={{ width: `${value}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
