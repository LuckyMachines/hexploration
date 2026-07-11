import GameBrowser from '../components/game/GameBrowser';
import FirstExpeditionGuide from '../components/game/FirstExpeditionGuide';
import ReturnLoopPanel from '../components/expedition/ReturnLoopPanel';
import SystemHealth from '../components/shared/SystemHealth';
import SurveyTabletFrame from '../components/layout/SurveyTabletFrame';
import { useWallet } from '../contexts/WalletContext';
import { LIVE_PLAY_URL } from '../lib/internalTools';

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
    title: 'Commit',
    detail: 'Submit the choice that best protects the crew and the route.',
  },
  {
    label: '4',
    title: 'Depart',
    detail: 'Leave with the discovery before pressure turns into loss.',
  },
];

const faq = [
  {
    question: 'Can I try it without a wallet?',
    answer: 'You can learn the expedition rhythm on this site. Actual expeditions start in the live client.',
  },
  {
    question: 'Where does the on-chain part matter?',
    answer: 'Live expeditions record submitted actions, discoveries, turn resolution, and outcomes on-chain so the board state can be verified.',
  },
  {
    question: 'What should I do first?',
    answer: 'Open the live client, join or launch a survey, reveal the board, and decide when the next discovery is worth the extra danger.',
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

function FirstTurnStrip() {
  return (
    <section id="first-turn" className="border-b border-exp-border bg-exp-surface/55">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(320px,0.78fr)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-compass">First turn</p>
          <h2 className="mt-2 font-display text-2xl uppercase tracking-[0.14em] text-exp-text">You can understand the run after one choice</h2>
          <p className="mt-3 font-mono text-sm leading-relaxed text-exp-text-dim">
            The live client should make the first decision readable: reveal a tile, read what changed, commit as a crew, and leave before the route turns against you.
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
  return to ? <a href={to}>{content}</a> : content;
}

function HomeHero() {
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
            <a href={LIVE_PLAY_URL} className="rounded border border-compass/60 bg-compass/15 px-5 py-3 font-display text-sm font-semibold uppercase tracking-[0.18em] text-compass-bright hover:bg-compass/25">
              Launch live client
            </a>
            <a href="#first-turn" className="rounded border border-blueprint/50 bg-blueprint/10 px-5 py-3 font-display text-sm font-semibold uppercase tracking-[0.18em] text-blueprint hover:bg-blueprint/20">
              See first turn
            </a>
          </div>
          <p className="mt-5 max-w-2xl font-mono text-xs leading-relaxed text-exp-text-dim">
            The public promise is simple: learn the loop here, then play in the live client.
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

  return (
    <div>
      <HomeHero />
      <FirstTurnStrip />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <ReturnLoopPanel />
      </section>

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
          <SectionHeader
            eyebrow="Start here"
            title="Your first expedition belongs in the live client"
            body="The site explains the decision rhythm; the live client is where you launch, join, and resolve an expedition."
          />
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {[
              ['Launch live', 'Start from the expedition client.'],
              ['Read the board', 'Use the shared map, route home, hazards, and crew state to decide the turn.'],
              ['Escape together', 'Treat each discovery as valuable only if the crew can still depart.'],
            ].map(([title, detail]) => (
              <MarketingCard key={title}>
                <h3 className="font-mono text-sm uppercase tracking-[0.16em] text-exp-text">{title}</h3>
                <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{detail}</p>
              </MarketingCard>
            ))}
          </div>
          <a href={LIVE_PLAY_URL} className="mt-6 inline-flex rounded border border-compass/45 bg-compass/10 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">Open live client</a>
        </div>
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
                ['Persistent expeditions', 'Resolved expeditions leave a record the crew can inspect.'],
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
            />
            <ImageFeature
              image={siteImages.onchain}
              eyebrow="Verification"
              title="State you can inspect"
              body="The game is not a themed dashboard around hidden server logic. The resolved board is the record."
            />
          </div>
        </div>
      </section>

      <section id="live-expedition" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(300px,0.6fr)]">
          <div>
            <SectionHeader
              eyebrow="Live expedition access"
              title={isConnected ? 'Take the shared survey on-chain' : 'Launch the real expedition client'}
              body={isConnected
                ? 'Live expeditions turn the same rhythm into wallet-signed actions, shared discoveries, and outcomes the crew can inspect.'
                : 'The live client is the playable surface. This page explains the loop and sends players to the actual expedition path.'}
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
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">Live client</p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">
                Launch, join, and resolve expeditions from the actual play surface. The public site should send players there directly.
              </p>
              <a href={LIVE_PLAY_URL} className="mt-4 inline-flex rounded border border-compass/45 bg-compass/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">Open live client</a>
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
