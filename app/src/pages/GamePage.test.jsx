import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GamePage from './GamePage';

vi.mock('../contexts/WalletContext', () => ({
  useWallet: () => ({
    address: null,
    isConnected: false,
    chain: null,
    chainId: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    switchChain: vi.fn(),
    isSwitching: false,
  }),
}));

vi.mock('../hooks/useGameState', () => ({
  useGameState: () => ({
    gameStarted: false,
    currentPhase: '',
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useGameOver', () => ({
  useGameOver: () => ({
    isGameOver: false,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../contexts/PlayerSessionContext', () => ({
  usePlayerSession: () => ({
    state: { phase: 'booting', online: true, softPaused: false, activeGameId: null, saveStatus: 'local', pendingTransactions: [] },
    beginGame: vi.fn(), hydrated: vi.fn(), terminal: vi.fn(), pause: vi.fn(), resume: vi.fn(),
  }),
}));

vi.mock('../components/game/GameLobby', () => ({
  default: ({ gameId }) => <div data-testid="game-lobby">Lobby {gameId}</div>,
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

    expect(screen.getByText(/Invalid survey id/i)).toBeInTheDocument();
  });

  it('opens a valid expedition in observer mode without a wallet', () => {
    render(
      <MemoryRouter initialEntries={['/game/42']}>
        <Routes>
          <Route path="/game/:gameId" element={<GamePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Observer access - no wallet needed/i)).toBeInTheDocument();
    expect(screen.getByTestId('game-lobby')).toHaveTextContent('Lobby 42');
    expect(screen.queryByText(/Connect your wallet to enter/i)).not.toBeInTheDocument();
  });
});
