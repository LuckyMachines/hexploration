import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AftermathMoment from './AftermathMoment';

describe('AftermathMoment', () => {
  it('renders the primary consequence and next-turn pressure read', () => {
    render(
      <AftermathMoment
        moment={{
          title: 'The Planet Raised the Price',
          category: 'pressure-spike',
          tone: 'red',
          summary: 'Recovered value is now at risk.',
          whyItMatters: 'Pressure turns delay into cost.',
          nextPrompt: 'Use the strongest reduction action.',
          receipts: [{ label: 'Pressure', value: '72', tone: 'red' }],
        }}
        departPressure={{ pressure: 72, band: { label: 'Closing Route' } }}
        escapeCostPreview={{ headline: 'Recovered value at risk' }}
      />,
    );

    expect(screen.getByText('The Planet Raised the Price')).toBeInTheDocument();
    expect(screen.getByText('Use the strongest reduction action.')).toBeInTheDocument();
    expect(screen.getByText('Recovered value at risk')).toBeInTheDocument();
  });
});
