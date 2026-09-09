import { describe, expect, it } from 'vitest';
import { assignExperiment, validateExperiment } from './experiments';

const experiment = {
  id: 'test-copy',
  status: 'running',
  environments: ['test'],
  allocationPercent: 100,
  variants: [{ id: 'control', weight: 50 }, { id: 'clearer', weight: 50 }],
};

describe('experiments', () => {
  it('assigns deterministically and persists the assignment', () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const first = assignExperiment(experiment, { storage, seed: 'participant-a', environment: 'test' });
    const second = assignExperiment(experiment, { storage, seed: 'participant-b', environment: 'test' });
    expect(first.enrolled).toBe(true);
    expect(second.variant).toBe(first.variant);
    expect(['control', 'clearer']).toContain(first.variant);
  });

  it('keeps planned experiments on control and validates unsafe configs', () => {
    expect(assignExperiment({ ...experiment, status: 'planned' }, { seed: 'a', environment: 'test' })).toMatchObject({ variant: 'control', enrolled: false });
    expect(validateExperiment({ ...experiment, variants: [{ id: 'a', weight: 10 }, { id: 'b', weight: 10 }] }).ok).toBe(false);
  });
});
