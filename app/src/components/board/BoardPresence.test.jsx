import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Action, Tile } from '../../lib/constants';
import BoardPresence from './BoardPresence';

function renderPresence(controlFeel, tileType = Tile.JUNGLE) {
  return render(
    <svg>
      <BoardPresence
        currentLocation="0,0"
        intentAlias="1,0"
        intentTile={{ tileType }}
        activeAction={Action.MOVE}
        previewPath={['1,0']}
        movement={3}
        stats={{ movement: 3, agility: 2, dexterity: 2 }}
        controlFeel={controlFeel}
      />
    </svg>,
  );
}

describe('BoardPresence generated signals', () => {
  it('layers the discovery bloom only when the intended tile is still unknown', () => {
    const { container } = renderPresence({ intentIsFog: true });
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/images/art/fx/discovery-bloom.png');
  });

  it('uses the localized pressure fracture when the intended choice is dangerous', () => {
    const { container } = renderPresence({ intentIsDanger: true }, Tile.RELIC);
    expect(container.querySelector('image')?.getAttribute('href')).toBe('/images/art/fx/redline-pressure.png');
  });
});
