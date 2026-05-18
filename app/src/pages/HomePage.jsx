import { Link } from 'react-router-dom';
import GameBrowser from '../components/game/GameBrowser';
import FirstExpeditionGuide from '../components/game/FirstExpeditionGuide';
import SystemHealth from '../components/shared/SystemHealth';
import SurveyTabletFrame from '../components/layout/SurveyTabletFrame';
import { DISCOVERY_TOPICS, allDiscoverableScenarios } from '../lib/publicRoutes';
import { WEEKLY_CHALLENGE } from '../lib/growthLoop';

const actionLoop = [
  { verb: 'Move', detail: 'Shorten the route and reveal what the board is hiding.', tone: 'blueprint' },
  { verb: 'Dig', detail: 'Pull artifacts out of danger and make the run worth saving.', tone: 'compass' },
  { verb: 'Rest', detail: 'Give the crew enough breath for the next hard choice.', tone: 'oxide' },
  { verb: 'Help', detail: 'Turn a teammate problem into a shared escape chance.', tone: 'oxide' },
  { verb: 'Flee', detail: 'Commit to the exit before pressure closes the path.', tone: 'signal' },
];

const proofMetrics = [
  ['Public routes', '16'],
  ['Scenario pages', '3'],
  ['Discovery topics', '5'],
  ['Same-engine checks', 'On'],
];

const faq = [
  {
    question: 'Can I try it without a wallet?',
    answer: 'Yes. Public scenarios and challenges are available as seedable browser runs before you touch live survey flows.',
  },
  {
    question: 'Where does the on-chain part matter?',
    answer: 'Live surveys use wallet-signed actions and contract-backed state. The public marketing path explains the game first, then routes you into live play when you are ready.',
  },
  {
    question: 'Why is there a simulator?',
    answer: 'The simulator runs scenarios against the same engine so tuning decisions can be checked against real outcomes instead of a separate rules clone.',
  },
];

function toneClasses(tone) {
  return {
    blueprint: 'border-blueprint/35 bg-blueprint/10 text-blueprint',
    compass: 'border-compass/35 bg-compass/10 text-compass-bright',
    oxide: 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green',
    signal: 'border-signal-red/35 bg-signal-red/10 text-signal-red',
  }[tone] || 'border-exp-border bg-exp-dark/35 text-exp-text-dim';
}

