import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  bridgeDevlogEntries,
  fetchBridgeReport,
  mergeReadinessIntoProgress,
  publicVerdictLabel,
  readinessForScenario,
  readinessTone,
  scenarioRouteFromBridge,
  selectChallengeScenario,
  selectFeaturedScenario,
} from '../lib/bridgeData';
import {
  applyGrowthAction,
  actionPreviewFor,
  availableGrowthActions,
  buildCreatorScenario,
  buildDevlogEntries,
  buildPublicProgress,
  createGrowthRun,
  decodeRun,
  GROWTH_SCENARIOS,
  growthEvent,
  rankChallengeRuns,
  replayPathForRun,
  shareTextForRun,
  summarizeGrowthRun,
  WEEKLY_CHALLENGE,
} from '../lib/growthLoop';
import { funReportText } from '../lib/funLoop';
import {
  DISCOVERY_TOPICS,
  relatedScenariosFor,
  relatedTopicsForScenario,
  scenarioForId,
  scenariosForTopic,
  topicForId,
} from '../lib/publicRoutes';

const RUNS_KEY = 'xenovoya.growth.runs';
const EVENTS_KEY = 'xenovoya.growth.events';

function loadJson(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) || '') || fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value));
}

function recordEvent(type, payload = {}) {
  const events = loadJson(EVENTS_KEY, []);
  saveJson(EVENTS_KEY, [...events, growthEvent(type, payload)].slice(-300));
}

function saveRun(run) {
  const runs = loadJson(RUNS_KEY, []);
  const next = [...runs.filter((item) => item.id !== run.id), run].slice(-80);
  saveJson(RUNS_KEY, next);
  return next;
}

function useQuery() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search), [location.search]);
}

function useBridgeReport() {
  const [bridgeReport, setBridgeReport] = useState(null);
  useEffect(() => {
    let active = true;
    fetchBridgeReport().then((report) => {
      if (active) setBridgeReport(report);
    });
    return () => { active = false; };
  }, []);
  return bridgeReport;
}

