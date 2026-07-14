import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('return service client contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_RETURN_API_URL', 'https://return-api.xenovoya.com');
    localStorage.clear();
  });

  it('stores structured expiring sessions without preserving legacy tokens', async () => {
    const service = await import('./returnService');
    localStorage.setItem('xenovoya:return-service-session:v1', 'legacy-token');
    service.saveReturnSession({ token: 'session-token', wallet: '0x1111111111111111111111111111111111111111', expiresAt: new Date(Date.now() + 60_000).toISOString() });
    expect(service.loadReturnSession()).toMatchObject({ token: 'session-token', wallet: '0x1111111111111111111111111111111111111111' });
    expect(localStorage.getItem('xenovoya:return-service-session:v1')).toBeNull();
  });

  it('uses the versioned return-state and idempotent event endpoints', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ version: 2 }) })
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ accepted: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ gameId: '42' }) });
    vi.stubGlobal('fetch', fetchMock);
    const service = await import('./returnService');
    const state = { version: 1, player: { callsign: 'Voyager', role: '', records: { expeditions: 0, rescues: 0, relics: 0 } }, crew: [], expedition: null, events: [] };
    await service.putCloudReturnState(state, 1, 'token');
    await service.recordRetentionEvent('cloud_return_saved', { role: 'scout' }, { eventId: '11111111-1111-4111-8111-111111111111', token: 'token' });
    await service.updateExpeditionAnnotation('42', { note: 'Follow the ridge.', preferences: { pinned: true } }, 'token');
    expect(fetchMock.mock.calls[0][0]).toBe('https://return-api.xenovoya.com/v1/return-state');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ expectedVersion: 1, state });
    expect(fetchMock.mock.calls[1][0]).toBe('https://return-api.xenovoya.com/v1/events');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ eventId: '11111111-1111-4111-8111-111111111111', name: 'cloud_return_saved' });
    expect(fetchMock.mock.calls[2][0]).toBe('https://return-api.xenovoya.com/v1/expeditions/42/annotation');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ note: 'Follow the ridge.', preferences: { pinned: true } });
  });
});
