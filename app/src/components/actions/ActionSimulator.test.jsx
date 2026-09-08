import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Action } from '../../lib/constants';
import ActionSimulator from './ActionSimulator';

describe('ActionSimulator', () => {
  it('presents a submitted Help as a locked rescue instead of a likely revert', () => {
    render(
      <ActionSimulator
        activeTab={Action.HELP}
        movement={3}
        currentLocation="0,0"
        hasSubmitted
        isSpectator={false}
        helpPreview={{
          valid: true,
          targetID: 2,
          statLabel: 'Agility',
          targetBefore: 1,
          targetAfter: 3,
          crewGain: 3,
          isRescue: true,
        }}
      />,
    );

    expect(screen.getByText('Intent Locked')).toBeInTheDocument();
    expect(screen.getByText(/P2 selected for Help/i)).toBeInTheDocument();
    expect(screen.getByText(/Critical rescue forecast/i)).toBeInTheDocument();
    expect(screen.queryByText('Likely Revert')).not.toBeInTheDocument();
  });
});
