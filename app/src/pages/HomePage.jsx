import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SurveyTabletFrame from '../components/layout/SurveyTabletFrame';
import { useWallet } from '../contexts/WalletContext';

const LiveClientStack = lazy(() => import('../components/game/LiveClientStack'));
const ReturnLoopPanel = lazy(() => import('../components/expedition/ReturnLoopPanel'));

const actionLoop = [
  { verb: 'Launch', detail: 'Assemble a crew and enter a sector nobody has mapped.', tone: 'blueprint' },
  { verb: 'Survey', detail: 'Lift shared fog and turn each discovery into a new decision.', tone: 'compass' },
  { verb: 'Coordinate', detail: 'Balance relics, hazards, routes, and crew pressure together.', tone: 'oxide' },
  { verb: 'Depart', detail: 'Get home before one more discovery becomes the cost of the run.', tone: 'signal' },
];

const proofMetrics = [
  ['Crew', 'Together'],
  ['Map', 'Shared'],
  ['Network', 'Sepolia'],
  ['Status', 'Open alpha'],
];

const firstTurnSteps = [
  { label: '1', title: 'Reveal', detail: 'Step into fog and add one new fact to the shared map.' },
  { label: '2', title: 'Read', detail: 'See the route, reward, danger, and distance home.' },
  { label: '3', title: 'Commit', detail: 'Lock the choice that best protects the crew.' },
  { label: '4', title: 'Depart', detail: 'Leave with the discovery before pressure becomes loss.' },
];

const faq = [
  {
    question: 'Can I explore before connecting?',
    answer: 'Yes. Enter the wallet-free 3D expedition or observe a live board. A wallet is requested only when you choose to join a crew or submit a shared action.',
  },
  {
    question: 'What does the wallet do?',
    answer: 'The live alpha uses wallet signatures to create or join a crew and submit actions to the shared Sepolia testnet expedition.',
  },
  {
    question: 'What should I do first?',
    answer: 'Connect, enter an open expedition or create one, then reveal useful ground while preserving a route back to extraction.',
  },
];

const HERO_IMAGE = '/images/site-refresh/hero-bg.webp';

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
      <img src={HERO_IMAGE} alt="" width="2400" height="1000" fetchPriority="high" className="h-full w-full object-cover opacity-95" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,15,10,0.92),rgba(13,15,10,0.58)_48%,rgba(13,15,10,0.12)_84%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_32%_44%,rgba(76,145,219,0.14),transparent_36%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,15,10,0.04),rgba(13,15,10,0.9))]" />
    </div>
  );
}