function ToneBadge({ children, tone = 'blue' }) {
  const colors = tone === 'green'
    ? 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green'
    : tone === 'red'
      ? 'border-signal-red/35 bg-signal-red/10 text-signal-red'
      : tone === 'gold'
        ? 'border-compass/35 bg-compass/10 text-compass-bright'
        : 'border-blueprint/35 bg-blueprint/10 text-blueprint';
  return <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${colors}`}>{children}</span>;
}

function BridgeReadinessBadge({ readiness }) {
  if (!readiness) return <ToneBadge>Evidence pending</ToneBadge>;
  return (
    <ToneBadge tone={readinessTone(readiness.gateVerdict)}>
      {publicVerdictLabel(readiness.gateVerdict)} {readiness.readinessScore ?? 0}
    </ToneBadge>
  );
}

function EvidenceCitationsList({ readiness }) {
  const citations = [
    readiness?.evidence?.feeling?.sourcePath ? `Feeling: ${readiness.evidence.feeling.sourcePath}` : null,
    readiness?.evidence?.timeMachine?.latestGeneratedAt ? `Time Machine: ${readiness.evidence.timeMachine.trend || 'unknown'} at ${readiness.evidence.timeMachine.latestGeneratedAt}` : null,
    readiness?.evidence?.lab?.readiness?.status ? `Lab: ${readiness.evidence.lab.readiness.status}` : null,
  ].filter(Boolean);
  if (citations.length === 0) return null;
  return (
    <div className="mt-3 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim">Evidence</p>
      <div className="mt-2 space-y-1">
        {citations.map((citation) => <p key={citation} className="font-mono text-[11px] leading-relaxed text-exp-text-dim">{citation}</p>)}
      </div>
    </div>
  );
}

function NextFixCommand({ readiness }) {
  if (!readiness?.nextFix) return null;
  return (
    <details className="mt-3 rounded border border-compass/25 bg-compass/5 px-3 py-2">
      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.22em] text-compass">Next evidence fix</summary>
      <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">{readiness.nextFix.title}</p>
      <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">{readiness.nextFix.reason}</p>
      <code className="mt-2 block overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/60 px-2 py-2 font-mono text-[11px] text-compass-bright">{readiness.nextFix.command}</code>
    </details>
  );
}

function Metric({ label, value, tone = 'blue' }) {
  return (
    <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">{label}</p>
      <p className={`mt-1 font-mono text-lg ${tone === 'green' ? 'text-oxide-green' : tone === 'red' ? 'text-signal-red' : tone === 'gold' ? 'text-compass-bright' : 'text-blueprint'}`}>{value}</p>
    </div>
  );
}

function GrowthFrame({ title, eyebrow, children, actions = null }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-compass">{eyebrow}</p>
          <h1 className="mt-1 font-display text-2xl uppercase tracking-[0.18em] text-exp-text">{title}</h1>
        </div>
        <nav className="flex flex-wrap gap-2">
          {[
            ['/play', 'Play'],
            ['/challenge', 'Challenge'],
            ['/scenarios', 'Scenarios'],
            ['/progress', 'Progress'],
            ['/devlog', 'Devlog'],
            ['/create-scenario', 'Create'],
          ].map(([to, label]) => (
            <Link key={to} to={to} className="rounded border border-exp-border bg-exp-panel px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim hover:border-compass/50 hover:text-compass-bright">
              {label}
            </Link>
          ))}
          {actions}
        </nav>
      </div>
      {children}
    </div>
  );
}

function BoardState({ run }) {
  const tiles = Array.from({ length: 9 }, (_, index) => index);
  const reaction = run.fun?.lastReactionClass || '';
  return (
    <div className={`rounded border border-exp-border bg-exp-panel p-4 ${reaction}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Board state</p>
        {run.fun?.modifier && <ToneBadge tone="gold">{run.fun.modifier.name}</ToneBadge>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => {
          const active = tile === Math.max(0, Math.min(8, 8 - run.state.distance * 2));
          const revealed = tile < run.state.revealed + 2;
          return (
            <div
              key={tile}
              className={`aspect-square rounded border ${active ? 'border-compass bg-compass/15' : revealed ? 'border-blueprint/35 bg-blueprint/10' : 'border-exp-border bg-exp-dark/60'} flex items-center justify-center`}
            >
              <span className={`font-mono text-xs ${active ? 'text-compass-bright' : revealed ? 'text-blueprint' : 'text-exp-text-dim'}`}>
                {active ? 'CREW' : revealed ? `Z${tile + 1}` : 'FOG'}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric label="Morale" value={run.state.morale} tone={run.state.morale > 55 ? 'green' : run.state.morale > 25 ? 'gold' : 'red'} />
        <Metric label="Danger" value={run.state.danger} tone={run.state.danger > 70 ? 'red' : run.state.danger > 42 ? 'gold' : 'blue'} />
        <Metric label="Distance" value={run.state.distance} tone={run.state.distance <= 1 ? 'green' : 'blue'} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {(run.fun?.roles || []).map((role) => <ToneBadge key={role.id}>{role.name}</ToneBadge>)}
      </div>
    </div>
  );
}

function ActionPreview({ preview }) {
  if (!preview) return null;
  return (
    <div className="mt-3 rounded border border-blueprint/30 bg-blueprint/5 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-blueprint">Action preview / {preview.intent}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <p className="font-mono text-[11px] leading-relaxed text-exp-text-dim">Upside: {preview.upside}</p>
        <p className="font-mono text-[11px] leading-relaxed text-exp-text-dim">Risk: {preview.risk}</p>
      </div>
      <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">{preview.line}</p>
      {(preview.roleHook || preview.dangerHook || preview.digHook) && (
        <p className="mt-1 font-mono text-[11px] leading-relaxed text-compass-bright">
          {[preview.roleHook, preview.dangerHook, preview.digHook].filter(Boolean).join(' / ')}
        </p>
      )}
    </div>
  );
}

function FunReport({ run, compact = false }) {
  const summary = summarizeGrowthRun(run);
  const quality = summary.funQuality || {};
  return (
    <div className="rounded border border-oxide-green/25 bg-oxide-green/5 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-oxide-green">Fun Report</p>
        <ToneBadge tone={quality.funVerdict === 'share-worthy' ? 'green' : quality.funVerdict === 'flat' ? 'red' : 'gold'}>{quality.funVerdict || 'unplayed'}</ToneBadge>
      </div>
      <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">{funReportText(quality)}</p>
      {!compact && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Metric label="First alive" value={quality.firstAliveTurn ?? 'none'} tone={quality.gates?.firstAlive ? 'green' : 'gold'} />
          <Metric label="Payoffs" value={quality.payoffMoments ?? 0} tone={quality.gates?.payoff ? 'green' : 'red'} />
          <Metric label="Pressure" value={quality.pressureSpikes ?? 0} tone={quality.gates?.pressure ? 'gold' : 'blue'} />
          <Metric label="Recovery" value={quality.recoveryMoments ?? 0} tone={quality.gates?.recovery ? 'green' : 'gold'} />
          <Metric label="Flat streak" value={quality.longestFlatStreak ?? 0} tone={quality.gates?.flatStreak ? 'green' : 'red'} />
          <Metric label="Share moment" value={quality.shareWorthyMoment?.momentTitle || quality.shareWorthyMoment?.feelingLabel || 'none'} tone={quality.gates?.shareWorthy ? 'green' : 'gold'} />
        </div>
      )}
      {quality.recommendations?.length > 0 && (
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-compass-bright">Next fun fix: {quality.recommendations[0]}</p>
      )}
    </div>
  );
}

function ShareCard({ run }) {
  const summary = summarizeGrowthRun(run);
  return (
    <div className="rounded border border-compass/30 bg-compass/5 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">Share card</p>
      <h2 className="mt-2 font-display text-xl uppercase tracking-[0.12em] text-exp-text">{summary.runTitle || summary.scenarioName}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric label="Outcome" value={summary.outcome} tone={summary.outcome === 'escaped' ? 'green' : 'gold'} />
        <Metric label="Artifacts" value={summary.artifacts} tone="green" />
        <Metric label="Arc" value={`${summary.arcShape} ${summary.arcScore}`} tone={summary.arcScore >= 65 ? 'green' : 'gold'} />
        <Metric label="Seed" value={summary.seed} tone="blue" />
      </div>
      {summary.artifactNames?.length > 0 && (
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-compass-bright">Artifacts: {summary.artifactNames.join(', ')}</p>
      )}
      {summary.badges?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">{summary.badges.map((badge) => <ToneBadge key={badge} tone="green">{badge}</ToneBadge>)}</div>
      )}
      {summary.bestBark && <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">{summary.bestBark}</p>}
      <p className="mt-3 font-mono text-xs leading-relaxed text-exp-text">{shareTextForRun(run)}</p>
    </div>
  );
}

export function GrowthPlayPage({ challenge = false }) {
  const query = useQuery();
  const bridgeReport = useBridgeReport();
  const bridgedChoice = challenge ? selectChallengeScenario(bridgeReport) : selectFeaturedScenario(bridgeReport);
  const manualScenarioId = query.get('scenario');
  const manualSeed = query.get('seed');
  const scenarioId = challenge ? manualScenarioId || WEEKLY_CHALLENGE.scenarioId : manualScenarioId || 'solo-artifact-hunt';
  const seed = challenge ? manualSeed || WEEKLY_CHALLENGE.seed : manualSeed || null;
  const mode = query.get('mode') || (String(seed || '').includes('rival') ? 'rival' : 'standard');
  const [run, setRun] = useState(() => {
    const created = createGrowthRun({ scenarioId, seed, mode, challenge });
    recordEvent('run_started', { scenarioId: created.scenario.id, seed: created.seed, challenge });
    return created;
  });
  const [shareVisible, setShareVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedAction, setSelectedAction] = useState('move');
  const runs = loadJson(RUNS_KEY, []);
  const bridgeReadiness = readinessForScenario(bridgeReport, run.scenario.id) || (bridgedChoice?.scenarioId === run.scenario.id ? bridgedChoice : null);
  const leaderboard = rankChallengeRuns(runs, run.scenario.id);
  const summary = summarizeGrowthRun(run);
  const preview = actionPreviewFor(run, selectedAction);
  const latestMoment = [...run.timeline].reverse().find((event) => event.momentType || event.comebackLabel);

  useEffect(() => {
    if (!bridgedChoice?.scenarioId || manualScenarioId || run.turn > 0 || run.timeline.length > 0 || run.scenario.id === bridgedChoice.scenarioId) return;
    const nextSeed = challenge ? bridgedChoice.challengeSeed || WEEKLY_CHALLENGE.seed : manualSeed || null;
    const created = createGrowthRun({ scenarioId: bridgedChoice.scenarioId, seed: nextSeed, mode, challenge });
    setRun(created);
    recordEvent('run_started', { scenarioId: created.scenario.id, seed: created.seed, challenge, bridgeVerdict: bridgedChoice.gateVerdict });
  }, [bridgedChoice, challenge, manualScenarioId, manualSeed, mode, run.scenario.id, run.timeline.length, run.turn]);

  function act(action) {
    const next = applyGrowthAction(run, action);
    setRun(next);
    recordEvent('action_taken', { scenarioId: next.scenario.id, seed: next.seed, action, turn: next.turn });
    if (next.completed) {
      saveRun(next);
      recordEvent('run_completed', { scenarioId: next.scenario.id, seed: next.seed, outcome: next.outcome, arcScore: summarizeGrowthRun(next).arcScore });
    }
  }

  function copyShare() {
    const text = `${shareTextForRun(run)} ${window.location.origin}${replayPathForRun(run)}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setShareVisible(true);
    recordEvent('share_card_generated', { scenarioId: run.scenario.id, seed: run.seed, outcome: run.outcome });
  }

  return (
    <GrowthFrame title={challenge ? `Challenge: ${run.scenario.name}` : run.scenario.name} eyebrow={challenge ? WEEKLY_CHALLENGE.tagline : run.scenario.hook}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <BoardState run={run} />
        <section className="rounded border border-exp-border bg-exp-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Public run</p>
              <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">{run.scenario.premise}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <BridgeReadinessBadge readiness={bridgeReadiness} />
              <ToneBadge tone={run.completed ? 'green' : 'blue'}>{run.completed ? summary.outcome : `Turn ${run.turn + 1}/${run.scenario.maxTurns}`}</ToneBadge>
            </div>
          </div>
          {bridgeReadiness?.blockers?.length > 0 && (
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-compass-bright">{bridgeReadiness.blockers[0].message}</p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Metric label="Artifacts" value={summary.artifacts} tone="green" />
            <Metric label="Saved" value={run.state.savedPlayers} tone="blue" />
            <Metric label="Arc score" value={summary.arcScore} tone={summary.arcScore >= 65 ? 'green' : 'gold'} />
            <Metric label="Feeling" value={summary.arcShape} tone="gold" />
          </div>
          {!run.completed && <ActionPreview preview={preview} />}
          {!run.completed ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {availableGrowthActions(run).map((action) => (
                <button key={action.id} type="button" onMouseEnter={() => setSelectedAction(action.id)} onFocus={() => setSelectedAction(action.id)} onClick={() => act(action.id)} className={`rounded border bg-exp-dark/60 px-3 py-3 text-left font-mono text-xs uppercase tracking-[0.16em] hover:border-compass/50 hover:text-compass-bright ${selectedAction === action.id ? 'border-compass/60 text-compass-bright' : 'border-exp-border text-exp-text'}`}>
                  {action.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded border border-oxide-green/30 bg-oxide-green/5 px-3 py-3">
              <p className="font-mono text-xs leading-relaxed text-exp-text">{shareTextForRun(run)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={copyShare} className="rounded border border-compass/40 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">
                  {copied ? 'Share copied' : 'Generate share card'}
                </button>
                <Link to={replayPathForRun(run)} onClick={() => recordEvent('replay_opened', { scenarioId: run.scenario.id, seed: run.seed })} className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">
                  Replay run
                </Link>
                <Link to={`/play?scenario=${run.scenario.id}&seed=${run.seed}-rival`} className="rounded border border-exp-border bg-exp-dark/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">
                  Try rival seed
                </Link>
              </div>
            </div>
          )}
          {latestMoment && (
            <div className="mt-3 rounded border border-compass/30 bg-compass/5 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">{latestMoment.momentTitle || latestMoment.comebackLabel}</p>
              <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">{latestMoment.bark}</p>
              <p className="mt-1 font-mono text-[11px] text-exp-text-dim">pulse {latestMoment.lifePulse} / agency {latestMoment.agencyScore} / friction {latestMoment.frictionScore}</p>
            </div>
          )}
          {run.timeline.length > 0 && (
            <div className="mt-4 space-y-2">
              {run.timeline.slice(-4).map((event) => (
                <div key={event.turn} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-compass-bright">Turn {event.turn} / {event.feelingLabel}</p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">{event.text}</p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text">{event.bark}</p>
                </div>
              ))}
            </div>
          )}
          <EvidenceCitationsList readiness={bridgeReadiness} />
          <NextFixCommand readiness={bridgeReadiness} />
        </section>
      </div>
      <div className="mt-4"><FunReport run={run} /></div>
      {shareVisible && <div className="mt-4"><ShareCard run={run} /></div>}
      {challenge && (
        <section className="mt-4 rounded border border-exp-border bg-exp-panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Local leaderboard</p>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {leaderboard.slice(0, 6).map((item, index) => {
              const row = summarizeGrowthRun(item);
              return (
                <div key={`${item.id}-${index}`} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
                  <p className="font-mono text-xs text-compass-bright">#{index + 1} {row.challengeScore}</p>
                  <p className="mt-1 font-mono text-[11px] text-exp-text-dim">{row.outcome} / artifacts {row.artifacts} / arc {row.arcScore}</p>
                </div>
              );
            })}
            {leaderboard.length === 0 && <p className="font-mono text-xs text-exp-text-dim">Complete the challenge to create the first local score.</p>}
          </div>
        </section>
      )}
    </GrowthFrame>
  );
}

export function ScenarioGalleryPage() {
  const bridgeReport = useBridgeReport();
  const [filter, setFilter] = useState('all');
  const rows = GROWTH_SCENARIOS.map((scenario) => ({
    ...scenario,
    readiness: readinessForScenario(bridgeReport, scenario.id),
  })).sort((a, b) => (b.readiness?.readinessScore || 0) - (a.readiness?.readinessScore || 0) || a.name.localeCompare(b.name));
  const filteredRows = filter === 'all' ? rows : rows.filter((scenario) => scenario.readiness?.gateVerdict === filter || (!scenario.readiness && filter === 'missing-evidence'));
  return (
    <GrowthFrame title="Expedition Scenarios" eyebrow="Choose a public seedable run">
      <div className="mb-3 flex flex-wrap gap-2">
        {['all', 'featured-ready', 'playable-with-caveats', 'needs-fun-work', 'missing-evidence'].map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] ${filter === item ? 'border-compass/60 bg-compass/10 text-compass-bright' : 'border-exp-border bg-exp-panel text-exp-text-dim'}`}>
            {item === 'all' ? 'All' : publicVerdictLabel(item)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {filteredRows.map((scenario) => (
          <article key={scenario.id} className="rounded border border-exp-border bg-exp-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{scenario.name}</h2>
              <BridgeReadinessBadge readiness={scenario.readiness} />
            </div>
            <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{scenario.hook}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              <ToneBadge tone="gold">{scenario.difficulty}</ToneBadge>
              {scenario.tags.map((tag) => <ToneBadge key={tag}>{tag}</ToneBadge>)}
            </div>
            <NextFixCommand readiness={scenario.readiness} />
            <Link to={scenarioRouteFromBridge(scenario.readiness, `/play?scenario=${scenario.id}`)} className="mt-4 inline-flex rounded border border-compass/40 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">
              Start expedition
            </Link>
            <Link to={`/scenarios/${scenario.id}`} className="ml-2 mt-4 inline-flex rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">
              Details
            </Link>
          </article>
        ))}
      </div>
      <section className="mt-5 rounded border border-exp-border bg-exp-panel p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Discovery Topics</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {DISCOVERY_TOPICS.map((topic) => (
            <Link key={topic.id} to={`/topics/${topic.id}`} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2 hover:border-compass/50">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-exp-text">{topic.name}</p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">{topic.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </GrowthFrame>
  );
}

export function ScenarioDetailPage() {
  const { scenarioId } = useParams();
  const bridgeReport = useBridgeReport();
  const scenario = scenarioForId(scenarioId);
  if (!scenario) {
    return (
      <GrowthFrame title="Scenario Not Found" eyebrow="No public scenario matches that route">
        <Link to="/scenarios" className="font-mono text-compass-bright">Browse scenario gallery</Link>
      </GrowthFrame>
    );
  }
  const readiness = readinessForScenario(bridgeReport, scenario.id);
  const relatedScenarios = relatedScenariosFor(scenario.id);
  const relatedTopics = relatedTopicsForScenario(scenario.id);
  return (
    <GrowthFrame title={scenario.name} eyebrow={scenario.hook || 'Playable scenario'}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded border border-exp-border bg-exp-panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Scenario Brief</p>
              <p className="mt-2 max-w-3xl font-mono text-sm leading-relaxed text-exp-text">{scenario.premise || scenario.description || scenario.hook}</p>
            </div>
            <BridgeReadinessBadge readiness={readiness} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <Metric label="Players" value={scenario.players} tone="blue" />
            <Metric label="Turns" value={scenario.maxTurns || scenario.turns || 'n/a'} tone="gold" />
            <Metric label="Difficulty" value={scenario.difficulty || 'tuned'} tone="neutral" />
            <Metric label="Target Arc" value={scenario.targetArcScore ?? 'n/a'} tone="green" />
          </div>
          <div className="mt-4 flex flex-wrap gap-1">
            {(scenario.tags || []).map((tag) => <ToneBadge key={tag}>{tag}</ToneBadge>)}
          </div>
          {scenario.designQuestion && (
            <div className="mt-4 rounded border border-blueprint/30 bg-blueprint/5 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-blueprint">Design Question</p>
              <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">{scenario.designQuestion}</p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={scenario.playPath} className="rounded border border-compass/40 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">Play scenario</Link>
            <Link to={scenario.challengePath} className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">Challenge seed</Link>
            <Link to="/simulator" className="rounded border border-exp-border bg-exp-dark/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Open simulator</Link>
          </div>
          <EvidenceCitationsList readiness={readiness} />
          <NextFixCommand readiness={readiness} />
        </section>
        <aside className="space-y-3">
          <section className="rounded border border-exp-border bg-exp-panel p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Related Scenarios</p>
            <div className="mt-3 space-y-2">
              {relatedScenarios.map((item) => (
                <Link key={item.id} to={item.canonicalPath} className="block rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2 hover:border-compass/50">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-exp-text">{item.name}</p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">{item.hook}</p>
                </Link>
              ))}
            </div>
          </section>
          <section className="rounded border border-exp-border bg-exp-panel p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Discovery Topics</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {relatedTopics.map((topic) => (
                <Link key={topic.id} to={`/topics/${topic.id}`} className="rounded border border-blueprint/35 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">{topic.name}</Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </GrowthFrame>
  );
}

export function DiscoveryTopicPage() {
  const { topicId } = useParams();
  const topic = topicForId(topicId);
  const scenarios = scenariosForTopic(topicId);
  if (!topic) {
    return (
      <GrowthFrame title="Topic Not Found" eyebrow="No public discovery topic matches that route">
        <Link to="/scenarios" className="font-mono text-compass-bright">Browse scenario gallery</Link>
      </GrowthFrame>
    );
  }
  return (
    <GrowthFrame title={topic.name} eyebrow="Discovery topic">
      <section className="rounded border border-exp-border bg-exp-panel p-4">
        <p className="max-w-3xl font-mono text-sm leading-relaxed text-exp-text">{topic.description}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {topic.tags.map((tag) => <ToneBadge key={tag}>{tag}</ToneBadge>)}
        </div>
      </section>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {scenarios.map((scenario) => (
          <article key={scenario.id} className="rounded border border-exp-border bg-exp-panel p-4">
            <h2 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{scenario.name}</h2>
            <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{scenario.hook || scenario.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {(scenario.tags || []).slice(0, 5).map((tag) => <ToneBadge key={tag}>{tag}</ToneBadge>)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={scenario.canonicalPath} className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">Details</Link>
              <Link to={scenario.playPath} className="rounded border border-compass/40 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">Play</Link>
            </div>
          </article>
        ))}
        {scenarios.length === 0 && (
          <p className="font-mono text-xs text-exp-text-dim">No scenario is mapped to this topic yet.</p>
        )}
      </div>
    </GrowthFrame>
  );
}

export function ReplayPage() {
  const { runId } = useParams();
  const query = useQuery();
  const run = decodeRun(runId);
  const summary = run ? summarizeGrowthRun(run) : null;
  const selectedTurn = Number(query.get('turn') || 0);
  if (!run) {
    return (
      <GrowthFrame title="Replay unavailable" eyebrow="The replay link could not be decoded">
        <Link to="/play" className="font-mono text-compass-bright">Start a fresh run</Link>
      </GrowthFrame>
    );
  }
  return (
    <GrowthFrame title={`Replay: ${run.scenario.name}`} eyebrow={`${summary.outcome} / seed ${run.seed}`}>
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <ShareCard run={run} />
          <FunReport run={run} compact />
        </div>
        <section className="rounded border border-exp-border bg-exp-panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Turn replay</p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">{summary.epilogue}</p>
          <div className="mt-3 space-y-2">
            {run.timeline.map((event) => (
              <div key={event.turn} className={`rounded border px-3 py-2 ${selectedTurn === event.turn ? 'border-compass/60 bg-compass/10' : 'border-exp-border/60 bg-exp-dark/35'}`}>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-compass-bright">Turn {event.turn}: {event.label} / {event.feelingLabel}</p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text">{event.text}</p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">{event.bark}</p>
                <p className="mt-1 font-mono text-[10px] text-exp-text-dim">pulse {event.lifePulse} / agency {event.agencyScore} / friction {event.frictionScore}</p>
                {(event.momentType || event.comebackLabel) && (
                  <button type="button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/replay/${runId}?turn=${event.turn}`)} className="mt-2 rounded border border-blueprint/35 bg-blueprint/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-blueprint">
                    Copy moment link
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </GrowthFrame>
  );
}

export function ProgressPage() {
  const runs = loadJson(RUNS_KEY, []);
  const bridgeReport = useBridgeReport();
  const progress = mergeReadinessIntoProgress(buildPublicProgress({ runs }), bridgeReport);
  return (
    <GrowthFrame title="Scenario Progress" eyebrow="Public growth dashboard">
      <div className="grid gap-3 lg:grid-cols-3">
        {progress.map((item) => (
          <article key={item.scenarioId} className="rounded border border-exp-border bg-exp-panel p-4">
            <h2 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{item.name}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Metric label="Runs" value={item.runs} tone="blue" />
              <Metric label="Complete" value={`${Math.round(item.completionRate * 100)}%`} tone="green" />
              <Metric label="Arc" value={item.latestArcScore ?? 'n/a'} tone="gold" />
              <Metric label="Trend" value={item.trend} tone="blue" />
              <Metric label="Ready" value={item.bridgeReadiness?.readinessScore ?? 'n/a'} tone={readinessTone(item.bridgeReadiness?.gateVerdict)} />
            </div>
            <div className="mt-3"><BridgeReadinessBadge readiness={item.bridgeReadiness} /></div>
            {item.latestRun && <div className="mt-3"><FunReport run={item.latestRun} compact /></div>}
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-exp-text-dim">{item.nextExperiment}</p>
          </article>
        ))}
      </div>
    </GrowthFrame>
  );
}

export function DevlogPage() {
  const bridgeReport = useBridgeReport();
  const entries = [...bridgeDevlogEntries(bridgeReport), ...buildDevlogEntries(buildPublicProgress({ runs: loadJson(RUNS_KEY, []) }))];
  return (
    <GrowthFrame title="Design Devlog" eyebrow="Evidence translated into readable updates">
      <div className="space-y-3">
        {entries.map((entry) => (
          <article key={entry.id} className="rounded border border-exp-border bg-exp-panel p-4">
            <h2 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{entry.title}</h2>
            <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{entry.body}</p>
            <p className="mt-2 font-mono text-[11px] text-compass-bright">Next: {entry.next}</p>
            {entry.command && <code className="mt-2 block overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/60 px-2 py-2 font-mono text-[11px] text-exp-text-dim">{entry.command}</code>}
          </article>
        ))}
      </div>
    </GrowthFrame>
  );
}

export function CreateScenarioPage() {
  const [prompt, setPrompt] = useState('two-player cave escape with one injured explorer');
  const [players, setPlayers] = useState(2);
  const [desiredFeeling, setDesiredFeeling] = useState('alive');
  const [duration, setDuration] = useState(6);
  const preview = buildCreatorScenario({ prompt, players, desiredFeeling, duration });
  function publish() {
    recordEvent('scenario_created', { scenarioId: preview.id, players: preview.players, desiredFeeling });
  }
  return (
    <GrowthFrame title="Create Scenario" eyebrow="Local creator preview">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.8fr)]">
        <section className="rounded border border-exp-border bg-exp-panel p-4">
          <label className="block font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim" htmlFor="scenario-prompt">Scenario prompt</label>
          <textarea id="scenario-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-2 min-h-28 w-full rounded border border-exp-border bg-exp-dark/60 p-3 font-mono text-xs text-exp-text" />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">Players<input value={players} onChange={(event) => setPlayers(event.target.value)} type="number" min="1" max="4" className="mt-1 w-full rounded border border-exp-border bg-exp-dark/60 p-2 text-exp-text" /></label>
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">Turns<input value={duration} onChange={(event) => setDuration(event.target.value)} type="number" min="4" max="10" className="mt-1 w-full rounded border border-exp-border bg-exp-dark/60 p-2 text-exp-text" /></label>
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">Feeling<input value={desiredFeeling} onChange={(event) => setDesiredFeeling(event.target.value)} className="mt-1 w-full rounded border border-exp-border bg-exp-dark/60 p-2 text-exp-text" /></label>
          </div>
        </section>
        <section className="rounded border border-compass/30 bg-compass/5 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">Preview</p>
          <h2 className="mt-2 font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{preview.name}</h2>
          <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{preview.premise}</p>
          <div className="mt-3 flex flex-wrap gap-1">{preview.tags.map((tag) => <ToneBadge key={tag}>{tag}</ToneBadge>)}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={publish} className="rounded border border-compass/40 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">Publish locally</button>
            <Link to={preview.playPath} className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">Test scenario</Link>
          </div>
          <details className="mt-4 rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.22em] text-exp-text-dim">Evidence requirements</summary>
            <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">A created scenario becomes promotable after same-engine runs, feeling evidence, and bridge readiness agree that it is playable.</p>
            <code className="mt-2 block overflow-x-auto rounded border border-exp-border/60 bg-exp-dark/60 px-2 py-2 font-mono text-[11px] text-compass-bright">npm run bridge:scenario -- --id={preview.id}</code>
          </details>
        </section>
      </div>
    </GrowthFrame>
  );
}
