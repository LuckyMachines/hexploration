import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import GameUILab from './pages/GameUILab';
import SimulatorPage from './pages/SimulatorPage';
import {
  CreateScenarioPage,
  DevlogPage,
  DiscoveryTopicPage,
  GrowthPlayPage,
  ProgressPage,
  ReplayPage,
  ScenarioDetailPage,
  ScenarioGalleryPage,
} from './pages/GrowthPage';
import Modal from './components/shared/Modal';
import SeoHead from './components/shared/SeoHead';
import FieldManual from './components/help/FieldManual';
import ErrorBoundary from './components/shared/ErrorBoundary';
import PseudoLocale from './components/shared/PseudoLocale';
import { useFeedbackEffects } from './hooks/useFeedbackEffects';
import { useUserPreferences } from './hooks/useUserPreferences';

export default function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  useFeedbackEffects();
  useUserPreferences();

  return (
    <div className="min-h-screen flex flex-col">
      <SeoHead />
      <PseudoLocale />
      <Header onHelpClick={() => setIsHelpOpen(true)} />
      <main className="flex-1">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/game/:gameId" element={<GamePage />} />
            <Route path="/ui-lab" element={<GameUILab />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="/play" element={<GrowthPlayPage />} />
            <Route path="/challenge" element={<GrowthPlayPage challenge />} />
            <Route path="/scenarios" element={<ScenarioGalleryPage />} />
            <Route path="/scenarios/:scenarioId" element={<ScenarioDetailPage />} />
            <Route path="/topics/:topicId" element={<DiscoveryTopicPage />} />
            <Route path="/replay/:runId" element={<ReplayPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/devlog" element={<DevlogPage />} />
            <Route path="/create-scenario" element={<CreateScenarioPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
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