function SectionHeader({ eyebrow, title, body }) {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-compass">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text sm:text-4xl">{title}</h2>
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

function LiveClientLoading() {
  return (
    <div className="grid min-h-[24rem] place-items-center rounded border border-exp-border bg-[radial-gradient(circle_at_50%_42%,rgba(76,145,219,0.12),transparent_38%),linear-gradient(180deg,rgba(26,32,22,0.9),rgba(13,15,10,0.72))] px-6 py-10 text-center" role="status">
      <div className="max-w-lg">
        <div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full border border-compass/45 bg-exp-dark/70 shadow-[0_0_32px_rgba(76,145,219,0.12)]" aria-hidden="true">
          <div className="expedition-loading-orbit absolute inset-2 rounded-full border border-dashed border-blueprint/55" />
          <div className="h-7 w-7 rotate-45 border border-compass bg-compass/10" />
          <span className="absolute h-2 w-2 rounded-full bg-compass-bright shadow-[0_0_12px_rgba(232,200,96,0.65)]" />
        </div>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-compass">Live instruments</p>
        <h3 className="mt-2 font-display text-2xl uppercase tracking-[0.12em] text-exp-text">Opening the crew channel</h3>
        <p className="mx-auto mt-3 max-w-md font-mono text-sm leading-relaxed text-exp-text-dim">
          Loading network health, open surveys, and the controls for your first live decision.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim" aria-hidden="true">
          {['Network', 'Wallet', 'Lobby'].map((label) => (
            <span key={label} className="rounded-full border border-exp-border bg-exp-dark/55 px-3 py-2">{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReturnLoopLoading() {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]" role="status">
      <article className="min-h-56 rounded border border-compass/25 bg-[linear-gradient(135deg,rgba(196,166,74,0.08),rgba(26,32,22,0.82))] p-5">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-compass">Expedition memory</p>
        <h3 className="mt-3 font-display text-2xl uppercase tracking-[0.1em] text-exp-text">Restoring your latest signal</h3>
        <p className="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-exp-text-dim">
          Checking this device for your crew role, unresolved clue, and next best decision.
        </p>
        <div className="mt-7 flex items-center gap-3" aria-hidden="true">
          {[0, 1, 2].map((step) => (
            <span key={step} className="h-2.5 w-2.5 rounded-full border border-compass/55 bg-compass/15" />
          ))}
          <span className="h-px flex-1 bg-gradient-to-r from-compass/45 to-transparent" />
        </div>
      </article>
      <article className="min-h-56 rounded border border-blueprint/25 bg-blueprint/5 p-5">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-blueprint">What returns</p>
        <ul className="mt-4 space-y-3 font-mono text-sm leading-relaxed text-exp-text-dim">
          <li>Role and crew thread</li>
          <li>Last consequence</li>
          <li>The clue that still needs you</li>
        </ul>
      </article>
    </div>
  );
}

function DeferredLiveClientStack({ forceReady }) {
  const [isReady, setIsReady] = useState(false);
  const loadingRef = useRef(null);

  useEffect(() => {
    if (forceReady) {
      setIsReady(true);
      return undefined;
    }

    const target = loadingRef.current;
    if (!target || !('IntersectionObserver' in window)) {
      setIsReady(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setIsReady(true);
      observer.disconnect();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [forceReady]);

  return (
    <div ref={loadingRef}>
      {isReady ? (
        <Suspense fallback={<LiveClientLoading />}>
          <LiveClientStack />
        </Suspense>
      ) : <LiveClientLoading />}
    </div>
  );
}

function HomeHero({ onEnterLive }) {
  return (
    <section className="relative isolate min-h-[min(640px,82svh)] overflow-hidden border-b border-exp-border">
      <HeroBoardScene />
      <div className="relative mx-auto flex min-h-[min(640px,82svh)] max-w-7xl flex-col justify-center px-4 pb-20 pt-16 sm:px-6">
        <div className="max-w-4xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-compass-bright sm:text-xs">Voyage. Explore. Escape.</p>
          <h1 className="mt-5 max-w-4xl font-display text-[42px] uppercase leading-[0.9] tracking-[0.04em] text-exp-text sm:text-7xl lg:text-[5.5rem]">
            Chart the strange.
            <span className="mt-1 block text-blueprint">Get everyone home.</span>
          </h1>
          <p className="mt-6 max-w-2xl font-display text-[18px] leading-relaxed tracking-[0.02em] text-exp-text sm:text-2xl">
            A cooperative push-your-luck expedition across an alien hex grid. Share discoveries, weigh the danger, and get the crew home before the route closes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#live-expedition" onClick={onEnterLive} className="inline-flex min-h-[48px] items-center rounded border border-compass bg-compass px-5 py-3 font-display text-[14px] font-semibold uppercase tracking-[0.14em] text-exp-dark shadow-[0_0_28px_rgba(196,166,74,0.2)] transition hover:bg-compass-bright sm:min-h-12 sm:px-6 sm:text-base">
              Enter live lobby
            </a>
            <Link to="/guest" className="inline-flex min-h-[48px] items-center rounded border border-blueprint/60 bg-blueprint/15 px-5 py-3 font-display text-[14px] font-semibold uppercase tracking-[0.14em] text-blueprint transition hover:bg-blueprint/25 sm:min-h-12 sm:px-6 sm:text-base">
              Explore the 3D world
            </Link>
          </div>
          <p className="mt-5 max-w-2xl font-mono text-sm leading-relaxed text-exp-text-dim">
            Open alpha on Sepolia testnet. Connect only when you are ready to create or join a live expedition.
          </p>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-14 border-t border-exp-border/50 bg-exp-dark/70 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-7xl items-center gap-5 overflow-x-auto px-4 sm:px-6" role="region" aria-label="Expedition highlights" tabIndex={0}>
          {proofMetrics.map(([label, value]) => (
            <div key={label} className="shrink-0 font-mono text-xs uppercase tracking-[0.14em] text-exp-text-dim">
              <span className="text-compass-bright">{value}</span> {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveLobby({ isConnected, loadClient }) {
  return (
    <section id="live-expedition" className="scroll-mt-24 border-b border-exp-border bg-exp-surface/35">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeader
            eyebrow="Live expedition lobby"
            title={isConnected ? 'Choose your crew and depart' : 'Browse the live world before connecting'}
            body={isConnected
              ? 'Join an open crew or launch a new survey. Every action below belongs to the playable client.'
              : 'Open a live board in observer mode or launch the local 3D expedition. Connect only when you choose to reserve a seat or submit an action.'}
          />
          <span className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-blueprint">
            Open alpha - Sepolia
          </span>
        </div>
        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SurveyTabletFrame
            title="Xenovoya"
            subtitle="Chart, decide, depart, and remember the run"
            status={isConnected ? 'CREW LINKED' : 'LOBBY READY'}
            headingLevel={3}
          >
            <DeferredLiveClientStack forceReady={loadClient} />
          </SurveyTabletFrame>

          <aside className="space-y-3">
            <MarketingCard className="border-compass/35 bg-compass/5">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-compass">Before you connect</p>
              <ul className="mt-3 space-y-3 font-mono text-sm leading-relaxed text-exp-text-dim">
                <li>Live play uses the Sepolia test network.</li>
                <li>Your wallet signs crew joins and expedition actions.</li>
                <li>You can explore the production 3D world without connecting.</li>
              </ul>
              <Link to="/guest" className="mt-4 inline-flex min-h-11 items-center rounded border border-blueprint/45 bg-blueprint/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-blueprint">
                Start a local 3D expedition
              </Link>
            </MarketingCard>
            {faq.map((item) => (
              <details key={item.question} className="rounded border border-exp-border bg-exp-panel/80 p-4">
                <summary className="min-h-11 cursor-pointer py-2 font-mono text-sm uppercase tracking-[0.12em] text-exp-text">{item.question}</summary>
                <p className="mt-2 font-mono text-sm leading-relaxed text-exp-text-dim">{item.answer}</p>
              </details>
            ))}
          </aside>
        </div>
      </div>
    </section>
  );
}

function FirstTurnStrip() {
  return (
    <section id="first-turn" className="border-b border-exp-border bg-exp-surface/55">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(320px,0.78fr)]">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-compass">The first turn</p>
          <h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text">One choice should explain the run</h2>
          <p className="mt-3 font-mono text-sm leading-relaxed text-exp-text-dim">
            Reveal a tile, see what changed, commit as a crew, and leave before the route turns against you.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {firstTurnSteps.map((step) => (
            <article key={step.title} className="rounded border border-exp-border bg-exp-panel/80 p-4">
              <div className="grid h-9 w-9 place-items-center rounded border border-compass/45 bg-compass/10 font-mono text-sm text-compass-bright">{step.label}</div>
              <h3 className="mt-3 font-mono text-sm uppercase tracking-[0.14em] text-exp-text">{step.title}</h3>
              <p className="mt-2 font-mono text-xs leading-relaxed text-exp-text-dim">{step.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { isConnected } = useWallet();
  const [loadClient, setLoadClient] = useState(() => window.location.hash === '#live-expedition');

  return (
    <div>
      <HomeHero onEnterLive={() => setLoadClient(true)} />
      <LiveLobby isConnected={isConnected} loadClient={loadClient} />
      <FirstTurnStrip />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <SectionHeader
          eyebrow="Why crews return"
          title="The next decision belongs to someone"
          body="Choose a role, leave a useful clue, and give the crew a reason to reopen the expedition together."
        />
        <div className="mt-6">
          <Suspense fallback={<ReturnLoopLoading />}>
            <ReturnLoopPanel />
          </Suspense>
        </div>
      </section>

      <section className="border-y border-exp-border bg-exp-surface/45">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <SectionHeader
            eyebrow="Chart and depart"
            title="A shared map, a closing exit, one remembered run"
            body="The board is the source of truth. Every reveal should create a clearer opportunity, a sharper danger, or a harder decision about going home."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {actionLoop.map((action) => (
              <MarketingCard key={action.verb} className={toneClasses(action.tone)}>
                <h3 className="font-display text-xl uppercase tracking-[0.1em]">{action.verb}</h3>
                <p className="mt-2 font-mono text-sm leading-relaxed text-exp-text-dim">{action.detail}</p>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
