import { describe, expect, it, vi } from 'vitest';
import { readContractsInParallel } from './useContractReads';

describe('readContractsInParallel', () => {
  it('returns successful reads in contract order', async () => {
    const readContract = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(3n);

    await expect(readContractsInParallel({ readContract }, [
      { functionName: 'gameStarted' },
      { functionName: 'currentPhase' },
    ])).resolves.toEqual([
      { result: true, status: 'success' },
      { result: 3n, status: 'success' },
    ]);
  });

  it('contains individual failures when partial results are allowed', async () => {
    const failure = new Error('read failed');
    const readContract = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce('ready');

    await expect(readContractsInParallel({ readContract }, [{}, {}])).resolves.toEqual([
      { error: failure, result: undefined, status: 'failure' },
      { result: 'ready', status: 'success' },
    ]);
  });

  it('rejects immediately when partial failures are disabled', async () => {
    const failure = new Error('read failed');
    const readContract = vi.fn().mockRejectedValue(failure);

    await expect(readContractsInParallel({ readContract }, [{}], false)).rejects.toBe(failure);
  });
});
