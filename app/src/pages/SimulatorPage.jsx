import { useEffect, useMemo, useState } from 'react';

const SAMPLE_REPORT = {
  generatedAt: null,
  exactEngine: true,
  engine: 'local-anvil-solidity-contracts',
  config: { turns: 0, players: 0, strategy: 'none' },
  summary: {
    turnsRun: 0,
    finalDay: 0,
    finalPhase: 'No report loaded',
    finalQueuePhase: 'Run simulator script',
    totalArtifacts: 0,
    actions: {},
    activePlayers: 0,
  },
  turns: [],
  players: [],
  aggregate: {
    runs: 0,
    strategies: {},
    actionTotals: {},
    averages: {},
    warnings: [],
  },
};

function Metric({ label, value, tone = 'neutral' }) {
  const toneClass = {
    green: 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green',
    gold: 'border-compass/35 bg-compass/10 text-compass-bright',
    blue: 'border-blueprint/35 bg-blueprint/10 text-blueprint',
    red: 'border-signal-red/35 bg-signal-red/10 text-signal-red',
    neutral: 'border-exp-border bg-exp-dark/35 text-exp-text',
  }[tone];

  return (
    <div className={`rounded border px-3 py-2 ${toneClass}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-70">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg tabular-nums">
        {value}
      </p>
    </div>
  );
}

function ActionBars({ actions = {} }) {
  const entries = Object.entries(actions);
  const total = entries.reduce((sum, [, count]) => sum + Number(count), 0);

  if (entries.length === 0) {
    return (
      <p className="font-mono text-xs text-exp-text-dim">
        No action data yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([action, count]) => {
        const pct = total > 0 ? Math.round((Number(count) / total) * 100) : 0;
        return (
          <div key={action}>
            <div className="mb-1 flex items-center justify-between gap-3 font-mono text-[11px]">
              <span className="uppercase tracking-[0.18em] text-exp-text">{action}</span>
              <span className="text-exp-text-dim">{count} / {pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-exp-border/70">
              <div className="h-full rounded bg-compass-bright" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PercentMetric({ label, value }) {
  const pct = Math.round(Number(value || 0) * 100);
  return (
    <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-3 font-mono text-[11px]">
        <span className="uppercase tracking-[0.16em] text-exp-text-dim">{label}</span>
        <span className="text-compass-bright">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-exp-border/70">
        <div className="h-full rounded bg-oxide-green" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StrategyComparison({ strategies = {} }) {
  const entries = Object.entries(strategies);
  if (entries.length === 0) return null;

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
        Strategy Comparison
      </h2>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        {entries.map(([strategy, stats]) => (
          <div key={strategy} className="rounded border border-exp-border/60 bg-exp-dark/35 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-compass-bright">
                {strategy}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
                {stats.runs} run{stats.runs === 1 ? '' : 's'}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Metric label="Artifacts" value={stats.avgArtifacts?.toFixed?.(1) ?? '0'} tone="green" />
              <Metric label="Reveal" value={stats.avgRevealedZones?.toFixed?.(1) ?? '0'} tone="blue" />
              <Metric label="Boring" value={stats.avgBoringTurns?.toFixed?.(1) ?? '0'} tone="gold" />
              <Metric label="Invalid" value={stats.avgInvalidAttempts?.toFixed?.(1) ?? '0'} tone="red" />
            </div>
            <div className="mt-3">
              <PercentMetric label="Choice density" value={stats.avgMeaningfulChoiceDensity} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InsightPanel({ aggregate = {}, summary = {} }) {
  const warnings = aggregate.warnings || [];
  const spikeTurns = summary.spikeTurns || [];
  const boringTurns = summary.boringTurns || [];

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
        Simulator Readout
      </h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded border border-compass/25 bg-compass/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
            Boring turns
          </p>
          <p className="mt-1 font-mono text-lg text-compass-bright">
            {boringTurns.length}
          </p>
          <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
            {boringTurns.length > 0 ? `Turns ${boringTurns.join(', ')}` : 'No flat turns flagged in latest run.'}
          </p>
        </div>
        <div className="rounded border border-signal-red/25 bg-signal-red/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-red">
            Spike turns
          </p>
          <p className="mt-1 font-mono text-lg text-signal-red">
            {spikeTurns.length}
          </p>
          <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
            {spikeTurns.length > 0 ? spikeTurns.slice(0, 2).map((turn) => `T${turn.turn}: ${turn.reasons.join(', ')}`).join(' / ') : 'No major spikes flagged in latest run.'}
          </p>
        </div>
        <div className="rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-blueprint">
            Invalid attempts
          </p>
          <p className="mt-1 font-mono text-lg text-blueprint">
            {summary.invalidAttempts || 0}
          </p>
          <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
            Lower is better unless you are testing affordance boundaries.
          </p>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="mt-3 rounded border border-signal-red/30 bg-signal-red/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-red">
            Opinionated warnings
          </p>
          <ul className="mt-2 space-y-1">
            {warnings.map((warning) => (
              <li key={warning} className="font-mono text-xs text-exp-text-dim">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TensionCurve({ points = [] }) {
  if (points.length === 0) return null;
  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
        Tension Curve
      </h2>
      <div className="mt-3 flex h-28 items-end gap-1 rounded border border-exp-border/60 bg-exp-dark/35 p-3">
        {points.map((point) => (
          <div key={point.turn} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-compass-bright"
              style={{ height: `${Math.max(4, point.tension)}%` }}
              title={`Turn ${point.turn}: ${point.tension}`}
            />
            <span className="font-mono text-[9px] text-exp-text-dim">{point.turn}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlayerSnapshot({ player }) {
  return (
    <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-compass-bright">
            P{player.playerId}
          </p>
          <p className="mt-1 break-all font-mono text-[10px] text-exp-text-dim">
            {player.address}
          </p>
        </div>
        <p className="font-mono text-xs text-blueprint">
          {player.location || 'unknown'}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
        <span className="rounded border border-exp-border/60 px-2 py-1 text-exp-text-dim">
          M {player.stats?.movement ?? 0}
        </span>
        <span className="rounded border border-exp-border/60 px-2 py-1 text-exp-text-dim">
          A {player.stats?.agility ?? 0}
        </span>
        <span className="rounded border border-exp-border/60 px-2 py-1 text-exp-text-dim">
          D {player.stats?.dexterity ?? 0}
        </span>
      </div>
      <p className="mt-2 font-mono text-[11px] text-exp-text-dim">
        Last action: <span className="text-exp-text">{player.action || 'None'}</span>
      </p>
      {player.artifacts?.length > 0 && (
        <p className="mt-1 font-mono text-[11px] text-compass">
          Artifacts: {player.artifacts.join(' / ')}
        </p>
      )}
    </div>
  );
}

function TurnCard({ turn }) {
  return (
    <details className="rounded border border-exp-border bg-exp-panel px-3 py-2">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-compass-bright">
              Turn {turn.turn}
            </p>
            <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
              Queue {turn.queueId} / {turn.skipped ? turn.reason : `${turn.progressCount} engine progress step${turn.progressCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <p className="font-mono text-xs text-blueprint">
            {turn.after?.phase || 'Unknown'} / {turn.after?.queuePhase || 'Unknown'}
          </p>
        </div>
      </summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {(turn.submissions || []).map((submission, index) => (
          <div key={`${submission.playerId}-${index}`} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-exp-text">
              P{submission.playerId} {submission.action || 'Skipped'}
            </p>
            <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
              {submission.reason || submission.error || 'submitted'}
            </p>
            {submission.options?.length > 0 && (
              <p className="mt-1 font-mono text-[11px] text-blueprint">
                {submission.options.join(' -> ')}
              </p>
            )}
          </div>
        ))}
        {turn.skipped && (
          <p className="font-mono text-xs text-exp-text-dim">
            No submissions were sent for this skipped turn.
          </p>
        )}
      </div>
    </details>
  );
}

export default function SimulatorPage() {
  const [report, setReport] = useState(SAMPLE_REPORT);
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    fetch('/simulator/latest-report.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No simulator report found.');
        return response.json();
      })
      .then((json) => {
        if (cancelled) return;
        setReport(json);
        setLoadState('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setReport(SAMPLE_REPORT);
        setLoadState('empty');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = useMemo(
    () => report.turns?.[report.turns.length - 1]?.after || report.initial || null,
    [report],
  );
  const summary = report.summary || SAMPLE_REPORT.summary;
  const aggregate = report.aggregate || SAMPLE_REPORT.aggregate;
  const command = `node scripts/gameplay-simulator.mjs --scenario=benchmark --batch=3`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-[0.2em] text-exp-text">
            Gameplay Simulator
          </h1>
          <p className="mt-2 max-w-3xl font-mono text-xs leading-relaxed text-exp-text-dim">
            Same-engine tuning workbench. Reports here are generated by local Anvil contracts, not a parallel frontend rules clone.
          </p>
        </div>
        <div className={`rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] ${
          loadState === 'loaded'
            ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
            : 'border-compass/35 bg-compass/10 text-compass-bright'
        }`}>
          {loadState === 'loaded' ? 'Report loaded' : 'Awaiting report'}
        </div>
      </div>

      <section className="mb-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Turns" value={summary.turnsRun} tone="gold" />
          <Metric label="Players" value={summary.activePlayers} tone="blue" />
          <Metric label="Day" value={summary.finalDay} tone="neutral" />
          <Metric label="Artifacts" value={summary.totalArtifacts} tone="green" />
          <Metric label="Phase" value={summary.finalPhase} tone="neutral" />
          <Metric label="Queue" value={summary.finalQueuePhase} tone="blue" />
        </div>
      </section>

      <section className="mb-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Runs" value={aggregate.runs || report.runs?.length || 0} tone="gold" />
          <Metric label="Avg Artifacts" value={aggregate.averages?.artifacts?.toFixed?.(1) ?? '0'} tone="green" />
          <Metric label="Avg Reveal" value={aggregate.averages?.revealedZones?.toFixed?.(1) ?? '0'} tone="blue" />
          <Metric label="Avg Boring" value={aggregate.averages?.boringTurns?.toFixed?.(1) ?? '0'} tone="red" />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <section className="rounded border border-exp-border bg-exp-panel p-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Tuning Controls
          </h2>
          <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">
            Run the simulator from the repo root while the local stack is active. It writes the latest report into this app automatically.
          </p>
          <pre className="mt-3 overflow-x-auto rounded border border-exp-border bg-exp-dark/60 p-3 font-mono text-[11px] text-compass-bright">
            {`npm run local:solo\n${command}`}
          </pre>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {['solo-balanced', 'solo-risky', 'solo-dig-rush', 'solo-escape-rush', '4p-cautious', '4p-chaos', 'benchmark'].map((strategy) => (
              <div key={strategy} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-exp-text">
                  {strategy}
                </p>
                <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
                  --scenario={strategy}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-blueprint">
              Engine guarantee
            </p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
              The runner submits actions through the controller, asks the controller to validate actions, fulfills mock VRF, and progresses GameSetup, Controller, and Gameplay loops.
            </p>
          </div>
        </section>

        <section className="rounded border border-exp-border bg-exp-panel p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
              Outcome Mix
            </h2>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">
              {report.config?.strategy || 'none'} / {report.engine}
            </p>
          </div>
          <ActionBars actions={summary.actions} />
        </section>
      </div>

      <InsightPanel aggregate={aggregate} summary={summary} />
      <StrategyComparison strategies={aggregate.strategies} />
      <TensionCurve points={summary.tensionCurve || []} />

      {latest?.players?.length > 0 && (
        <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Latest Player State
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {latest.players.map((player) => (
              <PlayerSnapshot key={`${player.playerId}-${player.address}`} player={player} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Turn Log
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">
            Generated {report.generatedAt || 'after first run'}
          </p>
        </div>
        {report.turns?.length > 0 ? (
          <div className="space-y-2">
            {report.turns.map((turn) => (
              <TurnCard key={turn.turn} turn={turn} />
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-exp-text-dim">
            No report yet. Start the local stack, run the simulator command, then refresh this page.
          </p>
        )}
      </section>
    </div>
  );
}
