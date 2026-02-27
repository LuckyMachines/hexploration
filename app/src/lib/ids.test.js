import { describe, expect, it } from 'vitest';
import { parseUintId, safeUintId } from './ids';

describe('ids utilities', () => {
  it('parses uint-like values', () => {
    expect(parseUintId('42')).toBe(42n);
    expect(parseUintId(3)).toBe(3n);
    expect(parseUintId(7n)).toBe(7n);
  });

  it('returns null for invalid/negative values', () => {
    expect(parseUintId('abc')).toBeNull();
    expect(parseUintId('-1')).toBeNull();
    expect(parseUintId(undefined)).toBeNull();
  });

  it('falls back with safeUintId', () => {
    expect(safeUintId(parseUintId('8'))).toBe(8n);
    expect(safeUintId(parseUintId('abc'))).toBe(0n);
    expect(safeUintId(parseUintId('abc'), 99n)).toBe(99n);
  });
});
