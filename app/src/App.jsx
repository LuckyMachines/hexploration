import { lazy, Suspense, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Modal from './components/shared/Modal';
import SeoHead from './components/shared/SeoHead';
import Spinner from './components/shared/Spinner';
import FieldManual from './components/help/FieldManual';
import ErrorBoundary from './components/shared/ErrorBoundary';
import PseudoLocale from './components/shared/PseudoLocale';
import { useFeedbackEffects } from './hooks/useFeedbackEffects';
import { useUserPreferences } from './hooks/useUserPreferences';

const HomePage = lazy(() => import('./pages/HomePage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const GameUILab = lazy(() => import('./pages/GameUILab'));
const DesignSystemPage = lazy(() => import('./pages/DesignSystemPage'));
const SimulatorPage = lazy(() => import('./pages/SimulatorPage'));
const AudioAuditionPage = lazy(() => import('./pages/AudioAuditionPage'));
const GrowthPlayPage = lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.GrowthPlayPage })));
const ChallengePage = lazy(() => import('./pages/GrowthPage').then((module) => ({ default: () => <module.GrowthPlayPage challenge /> })));
const ScenarioGalleryPage = lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.ScenarioGalleryPage })));
const ScenarioDetailPage = lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.ScenarioDetailPage })));
const DiscoveryTopicPage = lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.DiscoveryTopicPage })));
const ReplayPage = lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.ReplayPage })));
const ProgressPage = lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.ProgressPage })));
const DevlogPage = lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.DevlogPage })));
const CreateScenarioPage = lazy(() => import('./pages/GrowthPage').then((module) => ({ default: module.CreateScenarioPage })));

function RouteFallback() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center">
      <Spinner size="h-8 w-8" />
    </div>
  );
}

export default function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const location = useLocation();
  const audio = useFeedbackEffects(location);
  useUserPreferences();

  return (
    <div className="min-h-screen flex flex-col">
      <SeoHead />
      <PseudoLocale />
      <Header onHelpClick={() => setIsHelpOpen(true)} audio={audio} />
      <main className="flex-1">
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/game/:gameId" element={<GamePage />} />
              <Route path="/ui-lab" element={<GameUILab />} />
              <Route path="/design-system" element={<DesignSystemPage />} />
              <Route path="/simulator" element={<SimulatorPage />} />
              <Route path="/audio-audition" element={<AudioAuditionPage />} />
              <Route path="/play" element={<GrowthPlayPage />} />
              <Route path="/challenge" element={<ChallengePage />} />
              <Route path="/scenarios" element={<ScenarioGalleryPage />} />
              <Route path="/scenarios/:scenarioId" element={<ScenarioDetailPage />} />
              <Route path="/topics/:topicId" element={<DiscoveryTopicPage />} />
              <Route path="/replay/:runId" element={<ReplayPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/devlog" element={<DevlogPage />} />
              <Route path="/create-scenario" element={<CreateScenarioPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
      <Modal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        ariaLabel="Field Manual"
      >
        <FieldManual />
      </Modal>
    </div>
  );
}
