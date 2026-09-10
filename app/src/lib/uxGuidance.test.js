import { describe, expect, it } from 'vitest';
import { Action } from './constants';
import { getActionBlockReason } from './uxGuidance';

describe('departure action guidance', () => {
  it('allows an empty-handed departure from landing', () => {
    expect(getActionBlockReason({
      action: Action.FLEE,
      departPressure: { readiness: { canFlee: true } },
    })).toBe('');
  });

  it('blocks departure away from landing with the recovery instruction', () => {
    expect(getActionBlockReason({
      action: Action.FLEE,
      departPressure: {
        readiness: {
          canFlee: false,
          body: 'Landing is 2 away; depart is not ready yet.',
        },
      },
    })).toMatch(/Landing is 2 away/);
  });
});
