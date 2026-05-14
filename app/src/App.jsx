import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import GameUILab from './pages/GameUILab';
import SimulatorPage from './pages/SimulatorPage';
import Modal from './components/shared/Modal';
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
      <PseudoLocale />
      <Header onHelpClick={() => setIsHelpOpen(true)} />
      <main className="flex-1">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/game/:gameId" element={<GamePage />} />
            <Route path="/ui-lab" element={<GameUILab />} />
            <Route path="/simulator" element={<SimulatorPage />} />
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
