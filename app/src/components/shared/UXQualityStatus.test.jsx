import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UXQualityStatus from './UXQualityStatus';

afterEach(() => vi.unstubAllGlobals());

describe('UXQualityStatus', () => {
  it('keeps automated and human evidence distinct', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ grade: 'A-', automationPass: true, releaseReady: false, gates: { browserEvidence: { status: 'pass', results: [{ projects: ['chromium-desktop'] }, { projects: ['pixel-7', 'iphone-13'] }] }, research: { validSessions: 0 }, telemetry: { status: 'unavailable' } }, nextActions: ['Observe players.'] }) }));
    render(<UXQualityStatus />);
    expect(await screen.findByText('A-')).toBeInTheDocument();
    expect(screen.getByText('Human evidence pending')).toBeInTheDocument();
    expect(screen.getByText(/Browser evidence: pass across 3 profiles/)).toBeInTheDocument();
    expect(screen.getByText(/Observed sessions: 0/)).toBeInTheDocument();
  });
});
