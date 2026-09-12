import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import SurveyTabletFrame from '../components/layout/SurveyTabletFrame';
import { useWallet } from '../contexts/WalletContext';
import { usePlayerSession } from '../contexts/PlayerSessionContext';
import { trackJourneyEvent } from '../lib/analytics';

const LiveClientStack = lazy(() => import('../components/game/LiveClientStack'));
const ReturnLoopPanel = lazy(() => import('../components/expedition/ReturnLoopPanel'));

const faq = [
  {
    question: 'Can I play without a wallet?',
    answer: 'Yes. Play a complete solo 3D expedition without connecting. A wallet is only requested when you choose a shared action.',
  },
  {
    question: 'What does the wallet do?',
    answer: 'It signs crew joins and expedition actions on the Sepolia test network. Browsing and observing remain public.',
  },
  {
    question: 'Where are the rules?',
    answer: 'Open the field manual from Settings, or begin solo and learn each action in context.',
  },
];

function HeroBoardScene() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <img src="/images/site-refresh/hero-bg.webp" alt="" width="2400" height="1000" fetchPriority="high" className="h-full w-full object-cover opacity-45" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,15,10,0.98),rgba(13,15,10,0.86)_58%,rgba(13,15,10,0.55))]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,15,10,0.18),rgba(13,15,10,0.98))]" />
    </div>
  );
}

function LiveClientLoading() {
  return (
    <div className="grid min-h-56 place-items-center rounded border border-exp-border bg-exp-dark/45 px-6 py-10 text-center" role="status">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-compass">Scanning live expeditions</p>
        <p className="mt-2 font-mono text-xs text-exp-text-dim">Loading the public registry and available routes.</p>
      </div>
    </div>
  );
}

function ReturnLoopLoading() {
  return <p className="p-5 font-mono text-xs text-exp-text-dim" role="status">Restoring expedition history...</p>;
}

function ModeLink({ eyebrow, title, detail, to, href, tone = 'compass', onClick, analyticsMode }) {
  const palette = tone === 'blueprint'
    ? 'border-blueprint/45 bg-blueprint/10 hover:bg-blueprint/20'
    : tone === 'oxide'
      ? 'border-oxide-green/45 bg-oxide-green/10 hover:bg-oxide-green/20'
      : 'border-compass/45 bg-compass/10 hover:bg-compass/20';
  const content = (
    <>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">{eyebrow}</span>
      <span className="mt-1.5 block font-display text-xl uppercase tracking-[0.08em] text-exp-text sm:mt-2 sm:text-2xl">{title}</span>
      <span className="mt-1.5 line-clamp-1 block font-mono text-[10px] leading-relaxed text-exp-text-dim sm:mt-2 sm:line-clamp-none sm:text-xs">{detail}</span>
    </>
  );
  const className = `min-h-0 rounded border p-3.5 text-left transition-colors sm:min-h-40 sm:p-5 ${palette}`;
  const handleClick = (event) => {
    trackJourneyEvent('mode_selected', { mode: analyticsMode, surface: 'home' }, { dedupeKey: analyticsMode });
    onClick?.(event);
  };

  if (to) return <Link to={to} onClick={handleClick} className={className}>{content}</Link>;
  return <a href={href} onClick={handleClick} className={className}>{content}</a>;
}

