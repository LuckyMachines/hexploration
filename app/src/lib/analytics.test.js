import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  document.querySelectorAll('script[data-xenovoya-plausible]').forEach((script) => script.remove());
  delete window.plausible;
  delete window.__xenovoyaLastPageview;
  window.history.replaceState({}, '', '/');
});

describe('analytics', () => {
  it('stays disabled without explicit public configuration', async () => {
    vi.stubEnv('VITE_PLAUSIBLE_HOST', '');
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', '');
    const { analyticsEnabled, trackJourneyEvent } = await import('./analytics');
    expect(analyticsEnabled()).toBe(false);
    expect(trackJourneyEvent('starter_opened', { persona: 'first-player-v1' })).toBe(false);
  });

  it('queues allowlisted, versioned events once and strips unsafe properties', async () => {
    vi.stubEnv('VITE_PLAUSIBLE_HOST', 'https://plausible.example');
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'play.example');
    vi.stubEnv('VITE_APP_ENV', 'test');
    vi.stubEnv('VITE_RELEASE_SHA', 'abcdef0123456789abcdef0123456789abcdef01');
    vi.stubEnv('VITE_ANALYTICS_SOURCE', 'synthetic');
    const { getAnalyticsContext, initAnalytics, trackJourneyEvent } = await import('./analytics');

    expect(initAnalytics()).toBe(true);
    expect(document.querySelector('script[data-xenovoya-plausible]')).not.toBeNull();
    const pageview = window.plausible.q.find(([name]) => name === 'pageview');
    expect(pageview[1].props).toMatchObject({ environment: 'test', source: 'synthetic', route: '/' });
    expect(pageview[1].props.event_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(trackJourneyEvent('starter_opened', {
      persona: 'first-player-v1',
      wallet: '0x1111111111111111111111111111111111111111',
      email: 'player@example.com',
      unregistered: 'discard me',
    })).toBe(true);
    expect(trackJourneyEvent('starter_opened', { persona: 'first-player-v1' })).toBe(false);

    const queued = window.plausible.q.filter(([name]) => name === 'starter_opened');
    expect(queued).toHaveLength(1);
    expect(queued[0][1].props).toMatchObject({
      event_version: '1',
      environment: 'test',
      release: 'abcdef0123456789abcdef0123456789abcdef01',
      source: 'synthetic',
      persona: 'first-player-v1',
    });
    expect(queued[0][1].props.event_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(queued[0][1].props).not.toHaveProperty('wallet');
    expect(queued[0][1].props).not.toHaveProperty('email');
    expect(queued[0][1].props).not.toHaveProperty('unregistered');
    expect(getAnalyticsContext().installation_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(getAnalyticsContext().journey_id).toMatch(/^[a-f0-9-]{36}$/);
  });

  it('drops unknown enum values and never records query strings as routes', async () => {
    vi.stubEnv('VITE_PLAUSIBLE_HOST', 'https://plausible.example');
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'play.example');
    vi.stubEnv('VITE_APP_ENV', 'production');
    vi.stubEnv('VITE_RELEASE_SHA', 'abcdef0123456789abcdef0123456789abcdef01');
    vi.stubEnv('VITE_ANALYTICS_SOURCE', 'player');
    window.history.replaceState({}, '', '/game/42?email=player@example.com');
    const { trackJourneyEvent } = await import('./analytics');

    expect(trackJourneyEvent('resume', {
      has_expedition: true,
      lifecycle: 'invented-state',
      resume_source: 'local',
    })).toBe(true);

    const [, payload] = window.plausible.q.find(([name]) => name === 'resume');
    expect(payload.props.route).toBe('/game/42');
    expect(payload.props).not.toHaveProperty('lifecycle');
    expect(JSON.stringify(payload.props)).not.toContain('player@example.com');
  });

  it('rejects unknown events rather than sending arbitrary payloads', async () => {
    vi.stubEnv('VITE_PLAUSIBLE_HOST', 'https://plausible.example');
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'play.example');
    const { trackJourneyEvent } = await import('./analytics');
    expect(trackJourneyEvent('wallet_connected', { wallet: 'secret' })).toBe(false);
  });
});
