import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlayerDossier from './PlayerDossier';

describe('PlayerDossier character identity', () => {
  it('renders the canonical character, role, and authored action state', () => {
    const onFocus = vi.fn();
    const { container } = render(<PlayerDossier
      player={{
        playerAddress: '0x2B4D164A4C0c44C725D0D92A69fAE8aE8C8B2Ea3',
        characterId: 'field-mender',
        roleId: 'medic',
        currentZone: '1,1',
        movement: 3,
        agility: 3,
        dexterity: 4,
        action: 'Rest',
        isActive: true,
      }}
      index={1}
      isCurrentUser={false}
      isFocused={false}
      isNearIntent
      onFocus={onFocus}
    />);

    expect(screen.getByText('Field Mender')).toBeInTheDocument();
    expect(screen.getByText(/Medic \/ 1,1/i)).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', '/images/art/characters/field-mender-recovering.runtime.webp');
    fireEvent.click(screen.getByRole('button'));
    expect(onFocus).toHaveBeenCalledOnce();
  });
});