function PlayOptions({ onOpenLobby, onOpenCrew }) {
  const { state } = usePlayerSession();

  return (
    <section id="play-options" aria-labelledby="play-options-title" className="relative isolate scroll-mt-20 overflow-hidden border-b border-exp-border">
      <HeroBoardScene />
      <div className="relative mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-14">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-compass-bright">Expedition console / Sepolia</p>
          <h1 id="play-options-title" className="mt-2 font-display text-3xl uppercase leading-none tracking-[0.06em] text-exp-text sm:mt-3 sm:text-6xl">
            Choose your expedition.
          </h1>
          <p className="mt-3 max-w-2xl font-mono text-xs leading-relaxed text-exp-text-dim sm:mt-4 sm:text-base">
            <span className="sm:hidden">Start solo, observe live, or join a crew.</span>
            <span className="hidden sm:inline">You are in the playable client. Start solo, observe a live route, or connect when you are ready to join a crew.</span>
          </p>
        </div>

        <div className={`mt-6 grid gap-2.5 sm:mt-8 sm:gap-3 ${state.activeGameId ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3'}`}>
          {state.activeGameId ? (
            <ModeLink
              eyebrow="Continue"
              title={`Resume #${state.activeGameId}`}
              detail="Return directly to your active expedition."
              to={`/game/${state.activeGameId}`}
              tone="oxide"
              analyticsMode="resume"
            />
          ) : null}
          <ModeLink
            eyebrow="No wallet"
            title="Play solo"
            detail="Enter the complete 3D expedition immediately."
            to="/guest"
            tone="blueprint"
            analyticsMode="solo"
          />
          <ModeLink
            eyebrow="Public board"
            title="Observe live"
            detail="Inspect an open expedition before taking a seat."
            href="#available-expeditions"
            onClick={onOpenLobby}
            analyticsMode="observe"
          />
          <ModeLink
            eyebrow="Shared play"
            title="Join or create"
            detail="Connect only when you choose a crew action."
            href="#crew-network"
            onClick={onOpenCrew}
            tone="oxide"
            analyticsMode="join"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-exp-text-dim sm:mt-6 sm:gap-x-6 sm:gap-y-2 sm:text-[10px] sm:tracking-[0.18em]">
          <span><span className="text-oxide-green">Online</span> network</span>
          <span><span className="text-compass-bright">Open alpha</span> status</span>
          <span><span className="text-blueprint">Wallet-free</span> solo</span>
        </div>
      </div>
    </section>
  );
}

function LiveLobby({ isConnected, crewOpen, onCrewToggle }) {
  return (
    <section id="live-expedition" aria-labelledby="live-expedition-title" className="scroll-mt-20 border-b border-exp-border bg-exp-surface/35">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-compass">Live expedition lobby</p>
            <h2 id="live-expedition-title" className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text sm:text-4xl">Choose a live route</h2>
          </div>
          <p className="max-w-xl font-mono text-xs leading-relaxed text-exp-text-dim">
            Observe freely. Connect only to join a crew or create an expedition.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <SurveyTabletFrame
            title="Expedition lobby"
            subtitle="Observe, join, or create"
            status={isConnected ? 'CREW LINKED' : 'PUBLIC ACCESS'}
            headingLevel={3}
          >
            <Suspense fallback={<LiveClientLoading />}>
              <LiveClientStack crewOpen={crewOpen} onCrewToggle={onCrewToggle} />
            </Suspense>
          </SurveyTabletFrame>

          <aside className="space-y-3">
            <div className="rounded border border-blueprint/35 bg-blueprint/5 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-blueprint">Wallet only when needed</p>
              <p className="mt-3 font-mono text-xs leading-relaxed text-exp-text-dim">
                Solo play and observation are open. Joining or creating a shared expedition asks for a wallet signature.
              </p>
              <Link to="/guest" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded border border-blueprint/45 bg-blueprint/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-blueprint">
                Play solo - no wallet
              </Link>
            </div>
            <details className="rounded border border-exp-border bg-exp-panel/80 p-4">
              <summary className="min-h-11 cursor-pointer py-2 font-mono text-xs uppercase tracking-[0.12em] text-exp-text">Need help choosing?</summary>
              <div className="space-y-4 pt-3">
                {faq.map((item) => (
                  <div key={item.question}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-compass-bright">{item.question}</p>
                    <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">{item.answer}</p>
                  </div>
                ))}
              </div>
            </details>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { isConnected } = useWallet();
  const { state } = usePlayerSession();
  const [crewOpen, setCrewOpen] = useState(false);

  return (
    <div>
      <PlayOptions onOpenLobby={() => setCrewOpen(false)} onOpenCrew={() => setCrewOpen(true)} />
      <LiveLobby isConnected={isConnected} crewOpen={crewOpen} onCrewToggle={setCrewOpen} />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <details
          data-testid="return-loop-details"
          defaultOpen={Boolean(state.activeGameId)}
          className="rounded border border-exp-border bg-exp-surface/55"
        >
          <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 py-4 font-mono text-xs uppercase tracking-[0.18em] text-exp-text">
            <span>{state.activeGameId ? `Continue expedition #${state.activeGameId}` : 'Expedition history and return tools'}</span>
            <span className="text-exp-text-dim">Optional</span>
          </summary>
          <div className="border-t border-exp-border p-4 sm:p-5">
            <Suspense fallback={<ReturnLoopLoading />}>
              <ReturnLoopPanel />
            </Suspense>
          </div>
        </details>
      </section>
    </div>
  );
}
