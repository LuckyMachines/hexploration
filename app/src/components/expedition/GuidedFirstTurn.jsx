import { useEffect, useState } from 'react';

const STORAGE_KEY = 'xenovoya:first-turn-dismissed';

export default function GuidedFirstTurn({ isSpectator, hasSubmitted, movePathLength, turnState, departPressure, escapeCostPreview }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, 'true');
  };

  const reset = () => {
    setDismissed(false);
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  };

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={reset}
        className="rounded border border-exp-border bg-exp-dark/35 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim hover:border-compass/50 hover:text-compass"
      >
        Show guide
      </button>
    );
  }

  const steps = [
    ['1', isSpectator ? 'Register or watch' : 'Wallet ready', isSpectator ? 'This wallet is observing until registered.' : 'This wallet can submit for this explorer.'],
    ['2', movePathLength > 0 ? 'Route drafted' : 'Choose an action', movePathLength > 0 ? 'Review the path, movement left, and pressure change.' : 'Move to chart nearby ground while Depart Pressure is low.'],
    ['3', hasSubmitted ? 'Submitted' : 'Pick reduction', hasSubmitted ? 'Wait for crew and queue resolution.' : `Check ${escapeCostPreview?.headline || departPressure?.band?.label || 'Depart Pressure'}, then reduce it or depart.`],
    ['4', turnState?.phaseLabel || 'Read aftermath', departPressure?.readiness?.canFlee ? `You can depart; ${escapeCostPreview?.nextDelayWarning || 'decide whether one more chart is worth the pressure.'}` : 'Read Turn Aftermath, then decide whether to push deeper or start heading home.'],
  ];

  return (
    <div className="rounded border border-compass/30 bg-compass/5 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-compass-bright">
          Guided first turn
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim hover:text-compass"
        >
          Dismiss
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {steps.map(([number, title, body]) => (
          <div key={number} className="rounded border border-compass/20 bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] text-compass">Step {number}</p>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-exp-text">{title}</p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
