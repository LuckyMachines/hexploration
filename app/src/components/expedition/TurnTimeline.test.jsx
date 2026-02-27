import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TurnTimeline from './TurnTimeline';

vi.mock('../../hooks/useAutomationStatus', () => ({
  useAutomationStatus: () => ({
    mode: 'mock',
  }),
}));

describe('TurnTimeline', () => {
  it('renders queue telemetry values', () => {
    render(
      <TurnTimeline
        queueTelemetry={{
          queueID: 12n,
          phase: 2,
          submittedCount: 1,
          totalPlayers: 3,
          randomnessCount: 40,
        }}
        events={[
          {
            key: 'event-1',
            name: 'ActionSubmit',
            blockNumber: 99n,
            timestamp: Date.now(),
          },
        ]}
      />,
    );

    expect(screen.getByText(/Queue #12/i)).toBeInTheDocument();
    expect(screen.getByText(/1\/3/i)).toBeInTheDocument();
    expect(screen.getByText(/40 words/i)).toBeInTheDocument();
  });
});
