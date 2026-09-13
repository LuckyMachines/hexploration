import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tile } from '../../lib/constants';
import ThreeBoard from './ThreeBoard';

const cells = [
  { alias: '0,0', tileType: Tile.JUNGLE, revealed: true },
  { alias: '1,0', tileType: Tile.DESERT, revealed: true },
];

describe('ThreeBoard stable hover presentation', () => {
  it('anchors the environment to player location instead of hover intent', () => {
    const { rerender } = render(
      <ThreeBoard cells={cells} currentLocation="0,0" intentAlias="0,0" ariaLabel="Board" />,
    );
    const board = screen.getByTestId('three-board-world');
    expect(board.style.backgroundImage).toContain('glassroot-cavern.webp');

    rerender(<ThreeBoard cells={cells} currentLocation="0,0" intentAlias="1,0" ariaLabel="Board" />);
    expect(board.style.backgroundImage).toContain('glassroot-cavern.webp');

    rerender(<ThreeBoard cells={cells} currentLocation="1,0" intentAlias="1,0" ariaLabel="Board" />);
    expect(board.style.backgroundImage).toContain('emberglass-crossing.webp');
  });

  it('uses an authored location backplate when the view model names the place', () => {
    render(
      <ThreeBoard
        viewModel={{
          cells,
          currentLocation: '0,0',
          intentAlias: '1,0',
          source: { kind: 'guest', locationName: 'Echo Fork' },
        }}
        ariaLabel="Authored board"
      />,
    );
    expect(screen.getByTestId('three-board-world').style.backgroundImage).toContain('echo-fork.webp');
  });
});
