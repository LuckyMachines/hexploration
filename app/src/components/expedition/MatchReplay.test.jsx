import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MatchReplay from './MatchReplay';

const events = [
  {
    key: 'a',
    name: 'GameStart',
    args: { gameID: 1n },
    blockNumber: 100n,
  },
  {
    key: 'b',
    name: 'ActionSubmit',
    args: { gameID: 1n },
    blockNumber: 101n,
  },
];

describe('MatchReplay', () => {
  it('invokes full history loader', async () => {
    const user = userEvent.setup();
    const onLoadFullHistory = vi.fn();

    render(
      <MatchReplay
        events={events}
        onLoadFullHistory={onLoadFullHistory}
        isLoadingFullHistory={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Load Full History/i }));
    expect(onLoadFullHistory).toHaveBeenCalledTimes(1);
  });

  it('plays forward through replay steps', () => {
    vi.useFakeTimers();

    render(
      <MatchReplay
        events={events}
        onLoadFullHistory={() => {}}
      />,
    );

    expect(screen.getByText(/Step 1 \/ 2/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Play/i }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/Step 2 \/ 2/i)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
