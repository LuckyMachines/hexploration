import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGameSession, ensureGameSession, requestGameState, submitGameCommand } from './gameAuthority';

describe('game authority client', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('creates once and restores the same private play session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'opaque-token', playerIdentity: '0x0000000000000000000000000000000000000001', expiresAt: '2099-01-01T00:00:00.000Z' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const first = await ensureGameSession();
    const second = await ensureGameSession();
    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clearGameSession();
  });

  it('sends commands with the opaque bearer and no player-supplied address', async () => {
    window.localStorage.setItem('xenovoya:play-session:v1', JSON.stringify({
      token: 'opaque-token', playerIdentity: '0x0000000000000000000000000000000000000001', expiresAt: '2099-01-01T00:00:00.000Z',
    }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ operationId: 'g1_opaque', status: 'processing' }) });
    vi.stubGlobal('fetch', fetchMock);
    await submitGameCommand('join', { gameId: '42' });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.authorization).toBe('Bearer opaque-token');
    expect(options.body).toBe(JSON.stringify({ gameId: '42' }));
  });

  it('proxies game-state reads through the same authenticated boundary', async () => {
    window.localStorage.setItem('xenovoya:play-session:v1', JSON.stringify({
      token: 'opaque-token', playerIdentity: '0x0000000000000000000000000000000000000001', expiresAt: '2099-01-01T00:00:00.000Z',
    }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: '0xaa' }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(requestGameState('eth_blockNumber', [])).resolves.toBe('0xaa');
    expect(fetchMock.mock.calls[0][0]).toBe('/v1/game/state');
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe('Bearer opaque-token');
  });
});
