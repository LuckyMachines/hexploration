import { describe, expect, it } from 'vitest';
import { analyticsEnabled, trackRetentionEvent } from './analytics';

describe('analytics', () => {
  it('stays disabled without explicit public configuration', () => expect(analyticsEnabled()).toBe(false));
  it('does not emit without a configured browser client', () => expect(trackRetentionEvent('starter_opened', { role: 'scout' })).toBe(false));
});
