import { PROCESSING_LABELS } from '../../lib/constants';

const PHASES = [
  { key: 0, label: 'IDLE' },
  { key: 1, label: 'SUBMIT' },
  { key: 2, label: 'VRF' },
  { key: 3, label: 'READY' },
  { key: 4, label: 'PROCESS' },
  { key: 5, label: 'DONE' },
];

export default function PhaseIndicator({ currentPhase = 0 }) {
  return (
    <div className="flex items-center gap-1">
      {PHASES.map((phase, i) => {
        const isActive = phase.key === currentPhase;
        const isPast = phase.key < currentPhase;

        return (
          <div key={phase.key} className="flex items-center gap-1">
            <span
              className={`
                px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all duration-300
                ${isActive
                  ? 'text-compass bg-compass/15 shadow-[0_0_6px_var(--color-compass)]'
                  : isPast
                    ? 'text-exp-text-dim bg-exp-dark/40'
                    : 'text-exp-text-dim/50 bg-exp-dark/20'
                }
              `}
            >
              {phase.label}
            </span>
            {i < PHASES.length - 1 && (
              <svg className="w-3 h-3 text-exp-border" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 2l4 4-4 4" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
