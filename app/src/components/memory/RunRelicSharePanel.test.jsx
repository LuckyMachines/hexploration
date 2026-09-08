import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RunRelicSharePanel from './RunRelicSharePanel';

const memory = {
  id: 'test-relic',
  title: 'The Blue Fog Return',
  outcome: 'escaped',
  outcomeLabel: 'Crew escaped',
  score: 88,
  finalPressure: 54,
  escapeCostLevel: 'clean',
  escapeCostLabel: 'Clean departure',
  artifacts: 2,
  survivors: 3,
  crew: 3,
  badges: ['Route Save'],
  reportPath: '/game/12',
};

function setNavigatorValue(name, value) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

function renderPanel() {
  return render(<MemoryRouter><RunRelicSharePanel memory={memory} /></MemoryRouter>);
}

describe('RunRelicSharePanel', () => {
  beforeEach(() => {
    setNavigatorValue('share', undefined);
    setNavigatorValue('canShare', undefined);
    setNavigatorValue('clipboard', undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setNavigatorValue('share', undefined);
    setNavigatorValue('canShare', undefined);
    setNavigatorValue('clipboard', undefined);
  });

  it('opens the native share sheet with the record URL when supported', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigatorValue('share', share);
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Share relic' }));

    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: 'The Blue Fog Return',
      url: `${window.location.origin}/game/12`,
    }));
    expect(screen.getByRole('status')).toHaveTextContent('Relic shared');
  });

  it('falls back to a temporary text field when native sharing and clipboard are unavailable', async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    const user = userEvent.setup();
    setNavigatorValue('clipboard', undefined);
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Share relic' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(screen.getByRole('status')).toHaveTextContent('Share text copied');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('uses the approved modular relic art without replacing truthful run data', () => {
    const { container } = renderPanel();
    const card = screen.getByRole('article', { name: /The Blue Fog Return Run Relic Card/i });
    expect(card.querySelector('[data-art-composition="choir-seed-glassroot-memory"]')).not.toBeNull();
    expect(container.querySelector('img[src="/images/art/environments/glassroot-cavern.webp"]')).not.toBeNull();
    expect(container.querySelector('img[src="/images/art/relics/choir-seed.png"]')).not.toBeNull();
    expect(screen.getByText('88')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });
});
