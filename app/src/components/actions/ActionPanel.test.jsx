import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ActionPanel from './ActionPanel';

const submitActionMock = vi.fn();

vi.mock('../../hooks/useGameActions', () => ({
  useGameActions: () => ({
    submitAction: submitActionMock,
    hash: null,
    isPending: false,
    isConfirming: false,
    isSuccess: false,
    error: null,
  }),
}));

vi.mock('../../hooks/usePlayerInventory', () => ({
  usePlayerInventory: () => ({
    active: { campsite: false },
  }),
}));

describe('ActionPanel', () => {
  beforeEach(() => {
    submitActionMock.mockReset();
  });

  it('does not treat Idle as submitted and allows move submission', async () => {
    const onMoveSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <ActionPanel
        gameId="1"
        playerID={1}
        currentLocation="0,0"
        currentAction="Idle"
        movement={2}
        movePath={['1,0']}
        onMoveSubmit={onMoveSubmit}
      />,
    );

    expect(screen.queryByText(/Submitted: Idle/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Submit Move/i }));

    expect(submitActionMock).toHaveBeenCalledWith(
      1,
      1,
      ['1,0'],
      '',
      '',
      '1',
    );
    expect(onMoveSubmit).toHaveBeenCalled();
  });

  it('blocks submission when action is already submitted', () => {
    render(
      <ActionPanel
        gameId="1"
        playerID={1}
        currentLocation="0,0"
        currentAction="Dig"
        movement={2}
        movePath={['1,0']}
      />,
    );

    expect(screen.getByText(/Submitted: Dig/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Move/i })).toBeDisabled();
  });

  it('blocks submission in spectator mode', () => {
    render(
      <ActionPanel
        gameId="1"
        playerID={1}
        currentLocation="0,0"
        currentAction="Idle"
        movement={2}
        movePath={['1,0']}
        isSpectator
      />,
    );

    expect(screen.getByRole('button', { name: /Submit Move/i })).toBeDisabled();
  });
});
