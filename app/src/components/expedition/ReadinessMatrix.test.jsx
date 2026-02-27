import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReadinessMatrix from './ReadinessMatrix';

describe('ReadinessMatrix', () => {
  it('shows pending/submitted states per player', () => {
    render(
      <ReadinessMatrix
        queueActive
        players={[
          { playerID: 1 },
          { playerID: 2 },
        ]}
        readinessByPlayerID={{
          '1': true,
          '2': false,
        }}
      />,
    );

    expect(screen.getByText(/P1/i)).toBeInTheDocument();
    expect(screen.getByText(/Submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending/i)).toBeInTheDocument();
  });
});
