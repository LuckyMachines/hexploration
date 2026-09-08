import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UIQualityStatus from './UIQualityStatus';

afterEach(() => vi.unstubAllGlobals());

describe('UIQualityStatus', () => {
  it('shows the current grade and approved scene count', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'pass', grade: 'A', summary: { current: 6, total: 6 }, nextAction: 'Observe players.' }),
    }));
    render(<UIQualityStatus />);
    expect(await screen.findByText('A')).toBeInTheDocument();
    expect(screen.getByText('6 / 6 approved scenes current')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Current');
  });

  it('fails gracefully when generated evidence is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    render(<UIQualityStatus />);
    expect(await screen.findByText('Evidence unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Run npm run ui:quality:report/)).toBeInTheDocument();
  });
});

