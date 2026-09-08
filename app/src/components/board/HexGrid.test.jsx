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
  it('caps the board viewport from grid aspect ratio', () => {
    const { container } = render(<HexGrid gameId="1" />);

    expect(screen.getByTestId('hex-board-viewport')).toHaveStyle({
      maxWidth: 'min(100%, 651px, 64.228svh)',
    });
    expect(container.querySelector('pattern image')?.getAttribute('href')).toBe('/images/art/terrain/verdant-signal-base.webp');
    expect(container.querySelectorAll('polygon[fill^="url(#verdant-signal-"]')).toHaveLength(9);
  });

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
    expect(onTileClick).toHaveBeenCalledWith('1,1', expect.any(Set));
  });

  it('lets the player switch persistently between diorama and tactical views', async () => {
    const user = userEvent.setup();
    render(<HexGrid gameId="1" />);

    const toggle = screen.getByTestId('board-view-toggle');
    expect(toggle).toHaveTextContent('Tactical view');

    await user.click(toggle);
    expect(toggle).toHaveTextContent('Diorama view');
    expect(JSON.parse(window.localStorage.getItem('xenovoya:user-preferences'))).toMatchObject({ tacticalBoard: true });
  });
});
