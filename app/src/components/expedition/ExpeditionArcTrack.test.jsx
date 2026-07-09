import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ExpeditionArcTrack from './ExpeditionArcTrack';
import { deriveExpeditionArc } from '../../lib/expeditionArc';

describe('ExpeditionArcTrack', () => {
  it('renders chapter label, next threshold, and pips in order', () => {
    const arc = deriveExpeditionArc({
      departPressure: { pressure: 52, routeStability: 48, recoveredValue: 1, currentDistanceToLanding: 2, readiness: { canFlee: false } },
      escapeCostPreview: { costType: 'close' },
      revealedCount: 6,
    });

    render(<ExpeditionArcTrack arc={arc} />);

    expect(screen.getByText('Departure Window')).toBeInTheDocument();
    expect(screen.getByText('Reach landing or depart before pressure hits 70.')).toBeInTheDocument();
    expect(screen.getByText('Survey')).toBeInTheDocument();
    expect(screen.getByText('Greed')).toBeInTheDocument();
    expect(screen.getByText('Depart')).toBeInTheDocument();
    expect(screen.getByText('Redline')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
  });
});
