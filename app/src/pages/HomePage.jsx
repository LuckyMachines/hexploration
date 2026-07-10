import { Link } from 'react-router-dom';
import GameBrowser from '../components/game/GameBrowser';
import FirstExpeditionGuide from '../components/game/FirstExpeditionGuide';
import SystemHealth from '../components/shared/SystemHealth';
import SurveyTabletFrame from '../components/layout/SurveyTabletFrame';
import ExpeditionMemoryPanel from '../components/memory/ExpeditionMemoryPanel';
import { useWallet } from '../contexts/WalletContext';
import { DISCOVERY_TOPICS, allDiscoverableScenarios } from '../lib/publicRoutes';
import { WEEKLY_CHALLENGE } from '../lib/growthLoop';

const actionLoop = [
  { verb: 'Launch', detail: 'Assemble the expedition, seed the sector, and enter a map nobody has read yet.', tone: 'blueprint' },
  { verb: 'Survey', detail: 'Lift fog across a shared hex grid where every discovery updates the team map.', tone: 'compass' },
  { verb: 'Coordinate', detail: 'Read relics, hazards, routes, and crew pressure before the turn locks.', tone: 'oxide' },
  { verb: 'Verify', detail: 'Watch submitted intent resolve into contract-backed board state.', tone: 'blueprint' },
  { verb: 'Escape', detail: 'Race back to extraction before the expedition outstays its route home.', tone: 'signal' },
];

const proofMetrics = [
  ['Crew', 'Together'],
  ['Map', 'Shared'],
  ['Exit', 'Closing'],
  ['Run', 'Remembered'],
];

const firstTurnSteps = [
  {
    label: '1',
    title: 'Reveal',
    detail: 'Step into fog and add one new piece to the shared map.',
  },
  {
    label: '2',
    title: 'Read',
    detail: 'Compare the new route, hazard, relic, and distance home.',
  },
  {
    label: '3',
    title: 'Fingerprint',
    detail: 'The opening earns a name and a benchmark you can replay against.',
  },
  {
    label: '4',
    title: 'Choose',
    detail: 'Push for one more discovery or start protecting the exit.',
  },
];

const faq = [
  {
    question: 'Can I try it without a wallet?',
    answer: 'Yes. Public scenarios teach the expedition rhythm in the browser before you enter wallet-backed live expeditions.',
  },
  {
    question: 'Where does the on-chain part matter?',
    answer: 'Live expeditions record submitted actions, discoveries, turn resolution, and outcomes on-chain so the board state can be verified.',
  },
  {
    question: 'What should I do first?',
    answer: 'Start a short expedition, reveal a few tiles, then decide whether the next discovery is worth the extra danger.',
  },
];

const siteImages = {
  hero: '/images/site-refresh/option-tablet-hero.png',
  gameplay: '/images/site-refresh/option-gameplay-capture.png',
  board: '/images/site-refresh/option-social-board.png',
  cooperative: '/images/site-refresh/feature-cooperative.webp',
  onchain: '/images/site-refresh/feature-onchain.webp',
};

const expeditionScenes = [
  {
    id: 'tablet',
    label: 'Chart',
    title: 'Read the sector',
    image: siteImages.hero,
    detail: 'The first choice is where to push through fog and what route still leaves a way home.',
  },
  {
    id: 'capture',
    label: 'Decide',
    title: 'Commit the turn',
    image: siteImages.gameplay,
    detail: 'Crew intent, relic payoff, hazard risk, and extraction pressure resolve into one shared board state.',
  },
  {
    id: 'board',
    label: 'Depart',
    title: 'Bring the story back',
    image: siteImages.board,
    detail: 'A completed expedition leaves behind a record of the route, the danger, and what the crew saved.',
  },
];

const scenarioFeelings = {
  'solo-artifact-hunt': {
    label: 'Best first expedition',
    feeling: 'Fast relic pressure',
    promise: 'Learn the whole loop in a short run: reveal, grab value, and decide when the route home matters more than one more dig.',
  },
  'escape-pressure-4p': {
    label: 'Crew escape',
    feeling: 'Shared panic, shared rescue',
    promise: 'Protect the artifact holder while the rest of the crew buys enough time to leave together.',
  },
  'low-stat-recovery': {
    label: 'Recovery run',
    feeling: 'Fragile comeback',
    promise: 'Start weak, stabilize the crew, then choose whether the recovered route can carry one more reveal.',
  },
};

function toneClasses(tone) {
  return {
    blueprint: 'border-blueprint/35 bg-blueprint/10 text-blueprint',
    compass: 'border-compass/35 bg-compass/10 text-compass-bright',
    oxide: 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green',
    signal: 'border-signal-red/35 bg-signal-red/10 text-signal-red',
  }[tone] || 'border-exp-border bg-exp-dark/35 text-exp-text-dim';
}

function HeroBoardScene() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <img src={siteImages.hero} alt="" className="h-full w-full object-cover opacity-85" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,15,10,0.94),rgba(13,15,10,0.72)_42%,rgba(13,15,10,0.24)_78%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,15,10,0.12),rgba(13,15,10,0.98))]" />
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

