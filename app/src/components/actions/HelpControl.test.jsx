import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import HelpControl from './HelpControl';

const crew = [
  { playerID: 1, playerAddress: '0x1111111111111111111111111111111111111111', currentZone: '0,0', movement: 3, agility: 2, dexterity: 2 },
  { playerID: 2, playerAddress: '0x2222222222222222222222222222222222222222', currentZone: '0,0', movement: 0, agility: 2, dexterity: 3 },
  { playerID: 3, playerAddress: '0x3333333333333333333333333333333333333333', currentZone: '2,0', movement: 0, agility: 0, dexterity: 0 },
];

describe('HelpControl', () => {
  it('recommends the reachable critical rescue and submits its exact forecast', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <HelpControl
        currentPlayerID={1}
        currentLocation="0,0"
        helperStats={{ movement: 3, agility: 2, dexterity: 2 }}
        crew={crew}
        onSubmit={onSubmit}
      />,
    );

    const rescueButton = await screen.findByRole('button', { name: /Rescue P2/i });
    expect(screen.getByText(/You: Movement 3 to 2\. P2: Movement 0 to 2, plus 1 in both other stats\. Crew gains 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /P3.*Out of reach/i })).toBeDisabled();

    await user.click(rescueButton);
    expect(onSubmit).toHaveBeenCalledWith(
      '2',
      'Movement',
      expect.objectContaining({ helperAfter: 2, targetAfter: 2, crewGain: 3, isRescue: true }),
    );
  });

  it('explains when no teammate is on the helper tile', async () => {
    render(
      <HelpControl
        currentPlayerID={1}
        currentLocation="0,0"
        helperStats={{ movement: 3, agility: 2, dexterity: 2 }}
        crew={[crew[0], crew[2]]}
        onSubmit={() => {}}
      />,
    );

    await waitFor(() => expect(screen.getByText('0 in reach')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Help Explorer/i })).toBeDisabled();
  });
});
