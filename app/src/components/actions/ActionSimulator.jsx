import { Action } from '../../lib/constants';

function SimulatorRow({ ok, label, detail }) {
  return (
    <div className="flex items-start gap-2 text-[10px] font-mono">
      <span
        className={`inline-block mt-[2px] w-1.5 h-1.5 rounded-full ${
          ok ? 'bg-oxide-green' : 'bg-signal-red'
        }`}
      />
      <div className="leading-relaxed">
        <span className={ok ? 'text-oxide-green' : 'text-signal-red'}>{label}</span>
        {detail ? <span className="text-exp-text-dim"> - {detail}</span> : null}
      </div>
    </div>
  );
}

export default function ActionSimulator({
  activeTab,
  movement,
  currentLocation,
  path = [],
  hasCampsiteKit,
  hasSubmitted,
  isSpectator,
}) {
  const checks = [];

  checks.push({
    ok: !isSpectator,
    label: 'Wallet is an active participant',
  });
  checks.push({
    ok: !hasSubmitted,
    label: 'No action already submitted this turn',
  });

  if (activeTab === Action.MOVE) {
    checks.push({
      ok: path.length > 0,
      label: 'Move path selected',
      detail: path.length > 0 ? `${currentLocation} -> ${path[path.length - 1]}` : '',
    });
    checks.push({
      ok: path.length <= movement,
      label: 'Path fits movement budget',
      detail: `${path.length}/${movement}`,
    });
  }

  if (activeTab === Action.SETUP_CAMP) {
    checks.push({
      ok: hasCampsiteKit,
      label: 'Campsite kit available',
    });
  }

  const canLikelySubmit = checks.every((check) => check.ok);

  return (
    <div className="border border-exp-border/60 rounded bg-exp-dark/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-mono text-[10px] tracking-[0.3em] text-exp-text-dim uppercase">
          Action Simulation
        </h4>
        <span className={`font-mono text-[10px] uppercase tracking-wider ${canLikelySubmit ? 'text-oxide-green' : 'text-signal-red'}`}>
          {canLikelySubmit ? 'Likely Valid' : 'Likely Revert'}
        </span>
      </div>
      <div className="space-y-1">
        {checks.map((check, index) => (
          <SimulatorRow key={index} ok={check.ok} label={check.label} detail={check.detail} />
        ))}
      </div>
    </div>
  );
}
