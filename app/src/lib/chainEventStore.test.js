import { describe, expect, it } from 'vitest';
import { mapChainLog, parseEventCache, reconcileChainEvents, serializeEventCache } from './chainEventStore';

describe('chain event store', () => {
  it('serializes bigint event arguments for durable observer caches', () => {
    const event = mapChainLog({ eventName: 'ActionSubmit', args: { gameID: 7n }, blockNumber: 10n, logIndex: 1, transactionHash: '0xabc' });
    expect(event.args.gameID).toBe('7');
    expect(parseEventCache(serializeEventCache([event], 8)).events[0].args.gameID).toBe('7');
  });

  it('removes orphaned logs and replaces a canonical block range', () => {
    const original = mapChainLog({ eventName: 'ActionSubmit', blockNumber: 20n, logIndex: 0, transactionHash: '0xold' });
    const removed = { ...original, removed: true };
    expect(reconcileChainEvents([original], [removed])).toEqual([]);

    const replacement = mapChainLog({ eventName: 'ActionSubmit', blockNumber: 20n, logIndex: 0, transactionHash: '0xnew' });
    expect(reconcileChainEvents([original], [replacement], { canonicalFromBlock: 18 })[0].transactionHash).toBe('0xnew');

    const unconfirmed = mapChainLog({ eventName: 'GameOver', blockNumber: 25n, logIndex: 0, transactionHash: '0xfuture' });
    expect(reconcileChainEvents([original, unconfirmed], [replacement], { canonicalFromBlock: 18, canonicalToBlock: 22 }).map((event) => event.transactionHash)).toContain('0xfuture');
  });
});
