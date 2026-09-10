import { describe, expect, it } from 'vitest';
import { initialSessionState, normalizeSessionState, sessionReducer } from './sessionState';
import { checksum, loadPendingTransactions, savePendingTransaction, settlePendingTransaction } from './sessionPersistence';

describe('player session lifecycle', () => {
  it('moves through hydration, active play, backgrounding, and recovery without claiming the world paused', () => {
    let state = sessionReducer(initialSessionState, { type: 'BEGIN_GAME', gameId: '42', online: true });
    expect(state.phase).toBe('hydrating');
    state = sessionReducer(state, { type: 'HYDRATED', started: true });
    expect(state.phase).toBe('active');
    state = sessionReducer(state, { type: 'PAUSE' });
    expect(state.softPaused).toBe(true);
    state = sessionReducer(state, { type: 'HIDDEN' });
    expect(state.phase).toBe('backgrounded');
    state = sessionReducer(state, { type: 'ONLINE' });
    expect(state.phase).toBe('reconnecting');
  });

  it('normalizes corrupt lifecycle values and caps pending transaction history', () => {
    const state = normalizeSessionState({ phase: 'impossible', pendingTransactions: Array.from({ length: 30 }, (_, index) => ({ hash: String(index) })) });
    expect(state.phase).toBe('booting');
    expect(state.pendingTransactions).toHaveLength(20);
  });

  it('isolates a restored game when the connected wallet changes', () => {
    const restored = sessionReducer(initialSessionState, {
      type: 'RESTORE',
      value: { wallet: '0xaaa', activeGameId: '42', phase: 'active' },
      wallet: '0xbbb',
      online: true,
      visible: true,
    });
    expect(restored.wallet).toBe('0xbbb');
    expect(restored.activeGameId).toBeNull();
    expect(restored.phase).toBe('resumed');
  });

  it('checksums snapshots and persists recoverable transactions', () => {
    const storage = { value: null, getItem: () => storage.value, setItem: (_key, value) => { storage.value = value; } };
    expect(checksum({ gameId: '42' })).toMatch(/^[a-f0-9]{8}$/);
    savePendingTransaction({ hash: '0xabc', status: 'confirming' }, storage);
    expect(loadPendingTransactions(storage)[0].status).toBe('confirming');
    settlePendingTransaction('0xabc', 'confirmed', storage);
    expect(loadPendingTransactions(storage)[0].status).toBe('confirmed');
  });
});