function scenarioFeelingFor(scenario = {}) {
  return scenarioFeelings[scenario.id] || {
    label: scenario.difficulty || 'Expedition',
    feeling: scenario.hook || scenario.name,
    promise: scenario.premise || scenario.description || 'Choose a route, read the pressure, and decide when to depart.',
  };
}

function ScenarioCard({ scenario, featured = false }) {
  const feeling = scenarioFeelingFor(scenario);
  return (
    <MarketingCard className={featured ? 'border-compass/35 bg-compass/5' : ''}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{scenario.name}</h3>
        <span className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${toneClasses(featured ? 'compass' : 'blueprint')}`}>
          {featured ? feeling.label : scenario.difficulty}
        </span>
      </div>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-compass-bright">{feeling.feeling}</p>
      <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{featured ? feeling.promise : scenario.hook || scenario.description}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <span className="rounded border border-exp-border/70 bg-exp-dark/45 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text-dim">{scenario.players}P</span>
        <span className="rounded border border-exp-border/70 bg-exp-dark/45 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text-dim">{scenario.maxTurns || scenario.turns} turns</span>
        <span className="rounded border border-exp-border/70 bg-exp-dark/45 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text-dim">{scenario.difficulty || 'tuned'}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={scenario.playPath} className="rounded border border-compass/45 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">
          {featured ? 'Start first expedition' : 'Play'}
        </Link>
        <Link to={scenario.canonicalPath} className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">Details</Link>
      </div>
    </MarketingCard>
  );
}

function FirstTurnStrip({ firstScenario }) {
  return (
    <section id="first-turn" className="border-b border-exp-border bg-exp-surface/55">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(320px,0.78fr)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-compass">First turn</p>
          <h2 className="mt-2 font-display text-2xl uppercase tracking-[0.14em] text-exp-text">You can understand the run after one choice</h2>
          <p className="mt-3 font-mono text-sm leading-relaxed text-exp-text-dim">
            Start with {firstScenario.name}. No wallet is needed for the first expedition; the first reveal gives the run a fingerprint, then the browser run teaches when to chart quickly and when to depart.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {firstTurnSteps.map((step) => (
            <article key={step.title} className="rounded border border-exp-border bg-exp-panel/80 p-4">
              <div className="grid h-8 w-8 place-items-center rounded border border-compass/45 bg-compass/10 font-mono text-xs text-compass-bright">{step.label}</div>
              <h3 className="mt-3 font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{step.title}</h3>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">{step.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ImageFeature({ image, eyebrow, title, body, to = null, cta = null }) {
  const content = (
    <article className="group overflow-hidden rounded border border-exp-border bg-exp-panel/80 hover:border-compass/45">
      <div className="aspect-[16/10] overflow-hidden bg-exp-dark">
        <img src={image} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]" />
      </div>
      <div className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">{eyebrow}</p>
        <h3 className="mt-2 font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{title}</h3>
        <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{body}</p>
        {cta && <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">{cta}</p>}
      </div>
    </article>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function HomeHero({ firstScenario }) {
  return (
    <section className="relative isolate min-h-[min(760px,88svh)] overflow-hidden border-b border-exp-border">
      <HeroBoardScene />
      <div className="relative mx-auto flex min-h-[min(760px,88svh)] max-w-7xl flex-col justify-center px-4 pb-20 pt-20 sm:px-6">
        <div className="max-w-4xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-compass-bright">Voyage. Explore. Escape.</p>
          <h1 className="mt-5 max-w-4xl font-display text-5xl uppercase leading-[0.95] tracking-[0.08em] text-exp-text sm:text-7xl lg:text-8xl">
            Xenovoya
          </h1>
          <p className="mt-6 max-w-2xl font-mono text-base leading-relaxed text-exp-text sm:text-lg">
            Cooperative on-chain hex exploration. Build an expedition, share discoveries across an alien grid, and escape together before the route closes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={firstScenario.playPath} className="rounded border border-compass/60 bg-compass/15 px-5 py-3 font-display text-sm font-semibold uppercase tracking-[0.18em] text-compass-bright hover:bg-compass/25">
              Start first expedition
            </Link>
            <a href="#first-turn" className="rounded border border-blueprint/50 bg-blueprint/10 px-5 py-3 font-display text-sm font-semibold uppercase tracking-[0.18em] text-blueprint hover:bg-blueprint/20">
              See first turn
            </a>
            <Link to="/scenarios" className="rounded border border-exp-border bg-exp-dark/45 px-5 py-3 font-display text-sm font-semibold uppercase tracking-[0.18em] text-exp-text-dim hover:border-compass/40 hover:text-exp-text">
              Browse runs
            </Link>
          </div>
          <p className="mt-5 max-w-2xl font-mono text-xs leading-relaxed text-exp-text-dim">
            The first expedition runs in your browser. Live wallet expeditions come after you know when to keep charting and when to get out.
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
  const { isConnected } = useWallet();
  const scenarios = allDiscoverableScenarios();
  const firstScenario = scenarios.find((scenario) => scenario.id === 'solo-artifact-hunt') || scenarios[0];
  const featured = [firstScenario, ...scenarios.filter((scenario) => scenario.id !== firstScenario.id)].slice(0, 3);
  const topics = DISCOVERY_TOPICS
    .filter((topic) => topic.id !== 'same-engine-simulator')
    .slice(0, 4);

  return (
    <div>
      <HomeHero firstScenario={firstScenario} />
      <FirstTurnStrip firstScenario={firstScenario} />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(320px,0.72fr)]">
          <div>
            <SectionHeader
              eyebrow="Expedition loop"
              title="One shared map, one permanent outcome"
              body="Launch into fog, survey the grid, coordinate around relics and hazards, verify the turn, and escape before exploration becomes the reason the crew fails."
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
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">Expedition view</p>
            <div className="mt-4 overflow-hidden rounded border border-exp-border bg-exp-dark">
              <img src={siteImages.gameplay} alt="" className="aspect-[16/10] w-full object-cover" />
            </div>
            <p className="mt-4 font-mono text-xs leading-relaxed text-exp-text">
              One glance shows the route, relic, hazard, extraction point, and the pressure building around the crew.
            </p>
          </MarketingCard>
        </div>
      </section>

      <section className="border-y border-exp-border bg-exp-surface/45">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <SectionHeader
            eyebrow="Chart and depart"
            title="Every run becomes a readable expedition"
            body="The board should tell the story quickly: where the crew entered, what they found, what threatened them, and whether they left in time."
          />
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {expeditionScenes.map((option) => (
              <article key={option.id} className="overflow-hidden rounded border border-exp-border bg-exp-panel/80">
                <div className="aspect-[16/10] overflow-hidden bg-exp-dark">
                  <img src={option.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">{option.label}</p>
                  <h3 className="mt-2 font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{option.title}</h3>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{option.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-exp-border bg-exp-surface/55">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeader
              eyebrow="Start here"
              title={`Your first expedition is ${firstScenario.name}`}
              body="This is the intended first step: a short no-wallet run where the opening earns a fingerprint, the pressure rises fast, and the outcome becomes a memory you can beat."
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
        <ExpeditionMemoryPanel />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.75fr)_minmax(320px,0.8fr)]">
          <div>
            <SectionHeader
              eyebrow="Why it is different"
              title="Built around shared discoveries"
              body="The tension is not just whether you win. It is whether the crew can read the same map, judge the same risk, and leave before the record turns into a warning."
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ['Co-op first', 'One expedition, shared fog-of-war, shared discoveries, and shared consequences.'],
                ['Hex-grid voyages', 'Every tile is a decision. Every reveal changes the route and the risk.'],
                ['On-chain state', 'Submitted actions and resolved outcomes become verifiable board state.'],
                ['Persistent expeditions', 'Early fingerprints become memories, relic cards, and benchmarks to beat.'],
              ].map(([title, detail]) => (
                <MarketingCard key={title}>
                  <h3 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{title}</h3>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{detail}</p>
                </MarketingCard>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <ImageFeature
              image={siteImages.cooperative}
              eyebrow="Cooperative"
              title="Shared consequences"
              body="Teams coordinate around the same fog, route, and pressure instead of solving private boards."
              to="/topics/co-op-escape"
              cta="Explore co-op routes"
            />
            <ImageFeature
              image={siteImages.onchain}
              eyebrow="Verification"
              title="State you can inspect"
              body="The game is not a themed dashboard around hidden server logic. The resolved board is the record."
              to="/progress"
              cta="Open progress"
            />
          </div>
        </div>
      </section>

      <section className="border-y border-exp-border bg-exp-surface/45">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <SectionHeader
            eyebrow="Discovery"
            title="Find a run by feeling"
            body="Choose by the pressure you want to feel: survival, artifact payoff, co-op extraction, or a clean first voyage."
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

      <section id="live-expedition" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(300px,0.6fr)]">
          <div>
            <SectionHeader
              eyebrow={isConnected ? 'Live expedition access' : 'After the first run'}
              title={isConnected ? 'Take the shared survey on-chain' : 'Go live once the loop clicks'}
              body={isConnected
                ? 'Live expeditions turn the same rhythm into wallet-signed actions, shared discoveries, and outcomes the crew can inspect.'
                : 'Public expeditions teach the rhythm first. When you are ready, live expeditions turn crew actions and outcomes into inspectable records.'}
            />
            <div className="mt-6">
              <SurveyTabletFrame
                title="Xenovoya"
                subtitle="Chart, decide, extract, and record the run"
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
                Best first run: {firstScenario.name}. No wallet needed. Learn when to keep charting, when to protect the exit, and what kind of run you want to beat next.
              </p>
              <Link to={firstScenario.playPath} className="mt-4 inline-flex rounded border border-compass/45 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">Start first expedition</Link>
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
