import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExpeditionInputController } from './useExpeditionInputController';

describe('useExpeditionInputController', () => {
  beforeEach(() => {
    window.requestAnimationFrame = (cb) => window.setTimeout(cb, 16);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: vi.fn(() => []),
    });
  });

  it('commits valid intent and emits commit feedback', () => {
    const onCommit = vi.fn();
    const emitFeedback = vi.fn();
    const { result } = renderHook(() => useExpeditionInputController({
      columns: 3,
      rows: 3,
      allHexes: [{ alias: '0,0' }, { alias: '1,0' }],
      currentLocation: '0,0',
      intentAlias: '1,0',
      selectedPath: [],
      canChooseTile: () => true,
      onCommit,
      emitFeedback,
    }));

    act(() => result.current.commitIntent('1,0', 'keys'));

    expect(onCommit).toHaveBeenCalledWith('1,0');
    expect(emitFeedback).toHaveBeenCalledWith('commit', 'keys');
    expect(result.current.commitCount).toBe(1);
  });

  it('pulses invalid state for rejected intent', () => {
    const onCommit = vi.fn();
    const emitFeedback = vi.fn();
    const { result } = renderHook(() => useExpeditionInputController({
      columns: 3,
      rows: 3,
      allHexes: [{ alias: '0,0' }],
      currentLocation: '0,0',
      intentAlias: '2,2',
      selectedPath: [],
      canChooseTile: () => false,
      onCommit,
      emitFeedback,
    }));

    act(() => result.current.commitIntent('2,2', 'keys'));

    expect(onCommit).not.toHaveBeenCalled();
    expect(emitFeedback).toHaveBeenCalledWith('invalid', 'keys');
    expect(result.current.invalidCount).toBe(1);
  });

  it('backtracks an existing route step', () => {
    const onBacktrack = vi.fn();
    const { result } = renderHook(() => useExpeditionInputController({
      columns: 3,
      rows: 3,
      allHexes: [{ alias: '0,0' }, { alias: '1,0' }],
      currentLocation: '0,0',
      intentAlias: '1,0',
      selectedPath: ['1,0'],
      canChooseTile: () => true,
      onBacktrack,
    }));

    act(() => result.current.backtrackIntent('keys'));

    expect(onBacktrack).toHaveBeenCalledTimes(1);
    expect(result.current.backtrackCount).toBe(1);
  });
});
