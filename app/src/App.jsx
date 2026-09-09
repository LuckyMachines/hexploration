import { lazy, Suspense, useRef, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Modal from './components/shared/Modal';
import SeoHead from './components/shared/SeoHead';
import Spinner from './components/shared/Spinner';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { useFeedbackEffects } from './hooks/useFeedbackEffects';
import { useUserPreferences } from './hooks/useUserPreferences';
import { internalToolsEnabled } from './lib/internalTools';
import { trackUXHelp } from './lib/uxTelemetry';
import HomePage from './pages/HomePage';

const FieldManual = lazy(() => import('./components/help/FieldManual'));
const PseudoLocale = lazy(() => import('./components/shared/PseudoLocale'));
const GamePage = lazy(() => import('./pages/GameClientPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const INCLUDE_INTERNAL_ROUTES = import.meta.env.VITE_ENABLE_INTERNAL_TOOLS === 'true';
const GameUILab = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/GameUILab')) : null;
const DesignSystemPage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/DesignSystemPage')) : null;
const ArtPipelinePage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/ArtPipelinePage')) : null;
const SimulatorPage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/SimulatorPage')) : null;
const AudioAuditionPage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/AudioAuditionPage')) : null;
const GrowthPlayPage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.GrowthPlayPage }))) : null;
const ChallengePage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/GrowthPage').then((module) => ({ default: () => <module.GrowthPlayPage challenge /> }))) : null;
const ScenarioGalleryPage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.ScenarioGalleryPage }))) : null;
const ScenarioDetailPage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.ScenarioDetailPage }))) : null;
const DiscoveryTopicPage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.DiscoveryTopicPage }))) : null;
const ReplayPage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.ReplayPage }))) : null;
const ProgressPage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.ProgressPage }))) : null;
const DevlogPage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.DevlogPage }))) : null;
const CreateScenarioPage = INCLUDE_INTERNAL_ROUTES ? lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.CreateScenarioPage }))) : null;

function RouteFallback() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center">
      <Spinner size="h-8 w-8" />
    </div>
  );
}

function InternalRoute({ component: Component }) {
  if (internalToolsEnabled() && Component) return <Component />;
  return (
    <section className="mx-auto flex min-h-[52vh] max-w-3xl flex-col justify-center px-4 py-16 text-center sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-compass">Live client</p>
      <h1 className="mt-3 font-display text-3xl uppercase tracking-[0.14em] text-exp-text">Launch the expedition client</h1>
      <p className="mt-4 font-mono text-sm leading-relaxed text-exp-text-dim">
        This route is not part of the player-facing expedition path. Start from the live client instead.
      </p>
      <a href="/#live-expedition" className="mx-auto mt-6 inline-flex rounded border border-compass/50 bg-compass/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] text-compass-bright">
        Open live lobby
      </a>
    </section>
  );
}

export default function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const helpTriggerRef = useRef(null);
  const location = useLocation();
  const isPseudoLocaleEnabled = new URLSearchParams(location.search).get('pseudo') === '1';
  const audio = useFeedbackEffects(location);
  useUserPreferences();

  return (
    <div className="min-h-screen flex flex-col">
      <SeoHead />
      {isPseudoLocaleEnabled && (
        <Suspense fallback={null}>
          <PseudoLocale />
        </Suspense>
      )}
      <a href="#main-content" data-capture-hide className="fixed left-3 top-3 z-[200] -translate-y-24 rounded bg-compass px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-exp-dark shadow-xl transition-transform focus:translate-y-0">
        Skip to content
      </a>
      <Header onHelpClick={(event) => {
        helpTriggerRef.current = event.currentTarget;
        trackUXHelp('help');
        setIsHelpOpen(true);
      }} audio={audio} />
      <main id="main-content" tabIndex={-1} className="min-h-[100svh] flex-1">
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/game/:gameId" element={<GamePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              {INCLUDE_INTERNAL_ROUTES && (
                <>
                  <Route path="/ui-lab" element={<InternalRoute component={GameUILab} />} />
                  <Route path="/design-system" element={<InternalRoute component={DesignSystemPage} />} />
                  <Route path="/art-lab" element={<InternalRoute component={ArtPipelinePage} />} />
                  <Route path="/simulator" element={<InternalRoute component={SimulatorPage} />} />
                  <Route path="/audio-audition" element={<InternalRoute component={AudioAuditionPage} />} />
                  <Route path="/play" element={<InternalRoute component={GrowthPlayPage} />} />
                  <Route path="/challenge" element={<InternalRoute component={ChallengePage} />} />
                  <Route path="/scenarios" element={<InternalRoute component={ScenarioGalleryPage} />} />
                  <Route path="/scenarios/:scenarioId" element={<InternalRoute component={ScenarioDetailPage} />} />
                  <Route path="/topics/:topicId" element={<InternalRoute component={DiscoveryTopicPage} />} />
                  <Route path="/replay/:runId" element={<InternalRoute component={ReplayPage} />} />
                  <Route path="/progress" element={<InternalRoute component={ProgressPage} />} />
                  <Route path="/devlog" element={<InternalRoute component={DevlogPage} />} />
                  <Route path="/create-scenario" element={<InternalRoute component={CreateScenarioPage} />} />
                </>
              )}
              <Route path="*" element={<InternalRoute component={null} />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <Modal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        returnFocusRef={helpTriggerRef}
        ariaLabel="Field Manual"
      >
        <Suspense fallback={<p className="px-5 py-8 font-mono text-sm text-exp-text-dim" role="status">Opening field manual...</p>}>
          <FieldManual />
        </Suspense>
      </Modal>
    </div>
  );
}
