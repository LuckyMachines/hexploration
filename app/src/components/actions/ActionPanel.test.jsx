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
    window.localStorage.clear();
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
    expect(screen.getByRole('dialog', { name: /Confirm turn action/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Send Transaction/i }));

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

  it('supports tab number shortcuts and route undo', async () => {
    const user = userEvent.setup();
    const onMoveBacktrack = vi.fn();

    render(
      <ActionPanel
        gameId="1"
        playerID={1}
        currentLocation="0,0"
        currentAction="Idle"
        movement={2}
        movePath={['1,0']}
        onMoveBacktrack={onMoveBacktrack}
        boardInput={{ inputMode: 'pad' }}
      />,
    );

    await user.keyboard('{Tab}2');
    expect(screen.getByRole('button', { name: /Setup Camp/i })).toBeInTheDocument();
    expect(screen.getByText(/A: commit intent/i)).toBeInTheDocument();

    await user.click(screen.getByTitle(/Trace a reachable path across revealed adjacent tiles\. Press 1\./i));
    await user.click(screen.getByRole('button', { name: /Undo Step/i }));
    expect(onMoveBacktrack).toHaveBeenCalledTimes(1);
  });

  it('keeps secondary action details collapsed by default', () => {
    render(
      <ActionPanel
        gameId="1"
        playerID={1}
        currentLocation="0,0"
        currentAction="Idle"
        movement={2}
        movePath={[]}
        interfaceDensity={{ level: 'quiet', details: {} }}
      />,
    );

    expect(screen.getByText(/Action context/i).closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText(/Outcome preview/i).closest('details')).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: /Submit Move/i })).toBeDisabled();
  });
});
