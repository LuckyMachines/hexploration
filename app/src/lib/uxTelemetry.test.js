import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  document.querySelectorAll('script[data-xenovoya-plausible]').forEach((script) => script.remove());
  delete window.plausible;
  delete window.__xenovoyaUXTelemetry;
});

describe('UX telemetry', () => {
  it('uses privacy-preserving performance buckets', async () => {
    const { bucketMetric, rateMetric } = await import('./uxTelemetry');
    expect(bucketMetric('LCP', 1800)).toBe('1s-2.5s');
    expect(bucketMetric('CLS', 0.2)).toBe('0.1-0.25');
    expect(rateMetric('INP', 550)).toBe('poor');
  });

  it('records only allowlisted UX dimensions', async () => {
    vi.stubEnv('VITE_PLAUSIBLE_HOST', 'https://plausible.example');
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'play.example');
    vi.stubEnv('VITE_APP_ENV', 'test');
    vi.stubEnv('VITE_RELEASE_SHA', 'abcdef0123456789abcdef0123456789abcdef01');
    vi.stubEnv('VITE_ANALYTICS_SOURCE', 'synthetic');
    const { trackUXError, trackUXRecovery } = await import('./uxTelemetry');
    expect(trackUXError({ surface: 'board', errorType: 'network', severity: 'high' })).toBe(true);
    expect(trackUXRecovery({ surface: 'board', recovery: 'retry' })).toBe(true);
    const error = window.plausible.q.find(([name]) => name === 'ux_error');
    expect(error[1].props).toMatchObject({ surface: 'board', error_type: 'network', severity: 'high' });
    expect(error[1].props).not.toHaveProperty('message');
  });
});
