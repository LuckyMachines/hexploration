import { Action } from '../../lib/constants';
import { getActionDetail } from '../../lib/detailText';

function SimulatorRow({ ok, label, detail }) {
  return (
    <div className="flex items-start gap-2 text-xs font-mono">
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
  traitPreview,
  helpPreview,
}) {
  const checks = [];
  const detail = getActionDetail(activeTab);

  checks.push({
    ok: !isSpectator,
    label: 'Wallet is an active participant',
  });
  checks.push(hasSubmitted
    ? { ok: true, label: 'Intent committed; waiting for the crew' }
    : { ok: true, label: 'No action submitted yet' });

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

  if (activeTab === Action.HELP) {
    checks.push({
      ok: helpPreview ? Boolean(helpPreview.valid) : true,
      label: helpPreview?.targetID ? `P${helpPreview.targetID} selected for Help` : 'Choose the teammate and stat in the Help panel',
      detail: helpPreview?.statLabel ? `${helpPreview.statLabel} ${helpPreview.targetBefore} -> ${helpPreview.targetAfter}` : '',
    });
    if (helpPreview?.crewGain != null) {
      checks.push({
        ok: Number(helpPreview.crewGain) > 0,
        label: helpPreview.isRescue ? 'Critical rescue forecast' : 'Crew support forecast',
        detail: `crew +${helpPreview.crewGain}`,
      });
    }
  }

  if (traitPreview?.trait) {
    checks.push({
      ok: !traitPreview.effect?.warning,
      label: traitPreview.effect?.matched ? 'Tile trait matched' : 'Tile trait considered',
      detail: `${traitPreview.trait.label}: ${traitPreview.body}`,
    });
  }

  const canLikelySubmit = checks.every((check) => check.ok);
  const statusLabel = hasSubmitted ? 'Intent Locked' : canLikelySubmit ? 'Action Available' : 'Needs Revision';
  const statusClass = hasSubmitted
    ? 'border-compass/35 bg-compass/10 text-compass-bright'
    : canLikelySubmit
      ? 'border-blueprint/35 bg-blueprint/10 text-blueprint-bright'
      : 'border-signal-red/35 bg-signal-red/10 text-signal-red-bright';

  return (
    <div className="border border-exp-border/60 rounded bg-exp-dark/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-mono text-xs tracking-[0.3em] text-exp-text-dim uppercase">
          Local Outcome Forecast
        </h4>
        <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      <div className="space-y-1">
        {checks.map((check, index) => (
          <SimulatorRow key={index} ok={check.ok} label={check.label} detail={check.detail} />
        ))}
      </div>
      <p className="border-t border-exp-border/50 pt-2 font-mono text-[10px] leading-relaxed text-exp-text-dim">
        This forecast explains likely consequences. The confirmation step separately simulates the exact call against current contract state.
      </p>
      <div className="grid gap-2 border-t border-exp-border/50 pt-2 sm:grid-cols-3">
        <p className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
          <span className="text-exp-text">Effect:</span> {detail.effect}
        </p>
        <p className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
          <span className="text-exp-text">Risk:</span> {detail.risk}
        </p>
        <p className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
          <span className="text-exp-text">Requires:</span> {detail.requirement}
        </p>
        {traitPreview?.trait && (
          <p className="font-mono text-[11px] leading-relaxed text-exp-text-dim sm:col-span-3">
            <span className="text-exp-text">Trait:</span> {traitPreview.trait.label} changes pressure {signed(traitPreview.effect?.pressureDelta)}, cost {signed(traitPreview.effect?.costDelta)}, route {signed(traitPreview.effect?.routeDelta)}.
          </p>
        )}
      </div>
    </div>
  );
}

function signed(value = 0) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number);
}
