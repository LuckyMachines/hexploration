import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  applyGrowthAction,
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
  return (
    <div className="rounded border border-exp-border bg-exp-panel p-4">
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
    </div>
  );
}

function ShareCard({ run }) {
  const summary = summarizeGrowthRun(run);
  return (
    <div className="rounded border border-compass/30 bg-compass/5 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">Share card</p>
      <h2 className="mt-2 font-display text-xl uppercase tracking-[0.12em] text-exp-text">{summary.scenarioName}</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Metric label="Outcome" value={summary.outcome} tone={summary.outcome === 'escaped' ? 'green' : 'gold'} />
        <Metric label="Artifacts" value={summary.artifacts} tone="green" />
        <Metric label="Arc" value={`${summary.arcShape} ${summary.arcScore}`} tone={summary.arcScore >= 65 ? 'green' : 'gold'} />
        <Metric label="Seed" value={summary.seed} tone="blue" />
      </div>
      <p className="mt-3 font-mono text-xs leading-relaxed text-exp-text">{shareTextForRun(run)}</p>
    </div>
  );
}

export function GrowthPlayPage({ challenge = false }) {
  const query = useQuery();
  const scenarioId = challenge ? WEEKLY_CHALLENGE.scenarioId : query.get('scenario') || 'solo-artifact-hunt';
  const seed = challenge ? WEEKLY_CHALLENGE.seed : query.get('seed') || null;
  const [run, setRun] = useState(() => {
    const created = createGrowthRun({ scenarioId, seed });
    recordEvent('run_started', { scenarioId: created.scenario.id, seed: created.seed, challenge });
    return created;
  });
  const [shareVisible, setShareVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const runs = loadJson(RUNS_KEY, []);
  const leaderboard = rankChallengeRuns(runs);
  const summary = summarizeGrowthRun(run);

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
    <GrowthFrame title={challenge ? WEEKLY_CHALLENGE.title : run.scenario.name} eyebrow={challenge ? WEEKLY_CHALLENGE.tagline : run.scenario.hook}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <BoardState run={run} />
        <section className="rounded border border-exp-border bg-exp-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Public run</p>
              <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text">{run.scenario.premise}</p>
            </div>
            <ToneBadge tone={run.completed ? 'green' : 'blue'}>{run.completed ? summary.outcome : `Turn ${run.turn + 1}/${run.scenario.maxTurns}`}</ToneBadge>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Metric label="Artifacts" value={run.state.artifacts} tone="green" />
            <Metric label="Saved" value={run.state.savedPlayers} tone="blue" />
            <Metric label="Arc score" value={summary.arcScore} tone={summary.arcScore >= 65 ? 'green' : 'gold'} />
            <Metric label="Feeling" value={summary.arcShape} tone="gold" />
          </div>
          {!run.completed ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {availableGrowthActions(run).map((action) => (
                <button key={action.id} type="button" onClick={() => act(action.id)} className="rounded border border-exp-border bg-exp-dark/60 px-3 py-3 text-left font-mono text-xs uppercase tracking-[0.16em] text-exp-text hover:border-compass/50 hover:text-compass-bright">
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
          {run.timeline.length > 0 && (
            <div className="mt-4 space-y-2">
              {run.timeline.slice(-4).map((event) => (
                <div key={event.turn} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-compass-bright">Turn {event.turn} / {event.feelingLabel}</p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text-dim">{event.text}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
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
  return (
    <GrowthFrame title="Scenario Gallery" eyebrow="Choose a public seedable run">
      <div className="grid gap-3 lg:grid-cols-3">
        {GROWTH_SCENARIOS.map((scenario) => (
          <article key={scenario.id} className="rounded border border-exp-border bg-exp-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{scenario.name}</h2>
              <ToneBadge tone="gold">{scenario.difficulty}</ToneBadge>
            </div>
            <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{scenario.hook}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {scenario.tags.map((tag) => <ToneBadge key={tag}>{tag}</ToneBadge>)}
            </div>
            <Link to={`/play?scenario=${scenario.id}`} className="mt-4 inline-flex rounded border border-compass/40 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">
              Play scenario
            </Link>
          </article>
        ))}
      </div>
    </GrowthFrame>
  );
}

export function ReplayPage() {
  const { runId } = useParams();
  const run = decodeRun(runId);
  const summary = run ? summarizeGrowthRun(run) : null;
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
        <ShareCard run={run} />
        <section className="rounded border border-exp-border bg-exp-panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Turn replay</p>
          <div className="mt-3 space-y-2">
            {run.timeline.map((event) => (
              <div key={event.turn} className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-compass-bright">Turn {event.turn}: {event.label} / {event.feelingLabel}</p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-exp-text">{event.text}</p>
                <p className="mt-1 font-mono text-[10px] text-exp-text-dim">pulse {event.lifePulse} / agency {event.agencyScore} / friction {event.frictionScore}</p>
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
  const progress = buildPublicProgress({ runs });
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
            </div>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-exp-text-dim">{item.nextExperiment}</p>
          </article>
        ))}
      </div>
    </GrowthFrame>
  );
}

export function DevlogPage() {
  const entries = buildDevlogEntries(buildPublicProgress({ runs: loadJson(RUNS_KEY, []) }));
  return (
    <GrowthFrame title="Design Devlog" eyebrow="Evidence translated into readable updates">
      <div className="space-y-3">
        {entries.map((entry) => (
          <article key={entry.id} className="rounded border border-exp-border bg-exp-panel p-4">
            <h2 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{entry.title}</h2>
            <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{entry.body}</p>
            <p className="mt-2 font-mono text-[11px] text-compass-bright">Next: {entry.next}</p>
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
        </section>
      </div>
    </GrowthFrame>
  );
}
