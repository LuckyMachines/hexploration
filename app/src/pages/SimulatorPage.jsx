import { useEffect, useMemo, useState } from 'react';
import { diagnoseEndState, getScenarioQuestion, getStrategyQuestion } from '../lib/detailText';
import { SCENARIO_CATALOG } from '../data/scenarioCatalog';

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
    actionShares: {},
    averages: {},
    warnings: [],
  },
  targetEvaluation: { passed: 0, total: 0, score: 1, checks: [] },
  scenarioGoalEvaluation: { scenario: 'none', passed: 0, total: 0, score: 1, checks: [] },
  comparison: null,
  tasks: [],
  tuning: { note: '', hypothesis: '', changed: '', scenarioGoals: {} },
  funDebugger: {
    averageLifeScore: 0,
    flatTurnRate: 0,
    aliveTurnRate: 0,
    classifications: {},
    topIssue: null,
    topExperiments: [],
    smallestExperimentQueue: [],
    repeatedFlatPatterns: [],
    repeatedHighLifePatterns: [],
    systemicRisks: [],
    strategyScores: {},
    worstTurns: [],
    bestTurns: [],
  },
  autoTune: null,
  scenarioVerdict: null,
  scenarioDefinition: null,
  setupForge: null,
  setupApplication: null,
  setupLevel: 'metadata',
  setupPreludeTurns: [],
  oracle: null,
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
  const width = Math.min(100, Math.abs(pct));
  return (
    <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-3 font-mono text-[11px]">
        <span className="uppercase tracking-[0.16em] text-exp-text-dim">{label}</span>
        <span className="text-compass-bright">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-exp-border/70">
        <div className={`h-full rounded ${pct < 0 ? 'bg-signal-red' : 'bg-oxide-green'}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (Math.abs(number) < 1) return number.toFixed(2);
  return number.toFixed(1);
}

function formatDelta(value) {
  const number = Number(value || 0);
  const sign = number > 0 ? '+' : '';
  return `${sign}${formatNumber(number)}`;
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
            <p className="mb-3 font-mono text-[11px] leading-relaxed text-exp-text-dim">
              {getStrategyQuestion(strategy)}
            </p>
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
  const diagnosis = diagnoseEndState(summary);

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
      <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
          End-state diagnosis
        </p>
        <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
          {diagnosis}
        </p>
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

function FunDebuggerPanel({ funDebugger = {} }) {
  const topExperiment = funDebugger.topExperiments?.[0] || funDebugger.topExperiment;
  const flatPatterns = funDebugger.repeatedFlatPatterns || [];
  const highLifePatterns = funDebugger.repeatedHighLifePatterns || [];
  const systemicRisks = funDebugger.systemicRisks || [];

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Fun Debugger
          </h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Explains why turns feel alive or flat, then points at the smallest useful tuning experiment.
          </p>
        </div>
        <div className="rounded border border-compass/30 bg-compass/5 px-3 py-2 text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">
            Life score
          </p>
          <p className="mt-1 font-mono text-xl text-compass-bright">
            {formatNumber(funDebugger.averageLifeScore)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <PercentMetric label="Flat turn rate" value={funDebugger.flatTurnRate || 0} />
        <PercentMetric label="Alive turn rate" value={funDebugger.aliveTurnRate || 0} />
        <Metric label="Top issue" value={funDebugger.topIssue?.label || 'None yet'} tone={funDebugger.topIssue ? 'red' : 'green'} />
      </div>

      {topExperiment && (
        <div className="mt-3 rounded border border-compass/35 bg-compass/5 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
              Smallest next experiment
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
              {topExperiment.blastRadius || 'medium'} / {Math.round((topExperiment.confidence || 0) * 100)}% confidence
            </p>
          </div>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {topExperiment.experiment}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            Affects {(topExperiment.affectedStrategies || []).join(', ') || 'unknown strategies'} / {(topExperiment.systems || []).join(', ') || 'pacing'}.
          </p>
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded border border-signal-red/25 bg-signal-red/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-red">
            Repeated flat patterns
          </p>
          <div className="mt-2 space-y-1">
            {flatPatterns.length > 0 ? flatPatterns.slice(0, 4).map((pattern) => (
              <p key={pattern.key} className="font-mono text-[11px] text-exp-text-dim">
                {pattern.label} / {pattern.count} / {pattern.system}
              </p>
            )) : (
              <p className="font-mono text-[11px] text-exp-text-dim">No repeated flat pattern yet.</p>
            )}
          </div>
        </div>
        <div className="rounded border border-oxide-green/25 bg-oxide-green/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-oxide-green">
            High-life sources
          </p>
          <div className="mt-2 space-y-1">
            {highLifePatterns.length > 0 ? highLifePatterns.slice(0, 4).map((pattern) => (
              <p key={pattern.key} className="font-mono text-[11px] text-exp-text-dim">
                {pattern.label} / {pattern.count} / {pattern.system}
              </p>
            )) : (
              <p className="font-mono text-[11px] text-exp-text-dim">No strong high-life source yet.</p>
            )}
          </div>
        </div>
        <div className="rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-blueprint">
            Systemic risks
          </p>
          <div className="mt-2 space-y-1">
            {systemicRisks.length > 0 ? systemicRisks.slice(0, 4).map((risk) => (
              <p key={risk.key} className="font-mono text-[11px] text-exp-text-dim">
                {risk.key} / {risk.count}
              </p>
            )) : (
              <p className="font-mono text-[11px] text-exp-text-dim">No systemic risk yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SmallestExperimentQueue({ experiments = [] }) {
  if (experiments.length === 0) return null;
  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
        Smallest Experiment Queue
      </h2>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {experiments.map((experiment, index) => (
          <div key={`${experiment.experiment}-${index}`} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-compass-bright">
                #{index + 1} / {experiment.blastRadius}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">
                leverage {formatNumber(experiment.leverage)}
              </p>
            </div>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
              {experiment.experiment}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
              {(experiment.affectedTurns || []).join(', ') || 'No turn list'} / {(experiment.systems || []).join(', ') || 'pacing'}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AutoTunePanel({ report }) {
  if (!report) {
    return (
      <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
              Auto-Tune Lab
            </h2>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
              Generate candidates with `npm run sim:autotune:dry`, then run `npm run sim:autotune` while the local stack is active.
            </p>
          </div>
          <span className="rounded border border-compass/30 bg-compass/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-compass-bright">
            Awaiting report
          </span>
        </div>
      </section>
    );
  }

  const ranked = report.ranked?.length > 0 ? report.ranked : report.results || [];
  const winner = report.winner;

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Auto-Tune Lab
          </h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Candidate balance patches are tested against the same simulator scenario and deterministic seed.
          </p>
        </div>
        <span className={`rounded border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] ${
          report.dryRun
            ? 'border-blueprint/35 bg-blueprint/10 text-blueprint'
            : winner
              ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
              : 'border-signal-red/35 bg-signal-red/10 text-signal-red'
        }`}>
          {report.dryRun ? 'Dry run' : winner ? 'Winner found' : 'No winner'}
        </span>
      </div>

      {winner && (
        <div className="mt-3 rounded border border-oxide-green/30 bg-oxide-green/5 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-oxide-green">
              Winner / {winner.name}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
              score {formatNumber(winner.weightedScore)}
            </p>
          </div>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {winner.explanation || report.recommendation}
          </p>
          <pre className="mt-2 overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/50 p-2 font-mono text-[11px] text-compass-bright">
            {JSON.stringify(winner.patch?.knobs || {}, null, 2)}
          </pre>
        </div>
      )}

      {report.candidates?.length > 0 && report.dryRun && (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {report.candidates.map((candidate) => (
            <div key={candidate.id} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-compass-bright">
                {candidate.name}
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {candidate.hypothesis}
              </p>
              <pre className="mt-2 overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/50 p-2 font-mono text-[10px] text-blueprint">
                {JSON.stringify(candidate.patch?.knobs || {}, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}

      {ranked.length > 0 && (
        <div className="mt-3 space-y-2">
          {ranked.slice(0, 5).map((item, index) => (
            <div key={item.id || index} className={`rounded border px-3 py-2 ${
              item.rejected
                ? 'border-signal-red/25 bg-signal-red/5'
                : 'border-exp-border/60 bg-exp-dark/35'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-exp-text">
                  #{index + 1} {item.name}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">
                  {item.rejected ? 'rejected' : 'candidate'} / {formatNumber(item.weightedScore)}
                </p>
              </div>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {item.rejected ? item.rejectedReasons?.join(' / ') : item.explanation || item.expectedEffect}
              </p>
              {item.deltas && (
                <div className="mt-2 grid gap-2 md:grid-cols-4">
                  <Metric label="Life" value={formatDelta(item.deltas.lifeScore?.delta)} tone={item.deltas.lifeScore?.delta >= 0 ? 'green' : 'red'} />
                  <Metric label="Flat" value={formatDelta(item.deltas.flatTurnRate?.delta)} tone={item.deltas.flatTurnRate?.delta <= 0 ? 'green' : 'red'} />
                  <Metric label="Alive" value={formatDelta(item.deltas.aliveTurnRate?.delta)} tone={item.deltas.aliveTurnRate?.delta >= 0 ? 'green' : 'red'} />
                  <Metric label="Invalid" value={formatDelta(item.deltas.invalidAttempts?.delta)} tone={item.deltas.invalidAttempts?.delta <= 0 ? 'green' : 'red'} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AutopilotPanel({ report }) {
  if (!report) {
    return (
      <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
              Scenario Autopilot
            </h2>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
              Turns a plain-English gameplay intent into a scenario, setup plan, Oracle diagnosis, candidate change, rerun comparison, and design memo.
            </p>
          </div>
          <span className="rounded border border-blueprint/35 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-blueprint">
            Awaiting autopilot
          </span>
        </div>
        <pre className="mt-3 overflow-x-auto rounded border border-exp-border bg-exp-dark/60 p-3 font-mono text-[11px] text-compass-bright">
          {`npm run autopilot:dry -- "4-player escape should feel desperate but cooperative"\nnpm run autopilot -- --id=escape-pressure-4p --mode=single-pass`}
        </pre>
      </section>
    );
  }

  const comparison = report.comparison;
  const selected = report.selectedChange;
  const baseline = report.baselineRun;
  const rerun = report.rerun;
  const candidateChanges = report.candidateChanges || [];
  const memoLines = String(report.designMemo || '').split('\n').filter((line) => line && !line.startsWith('#')).slice(0, 8);

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Scenario Autopilot
          </h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Latest orchestration pass across Scenario Designer, Setup Forge, exact-engine simulator, and Gameplay Oracle.
          </p>
        </div>
        <div className={`rounded border px-3 py-2 text-right ${
          ['target-met', 'improved', 'healthy'].includes(report.finalVerdict)
            ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
            : report.finalVerdict === 'blocked' || report.finalVerdict === 'rejected-regression'
              ? 'border-signal-red/35 bg-signal-red/10 text-signal-red'
              : 'border-compass/35 bg-compass/10 text-compass-bright'
        }`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">{report.finalVerdict}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em]">{report.mode}</p>
        </div>
      </div>

      <div className="mt-3 rounded border border-compass/25 bg-compass/5 px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
          Intent
        </p>
        <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
          {report.intent?.text || 'No intent recorded.'}
        </p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Metric label="Baseline" value={baseline ? baseline.weightedScore : 'plan'} tone="blue" />
        <Metric label="Final" value={rerun ? rerun.weightedScore : report.finalOracle?.weightedScore ?? baseline?.weightedScore ?? 'plan'} tone="green" />
        <Metric label="Confidence" value={`${Math.round(((report.finalOracle?.confidence ?? report.baselineOracle?.confidence) || 0) * 100)}%`} tone="gold" />
        <Metric label="Setup" value={baseline?.setupLevel || report.setupForge?.requiredSetupLevel || 'metadata'} tone="neutral" />
      </div>

      {comparison && (
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          <Metric label="Score Delta" value={formatDelta(comparison.delta?.weightedScore)} tone={comparison.delta?.weightedScore >= 0 ? 'green' : 'red'} />
          <Metric label="Life Delta" value={formatDelta(comparison.delta?.lifeScore)} tone={comparison.delta?.lifeScore >= 0 ? 'green' : 'red'} />
          <Metric label="Flat Delta" value={formatDelta(comparison.delta?.flatTurnRate)} tone={comparison.delta?.flatTurnRate <= 0 ? 'green' : 'red'} />
          <Metric label="Invalid" value={formatDelta(comparison.delta?.invalidAttempts)} tone={comparison.delta?.invalidAttempts <= 0 ? 'green' : 'red'} />
          <Metric label="Accepted" value={comparison.accepted ? 'yes' : 'no'} tone={comparison.accepted ? 'green' : 'red'} />
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1fr)]">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Selected change
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {selected?.title || 'No change selected yet.'}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {selected?.hypothesis || 'Run a baseline or enable iteration to select a grounded change.'}
          </p>
          {selected?.patch && (
            <pre className="mt-2 overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/50 p-2 font-mono text-[10px] text-blueprint">
              {JSON.stringify(selected.patch, null, 2)}
            </pre>
          )}
        </div>
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Design memo
          </p>
          <div className="mt-2 space-y-1">
            {memoLines.length > 0 ? memoLines.map((line) => (
              <p key={line} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {line.replace(/^[-*]\s*/, '')}
              </p>
            )) : (
              <p className="font-mono text-xs text-exp-text-dim">No memo has been generated yet.</p>
            )}
          </div>
        </div>
      </div>

      {candidateChanges.length > 0 && (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {candidateChanges.slice(0, 4).map((candidate) => (
            <div key={candidate.id} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-compass-bright">
                  {candidate.title}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">
                  {candidate.changeType}
                </p>
              </div>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {candidate.hypothesis}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PlayableDesignMemoryPanel({ memory, currentScenarioId }) {
  if (!memory) {
    return (
      <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
              Playable Design Memory
            </h2>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
              Builds a queryable memory from scenario definitions, simulator traces, setup reports, Oracle verdicts, auto-tune outcomes, and Autopilot memos.
            </p>
          </div>
          <span className="rounded border border-blueprint/35 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-blueprint">
            Awaiting memory
          </span>
        </div>
        <pre className="mt-3 overflow-x-auto rounded border border-exp-border bg-exp-dark/60 p-3 font-mono text-[11px] text-compass-bright">
          {`npm run memory:build\nnpm run memory:query -- "what do we know about escape pressure?"`}
        </pre>
      </section>
    );
  }

  const sourceCounts = Object.entries(memory.sourceCounts || {});
  const scenario = (memory.scenarios || []).find((item) => item.scenarioId === currentScenarioId) || memory.scenarios?.[0];
  const findings = memory.findings || [];
  const setupLimits = memory.setupLimits || [];
  const recommendations = memory.recommendations || [];
  const examples = memory.queryExamples || [];
  const citations = memory.citations || [];

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Playable Design Memory
          </h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Queryable project memory built from the same simulator evidence shown in this workbench.
          </p>
        </div>
        <div className="rounded border border-compass/30 bg-compass/5 px-3 py-2 text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">
            Built
          </p>
          <p className="mt-1 font-mono text-[11px] text-compass-bright">
            {memory.generatedAt || 'unknown'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Metric label="Events" value={memory.eventCount || 0} tone="gold" />
        <Metric label="Scenarios" value={memory.scenarioCount || 0} tone="blue" />
        <Metric label="Findings" value={findings.length} tone={findings.length ? 'red' : 'green'} />
        <Metric label="Limits" value={setupLimits.length} tone={setupLimits.length ? 'gold' : 'green'} />
      </div>

      {sourceCounts.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {sourceCounts.map(([type, count]) => (
            <div key={type} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
                {type.replace(/Report$/, '')}
              </p>
              <p className="mt-1 font-mono text-lg text-exp-text">
                {count}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Current scenario memory
          </p>
          {scenario ? (
            <>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <Metric label="Scenario" value={scenario.scenarioId} tone="blue" />
                <Metric label="Verdict" value={scenario.latestVerdict || 'unknown'} tone="gold" />
                <Metric label="Score" value={scenario.latestScore ?? 'n/a'} tone="green" />
                <Metric label="Weakest" value={scenario.weakestMetric || 'n/a'} tone="red" />
              </div>
              <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">
                {scenario.currentRecommendation?.title || 'No recommendation generated yet.'}
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {scenario.currentRecommendation?.reason || scenario.designQuestion || 'Build memory after running a scenario and Oracle pass.'}
              </p>
            </>
          ) : (
            <p className="mt-2 font-mono text-xs text-exp-text-dim">
              No scenario rollups found. Run `npm run memory:build` after a simulator or Oracle report exists.
            </p>
          )}
        </div>

        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Top recommendation
          </p>
          {recommendations[0] ? (
            <>
              <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
                {recommendations[0].title}
              </p>
              <pre className="mt-2 overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/50 p-2 font-mono text-[10px] text-compass-bright">
                {recommendations[0].command}
              </pre>
            </>
          ) : (
            <p className="mt-1 font-mono text-xs text-exp-text-dim">No recommendation yet.</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded border border-signal-red/25 bg-signal-red/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-red">
            Findings
          </p>
          <div className="mt-2 space-y-1">
            {findings.length > 0 ? findings.slice(0, 4).map((finding) => (
              <p key={`${finding.type}-${finding.title}`} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {finding.severity} / {finding.title}
              </p>
            )) : (
              <p className="font-mono text-[11px] text-exp-text-dim">No findings yet.</p>
            )}
          </div>
        </div>
        <div className="rounded border border-compass/25 bg-compass/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
            Setup limits
          </p>
          <div className="mt-2 space-y-1">
            {setupLimits.length > 0 ? setupLimits.slice(0, 4).map((limit) => (
              <p key={limit.field} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {limit.field} / {limit.count} / {limit.recommendation}
              </p>
            )) : (
              <p className="font-mono text-[11px] text-exp-text-dim">No setup blockers detected.</p>
            )}
          </div>
        </div>
        <div className="rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-blueprint">
            Query examples
          </p>
          <div className="mt-2 space-y-1">
            {examples.slice(0, 4).map((query) => (
              <p key={query} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
                npm run memory:query -- "{query}"
              </p>
            ))}
          </div>
        </div>
      </div>

      {citations.length > 0 && (
        <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Recent citations
          </p>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {citations.slice(0, 6).map((citation) => (
              <p key={`${citation.id}-${citation.sourcePath}`} className="break-all font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {citation.type} / {citation.scenarioId || 'project'} / {citation.sourcePath}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function trendTone(trend) {
  if (trend === 'improving') return 'green';
  if (trend === 'regressing' || trend === 'blocked') return 'red';
  if (trend === 'stable') return 'blue';
  return 'gold';
}

function ScenarioTimeMachinePanel({ report, index, currentScenarioId }) {
  if (!report) {
    const indexedScenario = (index?.scenarios || []).find((item) => item.scenarioId === currentScenarioId);
    return (
      <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
              Scenario Time Machine
            </h2>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
              Compares each scenario's evidence over time: latest, previous, best known, last good, regressions, inferred causes, and next action.
            </p>
          </div>
          <span className="rounded border border-blueprint/35 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-blueprint">
            Awaiting timeline
          </span>
        </div>
        <pre className="mt-3 overflow-x-auto rounded border border-exp-border bg-exp-dark/60 p-3 font-mono text-[11px] text-compass-bright">
          {`npm run time-machine:scenario -- --id=${currentScenarioId || 'escape-pressure-4p'}\nnpm run time-machine:compare -- --id=${currentScenarioId || 'escape-pressure-4p'} --against=last-good --markdown`}
        </pre>
        {indexedScenario && (
          <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
              Index preview
            </p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
              {indexedScenario.scenarioId}: {indexedScenario.trend || 'unknown'} / latest health {indexedScenario.latestHealth ?? 'n/a'}
            </p>
          </div>
        )}
      </section>
    );
  }

  const trend = report.trend || 'insufficient-evidence';
  const timeline = report.timeline || [];
  const causes = report.inferredCauses || [];
  const recommendation = report.recommendation;
  const regression = report.biggestRegression;
  const improvement = report.biggestImprovement;

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Scenario Time Machine
          </h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Latest timeline for {report.scenarioId}; causes are inferred from nearby report evidence and should be verified with reruns.
          </p>
        </div>
        <div className={`rounded border px-3 py-2 text-right ${
          trendTone(trend) === 'green'
            ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
            : trendTone(trend) === 'red'
              ? 'border-signal-red/35 bg-signal-red/10 text-signal-red'
              : trendTone(trend) === 'blue'
                ? 'border-blueprint/35 bg-blueprint/10 text-blueprint'
                : 'border-compass/35 bg-compass/10 text-compass-bright'
        }`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
            {trend}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em]">
            {report.timelineCount || 0} points
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Metric label="Latest" value={report.latest?.health?.score ?? 'n/a'} tone={trendTone(trend)} />
        <Metric label="Best" value={report.bestKnown?.health?.score ?? 'n/a'} tone="green" />
        <Metric label="Last Good" value={report.lastGood?.health?.score ?? 'n/a'} tone="blue" />
        <Metric label="Stale" value={report.stale ? 'yes' : 'no'} tone={report.stale ? 'gold' : 'green'} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Latest state
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <Metric label="Source" value={report.latest?.sourceType || 'none'} tone="neutral" />
            <Metric label="Oracle" value={report.latest?.oracle?.weightedScore ?? 'n/a'} tone="green" />
            <Metric label="Confidence" value={report.latest?.oracle?.confidence !== undefined ? `${Math.round(report.latest.oracle.confidence * 100)}%` : 'n/a'} tone="gold" />
            <Metric label="Setup" value={report.latest?.setup?.fidelity !== undefined ? `${Math.round(report.latest.setup.fidelity * 100)}%` : 'n/a'} tone="blue" />
          </div>
          <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">
            {report.summaries?.currentState || report.latest?.summary || 'No latest state.'}
          </p>
        </div>

        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Next action
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {recommendation?.title || 'No recommendation generated.'}
          </p>
          {recommendation?.command && (
            <pre className="mt-2 overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/50 p-2 font-mono text-[10px] text-compass-bright">
              {recommendation.command}
            </pre>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded border border-oxide-green/25 bg-oxide-green/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-oxide-green">
            Biggest improvement
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {improvement?.summary || 'No improvement detected.'}
          </p>
        </div>
        <div className="rounded border border-signal-red/25 bg-signal-red/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-red">
            Biggest regression
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {regression?.summary || 'No regression detected.'}
          </p>
        </div>
        <div className="rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-blueprint">
            Inferred causes
          </p>
          <div className="mt-2 space-y-1">
            {causes.length > 0 ? causes.slice(0, 3).map((cause) => (
              <p key={`${cause.generatedAt}-${cause.title}`} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {cause.sourceType} / {cause.why}
              </p>
            )) : (
              <p className="font-mono text-[11px] text-exp-text-dim">No inferred cause yet.</p>
            )}
          </div>
        </div>
      </div>

      {timeline.length > 0 && (
        <div className="mt-3 space-y-2">
          {timeline.slice(-6).reverse().map((point) => (
            <details key={point.id} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-compass-bright">
                    {point.sourceType} / health {point.health?.score ?? 'n/a'}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">
                    {point.generatedAt}
                  </p>
                </div>
              </summary>
              <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">
                {point.title}
              </p>
              <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {point.citation?.sourcePath || point.sourcePath || 'no citation'}
              </p>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function readinessTone(status) {
  if (status === 'ready') return 'green';
  if (status === 'ready-with-caveats') return 'gold';
  if (status === 'blocked-by-setup' || status === 'regressed') return 'red';
  if (status === 'needs-engine-evidence') return 'blue';
  return 'neutral';
}

function ScenarioLabNotebookPanel({ entry, index, currentScenarioId }) {
  if (!entry) {
    const indexedScenario = (index?.scenarios || []).find((item) => item.scenarioId === currentScenarioId);
    return (
      <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
              Scenario Lab Notebook
            </h2>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
              Writes the design journal for each scenario cycle: learning, belief, decisions, unresolved assumptions, and the next experiment.
            </p>
          </div>
          <span className="rounded border border-blueprint/35 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-blueprint">
            Awaiting entry
          </span>
        </div>
        <pre className="mt-3 overflow-x-auto rounded border border-exp-border bg-exp-dark/60 p-3 font-mono text-[11px] text-compass-bright">
          {`npm run lab:entry -- --id=${currentScenarioId || 'escape-pressure-4p'}\nnpm run lab:latest -- --id=${currentScenarioId || 'escape-pressure-4p'} --markdown`}
        </pre>
        {indexedScenario && (
          <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
              Notebook index
            </p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
              {indexedScenario.scenarioId}: {indexedScenario.readiness?.status || 'no entry'} / {indexedScenario.latestLearning || 'generate an entry to record current learning'}
            </p>
          </div>
        )}
      </section>
    );
  }

  const readiness = entry.playtestReadiness || {};
  const tone = readinessTone(readiness.status);
  const assumptions = entry.unresolvedAssumptions || [];
  const citations = entry.citations || [];
  const decision = entry.decision;
  const history = (index?.scenarios || []).find((item) => item.scenarioId === entry.scenarioId);

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Scenario Lab Notebook
          </h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Latest journal entry for {entry.scenarioId}; decisions are human records, while beliefs are generated from simulator evidence.
          </p>
        </div>
        <div className={`rounded border px-3 py-2 text-right ${
          tone === 'green'
            ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
            : tone === 'red'
              ? 'border-signal-red/35 bg-signal-red/10 text-signal-red'
              : tone === 'blue'
                ? 'border-blueprint/35 bg-blueprint/10 text-blueprint'
                : tone === 'gold'
                  ? 'border-compass/35 bg-compass/10 text-compass-bright'
                  : 'border-exp-border bg-exp-dark/40 text-exp-text-dim'
        }`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
            {readiness.status || 'unknown'}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em]">
            {entry.confidence || 'low'} confidence
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Metric label="Trend" value={entry.evidenceSummary?.trend || 'unknown'} tone={trendTone(entry.evidenceSummary?.trend)} />
        <Metric label="Health" value={entry.evidenceSummary?.latestHealth ?? 'n/a'} tone={tone} />
        <Metric label="Unproven" value={assumptions.length} tone={assumptions.length ? 'gold' : 'green'} />
        <Metric label="Citations" value={citations.length} tone="blue" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Latest learning
          </p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">
            {entry.latestLearning || 'No learning recorded.'}
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Current belief
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            {entry.currentBelief || entry.beliefAfter || 'No belief recorded.'}
          </p>
        </div>

        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Next experiment
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {entry.nextAction?.title || 'No next action recorded.'}
          </p>
          {entry.nextAction?.command && (
            <pre className="mt-2 overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/50 p-2 font-mono text-[10px] text-compass-bright">
              {entry.nextAction.command}
            </pre>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-blueprint">
            Latest decision
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {decision ? `${decision.decisionType}: ${decision.reason}` : 'No decision recorded yet.'}
          </p>
        </div>
        <div className="rounded border border-compass/25 bg-compass/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
            Unresolved assumptions
          </p>
          <div className="mt-2 space-y-1">
            {assumptions.length > 0 ? assumptions.slice(0, 4).map((assumption) => (
              <p key={`${assumption.source}-${assumption.key}`} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {assumption.severity} / {assumption.title || assumption.key}
              </p>
            )) : (
              <p className="font-mono text-[11px] text-exp-text-dim">No unresolved assumptions recorded.</p>
            )}
          </div>
        </div>
        <div className="rounded border border-oxide-green/25 bg-oxide-green/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-oxide-green">
            Notebook commands
          </p>
          <pre className="mt-2 overflow-x-auto font-mono text-[10px] leading-relaxed text-exp-text-dim">
            {`npm run lab:entry -- --id=${entry.scenarioId}\nnpm run lab:decision -- --id=${entry.scenarioId} --decision=playtest --why="..."`}
          </pre>
        </div>
      </div>

      {(history?.latestDecision || citations.length > 0) && (
        <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
                Index status
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {history?.latestGeneratedAt || entry.generatedAt || 'unknown'} / unresolved {history?.unresolvedCount ?? assumptions.length}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
                Citations
              </p>
              <div className="mt-1 space-y-1">
                {citations.slice(0, 3).map((citation) => (
                  <p key={`${citation.id}-${citation.sourcePath}`} className="break-all font-mono text-[11px] leading-relaxed text-exp-text-dim">
                    {citation.type || 'evidence'} / {citation.sourcePath || 'unknown'}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function feelingTone(score) {
  if (score >= 70) return 'green';
  if (score >= 55) return 'gold';
  if (score > 0) return 'red';
  return 'blue';
}

function PlayerFeelingBlackBoxPanel({ report, index, currentScenarioId }) {
  if (!report) {
    const indexedScenario = (index?.scenarios || []).find((item) => item.scenarioId === currentScenarioId);
    return (
      <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
              Player Feeling Black Box
            </h2>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
              Turns exact-engine input and state deltas into a felt-control timeline: alive moments, flat turns, friction spikes, payoff, recovery, and arc shape.
            </p>
          </div>
          <span className="rounded border border-blueprint/35 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-blueprint">
            Awaiting arc
          </span>
        </div>
        <pre className="mt-3 overflow-x-auto rounded border border-exp-border bg-exp-dark/60 p-3 font-mono text-[11px] text-compass-bright">
          {`npm run feel:scenario -- --id=${currentScenarioId || 'escape-pressure-4p'}\nnpm run feel:scenario -- --id=${currentScenarioId || 'escape-pressure-4p'} --markdown`}
        </pre>
        {indexedScenario && (
          <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
              Feeling index
            </p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
              {indexedScenario.scenarioId}: {indexedScenario.arcShape || 'unknown'} / score {indexedScenario.arcScore ?? 'n/a'} / {indexedScenario.recommendation?.title || 'generate a fresh feeling report'}
            </p>
          </div>
        )}
      </section>
    );
  }

  const arc = report.arc || {};
  const tone = feelingTone(arc.arcScore || 0);
  const timeline = report.timeline || [];
  const labelEntries = Object.entries(arc.labelCounts || {}).sort(([, a], [, b]) => b - a);
  const recommendation = report.recommendedImprovement || arc.recommendedImprovement || {};

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Player Feeling Black Box
          </h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Latest felt-control readout for {report.scenarioId}; it scores whether inputs make the board feel alive before the design systems explain why.
          </p>
        </div>
        <div className={`rounded border px-3 py-2 text-right ${
          tone === 'green'
            ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
            : tone === 'red'
              ? 'border-signal-red/35 bg-signal-red/10 text-signal-red'
              : tone === 'gold'
                ? 'border-compass/35 bg-compass/10 text-compass-bright'
                : 'border-blueprint/35 bg-blueprint/10 text-blueprint'
        }`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
            {arc.arcShape || 'unknown'}
          </p>
          <p className="mt-1 font-mono text-xl tabular-nums">
            {arc.arcScore ?? 'n/a'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Metric label="First alive" value={arc.firstAliveTurn ?? 'none'} tone={arc.firstAliveTurn && arc.firstAliveTurn <= 2 ? 'green' : 'gold'} />
        <Metric label="First flat" value={arc.firstFlatTurn ?? 'none'} tone={arc.firstFlatTurn ? 'red' : 'green'} />
        <Metric label="Agency peak" value={arc.strongestAgencyMoment?.agencyScore ?? 'n/a'} tone="blue" />
        <Metric label="Friction peak" value={arc.strongestFrictionMoment?.frictionScore ?? 'n/a'} tone={arc.strongestFrictionMoment?.frictionScore > 55 ? 'red' : 'green'} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Felt-control timeline
          </p>
          <div className="mt-3 flex h-28 items-end gap-1 rounded border border-exp-border/60 bg-exp-dark/35 p-3">
            {timeline.slice(0, 18).map((event, index) => (
              <div key={`${event.runIndex}-${event.turn}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end gap-0.5">
                  <div
                    className={`min-w-0 flex-1 rounded-t ${event.frictionScore >= 55 ? 'bg-signal-red' : event.lifePulse >= 65 ? 'bg-oxide-green' : 'bg-compass-bright'}`}
                    style={{ height: `${Math.max(5, event.lifePulse || 0)}%` }}
                    title={`Turn ${event.turn}: ${event.feelingLabel} / pulse ${event.lifePulse}`}
                  />
                </div>
                <span className="font-mono text-[9px] text-exp-text-dim">{event.turn}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {labelEntries.slice(0, 8).map(([label, count]) => (
              <span key={label} className="rounded border border-exp-border/60 bg-exp-dark/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-exp-text-dim">
                {label} {count}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded border border-compass/25 bg-compass/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
            Next feeling experiment
          </p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">
            {recommendation.title || 'No feeling recommendation generated.'}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {recommendation.reason || 'Run a feeling report after the next simulator pass.'}
          </p>
          {recommendation.command && (
            <pre className="mt-2 overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/50 p-2 font-mono text-[10px] text-compass-bright">
              {recommendation.command}
            </pre>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {[arc.bestMoment, arc.worstMoment, arc.payoffMoment || arc.recoveryMoment].filter(Boolean).map((moment) => (
          <div key={`${moment.label}-${moment.turn}-${moment.action}`} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-compass-bright">
              Turn {moment.turn} / {moment.label}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text">
              {moment.controlFeelNote || moment.reason}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
              action {moment.action || 'none'} / pulse {moment.lifePulse} / agency {moment.agencyScore} / friction {moment.frictionScore}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function tutorTone(status) {
  if (status === 'graduated' || status === 'passed') return 'green';
  if (status === 'blocked' || status === 'regressed' || status === 'failed') return 'red';
  if (status === 'needs-evidence') return 'blue';
  if (status === 'in-progress') return 'gold';
  return 'neutral';
}

function ScenarioSelfDrivingTutorPanel({ lesson, curriculum, currentScenarioId }) {
  if (!lesson) {
    const top = curriculum?.highestPriorityLesson || curriculum?.lessons?.[0];
    return (
      <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
              Scenario Self-Driving Tutor
            </h2>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
              Builds the next gameplay lesson: what to work on, why it matters, the command chain, and what evidence proves it worked.
            </p>
          </div>
          <span className="rounded border border-blueprint/35 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-blueprint">
            Awaiting lesson
          </span>
        </div>
        <pre className="mt-3 overflow-x-auto rounded border border-exp-border bg-exp-dark/60 p-3 font-mono text-[11px] text-compass-bright">
          {`npm run tutor:scenario -- --id=${currentScenarioId || 'escape-pressure-4p'}\nnpm run tutor:next -- --markdown`}
        </pre>
        {top && (
          <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
              Top project lesson
            </p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
              {top.scenarioId}: {top.primaryWeakness?.title || top.category}
            </p>
          </div>
        )}
      </section>
    );
  }

  const tone = tutorTone(lesson.status);
  const criteria = lesson.successCriteria || [];
  const blockers = lesson.blockers || [];
  const steps = lesson.steps || [];
  const citations = lesson.citations || [];
  const topProject = curriculum?.highestPriorityLesson;

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Scenario Self-Driving Tutor
          </h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Current lesson for {lesson.scenarioId}; the tutor ranks the next useful learning task from Memory, Time Machine, and Lab Notebook evidence.
          </p>
        </div>
        <div className={`rounded border px-3 py-2 text-right ${
          tone === 'green'
            ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
            : tone === 'red'
              ? 'border-signal-red/35 bg-signal-red/10 text-signal-red'
              : tone === 'blue'
                ? 'border-blueprint/35 bg-blueprint/10 text-blueprint'
                : tone === 'gold'
                  ? 'border-compass/35 bg-compass/10 text-compass-bright'
                  : 'border-exp-border bg-exp-dark/40 text-exp-text-dim'
        }`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
            {lesson.status || 'ready'}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em]">
            {lesson.priority || 'medium'} priority
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Metric label="Category" value={lesson.category || 'lesson'} tone="blue" />
        <Metric label="Health" value={lesson.evidence?.latestHealth ?? 'n/a'} tone={tone} />
        <Metric label="Criteria" value={criteria.length} tone="green" />
        <Metric label="Blockers" value={blockers.length} tone={blockers.length ? 'red' : 'green'} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Primary weakness
          </p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">
            {lesson.primaryWeakness?.title || 'No weakness detected.'}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {lesson.whyItMatters || lesson.primaryWeakness?.why || 'No rationale recorded.'}
          </p>
          {topProject && topProject.scenarioId !== lesson.scenarioId && (
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-compass-bright">
              Project top priority: {topProject.scenarioId} / {topProject.primaryWeakness?.title || topProject.category}
            </p>
          )}
        </div>

        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Primary command
          </p>
          <pre className="mt-2 overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/50 p-2 font-mono text-[10px] text-compass-bright">
            {lesson.commands?.primary || `npm run tutor:scenario -- --id=${lesson.scenarioId}`}
          </pre>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Graduation
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {lesson.graduation?.status || 'ready'} / {lesson.graduation?.reason || 'No graduation check recorded.'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-blueprint">
            Lesson steps
          </p>
          <div className="mt-2 space-y-1">
            {steps.slice(0, 4).map((step) => (
              <p key={`${step.order}-${step.title}`} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {step.order}. {step.title}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded border border-oxide-green/25 bg-oxide-green/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-oxide-green">
            Success criteria
          </p>
          <div className="mt-2 space-y-1">
            {criteria.slice(0, 4).map((criterion) => (
              <p key={`${criterion.metric}-${criterion.label}`} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {criterion.label}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded border border-compass/25 bg-compass/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
            Blockers
          </p>
          <div className="mt-2 space-y-1">
            {blockers.length > 0 ? blockers.slice(0, 4).map((blocker) => (
              <p key={`${blocker.type || blocker.source}-${blocker.field || blocker.key || blocker.title}`} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {blocker.message || blocker.title || blocker.field || blocker.key}
              </p>
            )) : (
              <p className="font-mono text-[11px] text-exp-text-dim">No blockers recorded.</p>
            )}
          </div>
        </div>
      </div>

      {citations.length > 0 && (
        <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Evidence citations
          </p>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            {citations.slice(0, 4).map((citation) => (
              <p key={`${citation.id}-${citation.sourcePath}`} className="break-all font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {citation.type || 'evidence'} / {citation.sourcePath || 'unknown'}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function setupTone(level) {
  if (level === 'exact') return 'green';
  if (level === 'partial') return 'gold';
  if (level === 'blocked') return 'red';
  return 'blue';
}

function SetupForgePanel({ report = {} }) {
  const setupForge = report.setupForge;
  const application = report.setupApplication || {};
  const hasSetup = Boolean(setupForge || application.support?.length || application.applied?.length || application.skipped?.length);
  const level = report.setupLevel || application.level || setupForge?.requiredSetupLevel || 'metadata';
  const support = application.support || [];
  const applied = application.applied || [];
  const skipped = application.skipped || [];
  const failed = application.failed || [];
  const criticalSkipped = skipped.filter((item) => item.critical || /landing|artifact|stat|location/i.test(`${item.field || ''} ${item.label || ''}`));
  const warnings = application.warnings || [];
  const errors = application.errors || [];
  const diff = report.oracle?.evidence?.setupDiff || application.diff || null;
  const preludeTurns = report.setupPreludeTurns || [];

  if (!hasSetup) {
    return (
      <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
              Scenario Setup Forge
            </h2>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
              Setup Forge turns authored starting conditions into exact contract writes where the deployed engine exposes safe setup hooks.
            </p>
          </div>
          <span className="rounded border border-blueprint/35 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-blueprint">
            Metadata only
          </span>
        </div>
        <pre className="mt-3 overflow-x-auto rounded border border-exp-border bg-exp-dark/60 p-3 font-mono text-[11px] text-compass-bright">
          {`npm run setup:explain -- --id=escape-pressure-4p\nnpm run scenario:run -- --id=escape-pressure-4p --setup-mode=best-effort`}
        </pre>
      </section>
    );
  }

  const requestedPlayers = setupForge?.players || [];
  const board = setupForge?.board || {};

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Scenario Setup Forge
          </h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Contract-applied starting state, skipped setup claims, and the exactness level the Oracle used for this report.
          </p>
        </div>
        <div className={`rounded border px-3 py-2 text-right ${
          setupTone(level) === 'green'
            ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
            : setupTone(level) === 'red'
              ? 'border-signal-red/35 bg-signal-red/10 text-signal-red'
              : setupTone(level) === 'gold'
                ? 'border-compass/35 bg-compass/10 text-compass-bright'
                : 'border-blueprint/35 bg-blueprint/10 text-blueprint'
        }`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
            {level}
          </p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em]">
            required {setupForge?.requiredSetupLevel || application.requiredSetupLevel || 'metadata'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Metric label="Applied" value={applied.length} tone="green" />
        <Metric label="Skipped" value={skipped.length} tone={skipped.length ? 'gold' : 'green'} />
        <Metric label="Failed" value={failed.length} tone={failed.length ? 'red' : 'green'} />
        <Metric label="Prelude" value={preludeTurns.length || setupForge?.scriptedPrelude?.turns || 0} tone="blue" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Requested setup
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {requestedPlayers.length > 0 ? requestedPlayers.map((player) => (
              <div key={player.playerId || player.playerIndex} className="rounded border border-exp-border/50 px-2 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-compass-bright">
                  P{player.playerId || player.playerIndex + 1}
                </p>
                <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
                  Stats {player.stats ? `${player.stats.movement}/${player.stats.agility}/${player.stats.dexterity}` : 'default'} / loc {player.location || 'start'}
                </p>
                <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
                  Items {(player.inventory || []).join(', ') || 'none'} / artifacts {(player.artifacts || []).join(', ') || 'none'}
                </p>
              </div>
            )) : (
              <p className="font-mono text-xs text-exp-text-dim">No player setup requested.</p>
            )}
          </div>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            Revealed {(board.revealedZones || []).join(', ') || 'none'} / terrain {Object.keys(board.terrain || {}).length} / landing {board.landingZone || 'engine default'} / camps {(board.campsites || []).join(', ') || 'none'}
          </p>
        </div>

        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Support matrix
          </p>
          <div className="mt-2 space-y-1">
            {support.length > 0 ? support.slice(0, 8).map((field) => (
              <div key={`${field.key}-${field.label}`} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="text-exp-text">{field.label || field.key}</span>
                <span className={field.exact ? 'text-oxide-green' : field.status === 'contractBlocked' ? 'text-signal-red' : 'text-compass-bright'}>
                  {field.exact ? 'exact' : field.status}
                </span>
              </div>
            )) : (
              <p className="font-mono text-xs text-exp-text-dim">No setup fields requested.</p>
            )}
          </div>
        </div>
      </div>

      {(criticalSkipped.length > 0 || failed.length > 0 || warnings.length > 0 || errors.length > 0) && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded border border-compass/30 bg-compass/5 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
              Skipped or blocked
            </p>
            <div className="mt-2 space-y-1">
              {[...criticalSkipped, ...failed].slice(0, 6).map((item, index) => (
                <p key={`${item.field}-${index}`} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
                  {item.label || item.field}: {item.reason || item.error || item.status}
                </p>
              ))}
              {criticalSkipped.length === 0 && failed.length === 0 && warnings.slice(0, 3).map((warning) => (
                <p key={warning} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">{warning}</p>
              ))}
            </div>
          </div>
          <div className="rounded border border-signal-red/25 bg-signal-red/5 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-signal-red">
              Gate evidence
            </p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">
              {(errors || []).concat(warnings || []).slice(0, 4).join(' / ') || 'No setup gate warnings.'}
            </p>
            {diff?.mismatches?.length > 0 && (
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-compass-bright">
                Mismatches: {diff.mismatches.slice(0, 3).map((item) => item.label || item.field).join(', ')}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function OraclePanel({ oracle, history = [] }) {
  if (!oracle) {
    return (
      <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
              Gameplay Oracle
            </h2>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
              Run `npm run oracle:latest` after a simulator report to get a design verdict, decisive turns, and one next experiment.
            </p>
          </div>
          <span className="rounded border border-compass/30 bg-compass/5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-compass-bright">
            Awaiting oracle
          </span>
        </div>
      </section>
    );
  }

  const scores = Object.entries(oracle.experienceScores || {}).sort(([a], [b]) => a.localeCompare(b));
  const weakest = [...scores].sort(([, a], [, b]) => a.score - b.score)[0];
  const strongest = [...scores].sort(([, a], [, b]) => b.score - a.score)[0];
  const decisiveTurns = oracle.evidence?.decisiveTurns || [];
  const experiment = oracle.smallestNextExperiment;

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Gameplay Oracle
          </h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Design-level readout for agency, readability, pacing, system interaction, and the smallest next experiment.
          </p>
        </div>
        <div className={`rounded border px-3 py-2 text-right ${
          ['strong-pass', 'pass'].includes(oracle.oracleVerdict)
            ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
            : oracle.oracleVerdict === 'fail' || oracle.oracleVerdict === 'blocked'
              ? 'border-signal-red/35 bg-signal-red/10 text-signal-red'
              : 'border-compass/35 bg-compass/10 text-compass-bright'
        }`}>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
            {oracle.oracleVerdict}
          </p>
          <p className="mt-1 font-mono text-xl tabular-nums">
            {oracle.weightedScore}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Metric label="Confidence" value={`${Math.round((oracle.confidence || 0) * 100)}%`} tone="blue" />
        <Metric label="Weakest" value={weakest ? `${weakest[0]} ${weakest[1].score}` : 'none'} tone="red" />
        <Metric label="Strongest" value={strongest ? `${strongest[0]} ${strongest[1].score}` : 'none'} tone="green" />
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {scores.map(([key, item]) => {
          const pct = Math.max(0, Math.min(100, Number(item.score || 0)));
          return (
            <div key={key} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
              <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px]">
                <span className="uppercase tracking-[0.16em] text-exp-text-dim">{key}</span>
                <span className="text-compass-bright">{pct}</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-exp-border/70" aria-label={`${key} score ${pct}`}>
                <div className={`h-full rounded ${pct >= 70 ? 'bg-oxide-green' : pct >= 50 ? 'bg-compass-bright' : 'bg-signal-red'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Diagnosis
          </p>
          <div className="mt-2 space-y-1">
            {(oracle.diagnosis || []).map((line) => (
              <p key={line} className="font-mono text-xs leading-relaxed text-exp-text">
                {line}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded border border-compass/30 bg-compass/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
            Smallest next experiment
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {experiment?.title || 'No experiment generated.'}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {experiment?.why || 'Run a scenario report to generate a targeted recommendation.'}
          </p>
          {experiment?.verificationCommand && (
            <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-compass-bright">
              {experiment.verificationCommand}
            </p>
          )}
        </div>
      </div>

      {decisiveTurns.length > 0 && (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {decisiveTurns.slice(0, 6).map((turn) => (
            <div key={turn.id} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-compass-bright">
                  T{turn.turn} / {turn.label}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">
                  {turn.strategy} / {turn.experience}
                </p>
              </div>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
                {turn.why}
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-blueprint">
                actions {(turn.actions || []).join(', ') || 'none'} / stats {formatDelta(turn.statDelta)} / reveal {formatDelta(turn.revealedDelta)} / artifacts {formatDelta(turn.artifactDelta)}
              </p>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
            Oracle history
          </p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {history.slice(0, 10).map((entry) => (
              <div key={`${entry.generatedAt}-${entry.scenarioId}`} className="rounded border border-exp-border/50 px-2 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">
                  {entry.scenarioId}
                </p>
                <p className="mt-1 font-mono text-[11px] text-exp-text">
                  {entry.verdict} / {entry.weightedScore}
                </p>
                <p className="mt-1 font-mono text-[10px] text-exp-text-dim">
                  weak {entry.weakestScore?.metric || 'none'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ScenarioBrowser({ scenarios = [], verdict, oracle }) {
  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
            Scenario Designer
          </h2>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Plain-English scenarios become saved design questions, simulator configs, targets, failure signals, and history.
          </p>
        </div>
        <pre className="max-w-full overflow-x-auto rounded border border-exp-border bg-exp-dark/60 p-2 font-mono text-[10px] text-compass-bright">
          {`npm run scenario:create -- "4-player escape pressure with two exhausted players"\nnpm run scenario:run -- --id=escape-pressure-4p`}
        </pre>
      </div>

      {verdict && (
        <div className={`mt-3 rounded border px-3 py-2 ${
          verdict.verdict === 'answered'
            ? 'border-oxide-green/30 bg-oxide-green/5'
            : verdict.verdict === 'failed'
              ? 'border-signal-red/30 bg-signal-red/5'
              : 'border-compass/30 bg-compass/5'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
              Scenario answered?
            </p>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-exp-text">
              {verdict.verdict}
            </p>
          </div>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {verdict.designQuestion}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {(verdict.reasons || []).join(' / ')}
          </p>
          {verdict.nextScenario && (
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-compass-bright">
              Next: {verdict.nextScenario.name} / {(verdict.nextScenario.changes || []).join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {scenarios.map((scenario) => (
          <div key={scenario.id} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-compass-bright">
                {scenario.name}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">
                {scenario.players}P / {scenario.turns} turns
              </p>
            </div>
            {oracle?.scenarioId === scenario.id && (
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-oxide-green">
                Oracle: {oracle.oracleVerdict} / score {oracle.weightedScore} / setup {oracle.setup?.level || 'metadata'} / next {oracle.smallestNextExperiment?.title || 'none'}
              </p>
            )}
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
              {scenario.designQuestion}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {(scenario.tags || []).map((tag) => (
                <span key={tag} className="rounded border border-blueprint/25 bg-blueprint/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">
              Strategies: {(scenario.strategies || []).join(', ')}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
              Assumptions: {(scenario.assumptions || []).join(' / ') || 'none'}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-blueprint">
              Setup: {scenario.setupLevel || 'metadata'} / {(scenario.setupClaims || []).join(' / ') || 'no setup claims'}
            </p>
            <pre className="mt-2 overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/50 p-2 font-mono text-[10px] text-compass-bright">
              {scenario.command}
            </pre>
          </div>
        ))}
      </div>
    </section>
  );
}

function TensionCurve({ points = [], turns = [] }) {
  if (points.length === 0) return null;
  const lifeByTurn = Object.fromEntries((turns || []).map((turn) => [
    Number(turn.turn),
    turn.analysis?.funDebugger?.lifeScore ?? turn.lifeScore ?? 0,
  ]));
  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
        Tension / Life Curve
      </h2>
      <div className="mt-3 flex h-28 items-end gap-1 rounded border border-exp-border/60 bg-exp-dark/35 p-3">
        {points.map((point) => (
          <div key={point.turn} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-20 w-full items-end gap-0.5">
              <div
                className="min-w-0 flex-1 rounded-t bg-compass-bright"
                style={{ height: `${Math.max(4, point.tension)}%` }}
                title={`Tension turn ${point.turn}: ${point.tension} / ${(point.reasons || []).join(', ') || 'steady'}`}
              />
              <div
                className="min-w-0 flex-1 rounded-t bg-blueprint"
                style={{ height: `${Math.max(4, lifeByTurn[Number(point.turn)] || 0)}%` }}
                title={`Life turn ${point.turn}: ${lifeByTurn[Number(point.turn)] || 0}`}
              />
            </div>
            <span className="font-mono text-[9px] text-exp-text-dim">{point.turn}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {points.filter((point) => point.tension > 0).slice(0, 4).map((point) => (
          <div key={`reason-${point.turn}`} className="rounded border border-exp-border/50 bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-compass-bright">
              Turn {point.turn} / {point.tension}
            </p>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
              {(point.reasons || []).join(', ') || 'Small pressure change.'}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TargetScorecard({ targetEvaluation = {}, scenarioGoalEvaluation = {} }) {
  const targetChecks = targetEvaluation.checks || [];
  const scenarioChecks = scenarioGoalEvaluation.checks || [];
  const checks = [
    ...targetChecks.map((check) => ({ ...check, group: 'target' })),
    ...scenarioChecks.map((check) => ({ ...check, group: scenarioGoalEvaluation.scenario || 'scenario' })),
  ];
  if (checks.length === 0) return null;

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
          Tuning Scorecard
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
          Targets {targetEvaluation.passed || 0}/{targetEvaluation.total || 0} / Scenario {scenarioGoalEvaluation.passed || 0}/{scenarioGoalEvaluation.total || 0}
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {checks.map((check) => (
          <div
            key={`${check.group}-${check.metric}`}
            className={`rounded border px-3 py-2 ${
              check.pass
                ? 'border-oxide-green/30 bg-oxide-green/5'
                : 'border-signal-red/35 bg-signal-red/5'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
                {check.label || check.metric}
              </p>
              <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${check.pass ? 'text-oxide-green' : 'text-signal-red'}`}>
                {check.pass ? 'Pass' : 'Tune'}
              </span>
            </div>
            <p className="mt-2 font-mono text-lg text-exp-text">
              {formatNumber(check.value)}
            </p>
            <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
              {check.group} / {check.target}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TuningTasks({ tasks = [], tuning = {} }) {
  if (tasks.length === 0 && !tuning.note && !tuning.hypothesis && !tuning.changed) return null;

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
        Tuning Notes
      </h2>
      {(tuning.note || tuning.hypothesis || tuning.changed) && (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {[
            ['Note', tuning.note],
            ['Hypothesis', tuning.hypothesis],
            ['Changed', tuning.changed],
          ].filter(([, value]) => value).map(([label, value]) => (
            <div key={label} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
                {label}
              </p>
              <p className="mt-1 break-words font-mono text-xs leading-relaxed text-exp-text">
                {value}
              </p>
            </div>
          ))}
        </div>
      )}
      {tasks.length > 0 && (
        <div className="mt-3 space-y-2">
          {tasks.map((task, index) => (
            <div key={`${task.source}-${task.metric}-${index}`} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-exp-text">
                  {task.priority} / {task.metric}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">
                  {task.source}
                </p>
              </div>
              <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
                {task.message}
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-compass-bright">
                {task.hint}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BaselineComparison({ comparison }) {
  if (!comparison) return null;
  const averageEntries = Object.entries(comparison.averages || {});
  const shareEntries = Object.entries(comparison.actionShares || {});
  const funEntries = Object.entries(comparison.funDebugger || {})
    .filter(([, value]) => value && typeof value === 'object' && value.delta !== undefined);

  return (
    <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-exp-text-dim">
          Baseline Delta
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
          Warnings {formatDelta(comparison.warningDelta)}
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {averageEntries.map(([metric, values]) => (
          <Metric key={metric} label={metric} value={formatDelta(values.delta)} tone={values.delta >= 0 ? 'blue' : 'gold'} />
        ))}
      </div>
      {shareEntries.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {shareEntries.map(([action, values]) => (
            <PercentMetric key={action} label={`${action} delta`} value={values.delta} />
          ))}
        </div>
      )}
      {funEntries.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {funEntries.map(([metric, values]) => (
            <Metric key={metric} label={`Fun ${metric}`} value={formatDelta(values.delta)} tone={values.delta >= 0 ? 'blue' : 'red'} />
          ))}
        </div>
      )}
      {comparison.funDebugger?.topExperimentAfter && (
        <div className="mt-3 rounded border border-compass/25 bg-compass/5 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">
            Fun debugger comparison
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            Issue before: {comparison.funDebugger.topIssueBefore || 'none'} / issue after: {comparison.funDebugger.topIssueAfter || 'none'}
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-compass-bright">
            Next experiment: {comparison.funDebugger.topExperimentAfter}
          </p>
        </div>
      )}
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
  const analysis = turn.analysis || {};
  const recap = analysis.recap || [];
  const turnDebug = analysis.funDebugger;
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
      {recap.length > 0 && (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {recap.map((item) => (
            <div key={`${turn.turn}-${item.label}`} className="rounded border border-exp-border/50 bg-exp-dark/35 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">
                {item.label}
              </p>
              <p className={`mt-1 font-mono text-xs ${item.tone === 'red' ? 'text-signal-red' : item.tone === 'gold' ? 'text-compass-bright' : 'text-blueprint'}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}
      {turnDebug && (
        <div className="mt-3 rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-blueprint">
              Fun debugger / {turnDebug.classification}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
              life {turnDebug.lifeScore} / confidence {Math.round((turnDebug.confidence || 0) * 100)}%
            </p>
          </div>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
            {turnDebug.suggestion}
          </p>
          <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">
            {(turnDebug.causes || []).slice(0, 3).map((cause) => `${cause.label}: ${cause.evidence}`).join(' / ') || 'No flat cause.'}
          </p>
        </div>
      )}
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
            {submission.validityLog?.length > 0 && (
              <div className="mt-2 space-y-1">
                {submission.validityLog.slice(0, 3).map((entry) => (
                  <p key={`${entry.action}-${entry.reason}`} className={`font-mono text-[10px] ${entry.ok ? 'text-oxide-green' : 'text-signal-red'}`}>
                    {entry.ok ? 'valid' : 'blocked'} / {entry.action}{entry.reason ? ` / ${entry.reason}` : ''}
                  </p>
                ))}
              </div>
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
  const [autoTuneReport, setAutoTuneReport] = useState(null);
  const [autopilotReport, setAutopilotReport] = useState(null);
  const [memoryReport, setMemoryReport] = useState(null);
  const [timeMachineIndex, setTimeMachineIndex] = useState(null);
  const [timeMachineReport, setTimeMachineReport] = useState(null);
  const [labNotebookIndex, setLabNotebookIndex] = useState(null);
  const [labNotebookEntry, setLabNotebookEntry] = useState(null);
  const [tutorCurriculum, setTutorCurriculum] = useState(null);
  const [tutorLesson, setTutorLesson] = useState(null);
  const [feelingIndex, setFeelingIndex] = useState(null);
  const [feelingReport, setFeelingReport] = useState(null);
  const [oracleReport, setOracleReport] = useState(null);
  const [oracleHistory, setOracleHistory] = useState([]);
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

  useEffect(() => {
    let cancelled = false;
    fetch('/simulator/autotune/latest-report.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No auto-tune report found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setAutoTuneReport(json);
      })
      .catch(() => {
        if (!cancelled) setAutoTuneReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/simulator/autopilot/latest-report.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No Autopilot report found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setAutopilotReport(json);
      })
      .catch(() => {
        if (!cancelled) setAutopilotReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/simulator/memory/latest-memory.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No memory report found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setMemoryReport(json);
      })
      .catch(() => {
        if (!cancelled) setMemoryReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/simulator/time-machine/index.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No Time Machine index found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setTimeMachineIndex(json);
      })
      .catch(() => {
        if (!cancelled) setTimeMachineIndex(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/simulator/lab-notebook/index.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No Lab Notebook index found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setLabNotebookIndex(json);
      })
      .catch(() => {
        if (!cancelled) setLabNotebookIndex(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/simulator/tutor/latest-curriculum.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No Tutor curriculum found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setTutorCurriculum(json);
      })
      .catch(() => {
        if (!cancelled) setTutorCurriculum(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/simulator/feeling-black-box/index.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No Player Feeling Black Box index found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setFeelingIndex(json);
      })
      .catch(() => {
        if (!cancelled) setFeelingIndex(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/simulator/oracle/latest-oracle.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No Oracle report found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setOracleReport(json);
      })
      .catch(() => {
        if (!cancelled) setOracleReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/simulator/oracle/summary-index.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No Oracle history found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setOracleHistory(Array.isArray(json) ? json : []);
      })
      .catch(() => {
        if (!cancelled) setOracleHistory([]);
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
  const targetEvaluation = report.targetEvaluation || SAMPLE_REPORT.targetEvaluation;
  const scenarioGoalEvaluation = report.scenarioGoalEvaluation || SAMPLE_REPORT.scenarioGoalEvaluation;
  const tasks = report.tasks || [];
  const tuning = report.tuning || SAMPLE_REPORT.tuning;
  const funDebugger = report.funDebugger || SAMPLE_REPORT.funDebugger;
  const oracle = oracleReport || report.oracle || SAMPLE_REPORT.oracle;
  const currentScenarioId = report.scenarioDefinition?.id || report.config?.scenarioId || report.config?.scenario || '';
  const command = `node scripts/gameplay-simulator.mjs --scenario=benchmark --batch=3 --setup-mode=best-effort --note="first pass" --hypothesis="movement should reveal faster"`;

  useEffect(() => {
    if (!currentScenarioId || currentScenarioId === 'none') {
      setTimeMachineReport(null);
      return undefined;
    }
    let cancelled = false;
    fetch(`/simulator/time-machine/${currentScenarioId}/latest-report.json`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No Time Machine report found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setTimeMachineReport(json);
      })
      .catch(() => {
        if (!cancelled) setTimeMachineReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentScenarioId]);

  useEffect(() => {
    if (!currentScenarioId || currentScenarioId === 'none') {
      setLabNotebookEntry(null);
      return undefined;
    }
    let cancelled = false;
    fetch(`/simulator/lab-notebook/${currentScenarioId}/latest-entry.json`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No Lab Notebook entry found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setLabNotebookEntry(json);
      })
      .catch(() => {
        if (!cancelled) setLabNotebookEntry(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentScenarioId]);

  useEffect(() => {
    if (!currentScenarioId || currentScenarioId === 'none') {
      setTutorLesson(null);
      return undefined;
    }
    let cancelled = false;
    fetch(`/simulator/tutor/${currentScenarioId}/latest-lesson.json`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No Tutor lesson found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setTutorLesson(json);
      })
      .catch(() => {
        if (!cancelled) setTutorLesson(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentScenarioId]);

  useEffect(() => {
    if (!currentScenarioId || currentScenarioId === 'none') {
      setFeelingReport(null);
      return undefined;
    }
    let cancelled = false;
    fetch(`/simulator/feeling-black-box/${currentScenarioId}/latest-report.json`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No Player Feeling Black Box report found.');
        return response.json();
      })
      .then((json) => {
        if (!cancelled) setFeelingReport(json);
      })
      .catch(() => {
        if (!cancelled) setFeelingReport(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentScenarioId]);

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
          <div className="mt-3 rounded border border-compass/25 bg-compass/5 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-compass">
              Scenario question
            </p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">
              {getScenarioQuestion(report.config?.scenario || 'benchmark')}
            </p>
          </div>
          <pre className="mt-3 overflow-x-auto rounded border border-exp-border bg-exp-dark/60 p-3 font-mono text-[11px] text-compass-bright">
            {`npm run local:solo\n${command}`}
          </pre>
          <pre className="mt-2 overflow-x-auto rounded border border-exp-border bg-exp-dark/60 p-3 font-mono text-[11px] text-blueprint">
            {`npm run sim:golden -- --save-baseline\nnpm run sim:golden -- --baseline --changed="movement tuning"`}
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
      <FunDebuggerPanel funDebugger={funDebugger} />
      <SetupForgePanel report={report} />
      <OraclePanel oracle={oracle} history={oracleHistory} />
      <AutoTunePanel report={autoTuneReport} />
      <AutopilotPanel report={autopilotReport} />
      <PlayableDesignMemoryPanel memory={memoryReport} currentScenarioId={currentScenarioId} />
      <ScenarioTimeMachinePanel report={timeMachineReport} index={timeMachineIndex} currentScenarioId={currentScenarioId} />
      <ScenarioLabNotebookPanel entry={labNotebookEntry} index={labNotebookIndex} currentScenarioId={currentScenarioId} />
      <PlayerFeelingBlackBoxPanel report={feelingReport} index={feelingIndex} currentScenarioId={currentScenarioId} />
      <ScenarioSelfDrivingTutorPanel lesson={tutorLesson} curriculum={tutorCurriculum} currentScenarioId={currentScenarioId} />
      <ScenarioBrowser scenarios={SCENARIO_CATALOG} verdict={report.scenarioVerdict} oracle={oracle} />
      <SmallestExperimentQueue experiments={funDebugger.smallestExperimentQueue || funDebugger.topExperiments || []} />
      <TargetScorecard targetEvaluation={targetEvaluation} scenarioGoalEvaluation={scenarioGoalEvaluation} />
      <TuningTasks tasks={tasks} tuning={tuning} />
      <BaselineComparison comparison={report.comparison} />
      <StrategyComparison strategies={aggregate.strategies} />
      <TensionCurve points={summary.tensionCurve || []} turns={report.turns || []} />

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
