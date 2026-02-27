import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import Modal from './components/shared/Modal';
import FieldManual from './components/help/FieldManual';

export default function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Header onHelpClick={() => setIsHelpOpen(true)} />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
        </Routes>
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
