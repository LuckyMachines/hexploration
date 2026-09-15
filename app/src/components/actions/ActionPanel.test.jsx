import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ActionPanel from './ActionPanel';
import { Action } from '../../lib/constants';

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

vi.mock('../../hooks/useSponsoredSession', () => ({
  useSponsoredSession: () => ({ configured: false }),
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
    await user.click(screen.getByRole('button', { name: /Commit Action/i }));

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

    await user.click(screen.getByTitle(/Trace a reachable path that charts useful ground without losing the way home\. Press 1\./i));
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

  it('carries an exact rescue forecast into confirmation and submission', async () => {
    const user = userEvent.setup();
    render(
      <ActionPanel
        gameId="1"
        playerID={1}
        currentLocation="0,0"
        currentAction="Idle"
        stats={{ movement: 3, agility: 2, dexterity: 2 }}
        crew={[
          { playerID: 1, currentZone: '0,0', movement: 3, agility: 2, dexterity: 2 },
          { playerID: 2, currentZone: '0,0', movement: 0, agility: 2, dexterity: 3 },
        ]}
        movement={3}
        movePath={[]}
        activeTab={Action.HELP}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /Rescue P2/i }));
    expect(screen.getByText(/Rescue forecast/i)).toBeInTheDocument();
    expect(screen.getByText(/You give 1 Movement: 3 to 2\. P2 restores 2 there \(0 to 2\) and 1 in both other stats/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Commit Action/i }));

    expect(submitActionMock).toHaveBeenCalledWith(1, Action.HELP, ['2', 'Movement'], '', '', '1');
  });
});
