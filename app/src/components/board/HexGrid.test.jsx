import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import HexGrid from './HexGrid';

vi.mock('../../hooks/useBoardSize', () => ({
  useBoardSize: () => ({ rows: 3, columns: 3, isLoading: false }),
}));

vi.mock('../../hooks/useActiveZones', () => ({
  useActiveZones: () => ({
    zones: ['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2'],
    tiles: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    campsites: [false, false, false, false, false, false, false, false, false],
  }),
}));

vi.mock('../../hooks/useAllPlayerLocations', () => ({
  useAllPlayerLocations: () => ({
    playerIDs: [],
    playerZones: [],
  }),
}));

vi.mock('../../hooks/useLandingSite', () => ({
  useLandingSite: () => ({ zoneAlias: '' }),
}));

describe('HexGrid', () => {
  it('highlights reachable tiles during move planning', () => {
    const { container } = render(
      <HexGrid
        gameId="1"
        currentLocation="1,1"
        movement={1}
        isMovePlanning
      />,
    );

    expect(
      container.querySelector('[data-alias="2,1"]')?.getAttribute('data-reachable'),
    ).toBe('true');
    expect(
      container.querySelector('[data-alias="2,0"]')?.getAttribute('data-reachable'),
    ).toBe('false');
  });

  it('forwards tile clicks to the callback', async () => {
    const user = userEvent.setup();
    const onTileClick = vi.fn();

    render(
      <HexGrid
        gameId="1"
        onTileClick={onTileClick}
      />,
    );

    await user.click(screen.getByText('1,1'));
    expect(onTileClick).toHaveBeenCalledWith('1,1');
  });
});