function MiniBoard({ compact = false }) {
  const tiles = [
    ['jungle', 'fog', 'landing', 'plains'],
    ['plains', 'crew', 'relic', 'fog'],
    ['fog', 'danger', 'camp', 'mountain'],
  ].flat();
  const colors = {
    jungle: 'bg-jungle/45 border-jungle/70',
    fog: 'bg-exp-dark/80 border-exp-border/80',
    landing: 'bg-landing/45 border-landing/70',
    plains: 'bg-plains/40 border-plains/70',
    crew: 'bg-compass/35 border-compass text-compass-bright',
    relic: 'bg-relic/45 border-relic/80 text-exp-text',
    danger: 'bg-signal-red/25 border-signal-red/70',
    camp: 'bg-oxide-green/35 border-oxide-green/70',
    mountain: 'bg-mountain/40 border-mountain/75',
  };
  return (
    <div className={`grid grid-cols-4 ${compact ? 'gap-1.5' : 'gap-2'} perspective-distant`}>
      {tiles.map((tile, index) => (
        <div
          key={`${tile}-${index}`}
          className={`${colors[tile]} ${compact ? 'h-14' : 'h-20 sm:h-24'} flex items-center justify-center border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
          style={{ clipPath: 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0 50%)' }}
        >
          {tile === 'crew' && <span className="alive-explorer-ready h-4 w-4 rounded-full border border-compass-bright bg-exp-dark" />}
          {tile === 'relic' && <span className="alive-relic-pulse h-3 w-3 rounded-full bg-compass-bright" />}
          {tile === 'danger' && <span className="alive-pressure-urgent h-8 w-8 rounded-full border border-signal-red/80" />}
        </div>
      ))}
    </div>
  );
}

function HeroBoardScene() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,15,10,0.58),rgba(13,15,10,0.98))]" />
      <div className="absolute left-1/2 top-1/2 w-[min(1040px,130vw)] -translate-x-1/2 -translate-y-[43%] rotate-[-7deg] opacity-75">
        <MiniBoard />
      </div>
      <div className="absolute bottom-16 left-[12%] hidden h-px w-1/3 bg-compass/50 shadow-[0_0_24px_rgba(232,200,96,0.4)] sm:block" />
      <div className="absolute right-[13%] top-24 hidden h-24 w-px bg-blueprint/45 shadow-[0_0_28px_rgba(58,124,196,0.5)] sm:block" />
    </div>
  );
}

function SectionHeader({ eyebrow, title, body }) {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-compass">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl uppercase tracking-[0.14em] text-exp-text sm:text-3xl">{title}</h2>
      {body && <p className="mt-3 font-mono text-sm leading-relaxed text-exp-text-dim">{body}</p>}
    </div>
  );
}

function MarketingCard({ children, className = '' }) {
  return (
    <article className={`rounded border border-exp-border bg-exp-panel/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] ${className}`}>
      {children}
    </article>
  );
}

function ScenarioCard({ scenario, featured = false }) {
  return (
    <MarketingCard className={featured ? 'border-compass/35 bg-compass/5' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{scenario.name}</h3>
        <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${toneClasses(featured ? 'compass' : 'blueprint')}`}>
          {featured ? 'Best first run' : scenario.difficulty}
        </span>
      </div>
      <p className="mt-3 font-mono text-xs leading-relaxed text-exp-text-dim">{scenario.hook || scenario.description}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <span className="rounded border border-exp-border/70 bg-exp-dark/45 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text-dim">{scenario.players}P</span>
        <span className="rounded border border-exp-border/70 bg-exp-dark/45 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text-dim">{scenario.maxTurns || scenario.turns} turns</span>
        <span className="rounded border border-exp-border/70 bg-exp-dark/45 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text-dim">{scenario.difficulty || 'tuned'}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={scenario.playPath} className="rounded border border-compass/45 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">Play</Link>
        <Link to={scenario.canonicalPath} className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">Details</Link>
      </div>
    </MarketingCard>
  );
}

function HomeHero({ firstScenario }) {
  return (
    <section className="relative isolate min-h-[min(760px,88svh)] overflow-hidden border-b border-exp-border">
      <HeroBoardScene />
      <div className="relative mx-auto flex min-h-[min(760px,88svh)] max-w-7xl flex-col justify-center px-4 pb-20 pt-20 sm:px-6">
        <div className="max-w-4xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-compass-bright">Turn-based expedition board game</p>
          <h1 className="mt-5 max-w-4xl font-display text-5xl uppercase leading-[0.95] tracking-[0.08em] text-exp-text sm:text-7xl lg:text-8xl">
            Xenovoya
          </h1>
          <p className="mt-6 max-w-2xl font-mono text-base leading-relaxed text-exp-text sm:text-lg">
            A board game where every move, dig, rest, help, and flee should make the expedition feel alive.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={firstScenario.playPath} className="rounded border border-compass/60 bg-compass/15 px-5 py-3 font-display text-sm font-semibold uppercase tracking-[0.18em] text-compass-bright hover:bg-compass/25">
              Play a scenario
            </Link>
            <Link to="/scenarios" className="rounded border border-blueprint/50 bg-blueprint/10 px-5 py-3 font-display text-sm font-semibold uppercase tracking-[0.18em] text-blueprint hover:bg-blueprint/20">
              Browse scenarios
            </Link>
          </div>
          <p className="mt-5 max-w-2xl font-mono text-xs leading-relaxed text-exp-text-dim">
            Public scenarios are playable as seeded browser runs. Live surveys use wallet-signed actions after the game has made sense.
          </p>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-14 border-t border-exp-border/50 bg-exp-dark/55 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-4 overflow-x-auto px-4 sm:px-6">
          {proofMetrics.map(([label, value]) => (
            <div key={label} className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">
              <span className="text-compass-bright">{value}</span> {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const scenarios = allDiscoverableScenarios();
  const firstScenario = scenarios.find((scenario) => scenario.id === 'solo-artifact-hunt') || scenarios[0];
  const featured = [firstScenario, ...scenarios.filter((scenario) => scenario.id !== firstScenario.id)].slice(0, 3);
  const topics = DISCOVERY_TOPICS.slice(0, 5);

  return (
    <div>
      <HomeHero firstScenario={firstScenario} />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(320px,0.72fr)]">
          <div>
            <SectionHeader
              eyebrow="What you do"
              title="One turn should already feel alive"
              body="The fun is not only the outcome. It is the physical decision to commit, wait, recover, risk, and watch the board answer."
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-5">
              {actionLoop.map((action) => (
                <div key={action.verb} className={`rounded border px-3 py-3 ${toneClasses(action.tone)}`}>
                  <p className="font-display text-lg uppercase tracking-[0.12em]">{action.verb}</p>
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">{action.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <MarketingCard>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">One turn proof</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-blueprint">Before input</p>
                <MiniBoard compact />
              </div>
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-compass">After dig</p>
                <MiniBoard compact />
              </div>
            </div>
            <p className="mt-4 font-mono text-xs leading-relaxed text-exp-text">
              A good turn changes pressure, information, route memory, or recovery. Standing still is also a readable state.
            </p>
          </MarketingCard>
        </div>
      </section>

      <section className="border-y border-exp-border bg-exp-surface/55">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader
              eyebrow="Start here"
              title="Featured playable scenarios"
              body="Each scenario has a stable route, a public play link, and metadata generated from the same scenario model."
            />
            <Link to="/challenge" className="rounded border border-compass/45 bg-compass/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">
              {WEEKLY_CHALLENGE.title}
            </Link>
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {featured.map((scenario, index) => (
              <ScenarioCard key={scenario.id} scenario={scenario} featured={index === 0} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(320px,0.8fr)]">
          <div>
            <SectionHeader
              eyebrow="Why it is different"
              title="Designed around living board feedback"
              body="The game is tuned around agency, friction, payoff, recovery, pressure, and share-worthy moments instead of only win/loss."
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ['Input feel', 'Controls and actions are judged by whether the controlled expedition feels responsive, even at rest.'],
                ['Outcome learning', 'Scenario runs produce reports that point at flat turns, pressure spikes, and next experiments.'],
                ['Readable space', 'The interface keeps the board and current action readable instead of filling every corner.'],
                ['Shareable runs', 'Completed runs can become replayable stories with seeds, moments, and outcomes.'],
              ].map(([title, detail]) => (
                <MarketingCard key={title}>
                  <h3 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{title}</h3>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{detail}</p>
                </MarketingCard>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <MarketingCard className="border-oxide-green/35 bg-oxide-green/5">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-oxide-green">Same-engine simulator</p>
              <h3 className="mt-2 font-display text-2xl uppercase tracking-[0.14em] text-exp-text">Tune outcomes with the real engine</h3>
              <p className="mt-3 font-mono text-xs leading-relaxed text-exp-text-dim">
                The simulator path is built for scenario design, balance checks, and evidence-backed changes without a parallel frontend rules clone.
              </p>
              <Link to="/simulator" className="mt-4 inline-flex rounded border border-oxide-green/45 bg-oxide-green/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-oxide-green">Open simulator</Link>
            </MarketingCard>
            <MarketingCard>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Evidence feed</p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">
                Devlog and progress pages translate scenario evidence into public updates.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/devlog" className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">Devlog</Link>
                <Link to="/progress" className="rounded border border-exp-border bg-exp-dark/55 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">Progress</Link>
              </div>
            </MarketingCard>
          </div>
        </div>
      </section>

      <section className="border-y border-exp-border bg-exp-surface/45">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <SectionHeader
            eyebrow="Discovery"
            title="Find a run by feeling"
            body="Topics group scenarios by what a player is looking for: survival pressure, artifact payoff, co-op escape, or same-engine tuning."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {topics.map((topic) => (
              <Link key={topic.id} to={`/topics/${topic.id}`} className="rounded border border-exp-border bg-exp-panel/80 p-4 hover:border-compass/45">
                <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-exp-text">{topic.name}</h3>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">{topic.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(300px,0.6fr)]">
          <div>
            <SectionHeader
              eyebrow="Live game access"
              title="Ready for live surveys when you are"
              body="The public path explains the game first. This cockpit remains available for live wallet-backed sessions, registry status, and active games."
            />
            <div className="mt-6">
              <SurveyTabletFrame
                title="Xenovoya"
                subtitle="Live survey access after public scenario play"
                status="SURVEY READY"
              >
                <div className="space-y-6">
                  <FirstExpeditionGuide />
                  <SystemHealth />
                  <GameBrowser />
                </div>
              </SurveyTabletFrame>
            </div>
          </div>
          <div className="space-y-3">
            <MarketingCard className="border-compass/35 bg-compass/5">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">Playable now</p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">
                Best first run: {firstScenario.name}. It is short, seedable, and focused on artifact payoff before escape pressure takes over.
              </p>
              <Link to={firstScenario.playPath} className="mt-4 inline-flex rounded border border-compass/45 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">Start best run</Link>
            </MarketingCard>
            {faq.map((item) => (
              <details key={item.question} className="rounded border border-exp-border bg-exp-panel/80 p-4">
                <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.16em] text-exp-text">{item.question}</summary>
                <p className="mt-3 font-mono text-xs leading-relaxed text-exp-text-dim">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
