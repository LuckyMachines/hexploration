import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GamePage from './GamePage';

vi.mock('../hooks/useGameState', () => ({
  useGameState: () => ({
    gameStarted: false,
    currentPhase: '',
    isLoading: false,
    error: null,
  }),
}));

describe('GamePage', () => {
  it('shows a clear error for invalid game ids', () => {
    render(
      <MemoryRouter initialEntries={['/game/not-a-number']}>
        <Routes>
          <Route path="/game/:gameId" element={<GamePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Invalid expedition id/i)).toBeInTheDocument();
  });
});
