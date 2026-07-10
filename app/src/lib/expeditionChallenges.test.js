import { describe, expect, it } from 'vitest';
import { deriveNextChallenge } from './expeditionChallenges';

const baseMemory = {
  entries: [],
  badges: [],
};

function entry(overrides = {}) {
  return {
    id: 'memory-1',
    source: 'public-run',
    scenarioId: 'solo-artifact-hunt',
    seed: 'abc',
    title: 'Memory',
    outcome: 'escaped',
    score: 500,
    escapeCostLevel: 'clean',
    escapeCostLabel: 'Clean',
    finalPressure: 34,
    artifacts: 1,
    survivors: 1,
    crew: 1,
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('expeditionChallenges', () => {
  it('creates a first-run challenge when no memory exists', () => {
    const challenge = deriveNextChallenge(baseMemory);
    expect(challenge.id).toBe('first-memory');
    expect(challenge.path).toContain('/play');
  });

  it('asks failed value runs to bring the warning home', () => {
    const challenge = deriveNextChallenge({ entries: [entry({ outcome: 'route-collapsed-with-value', artifacts: 2 })] });
    expect(challenge.title).toMatch(/warning/i);
    expect(challenge.target).toMatch(/2/);
  });

  it('asks costly escapes to reduce departure cost', () => {
    const challenge = deriveNextChallenge({ entries: [entry({ escapeCostLevel: 'crew-risk', escapeCostLabel: 'Crew at risk', finalPressure: 86 })] });
    expect(challenge.title).toMatch(/departure cost/i);
    expect(challenge.metric).toBe('pressure-under');
  });

  it('asks empty clean escapes to carry value out', () => {
    const challenge = deriveNextChallenge({ entries: [entry({ artifacts: 0 })] });
    expect(challenge.title).toMatch(/value/i);
    expect(challenge.targetValue).toBe(1);
  });

  it('turns strong clean runs into score benchmarks', () => {
    const challenge = deriveNextChallenge({ entries: [entry({ score: 720, finalPressure: 40, artifacts: 2 })] });
    expect(challenge.target).toContain('745');
    expect(challenge.path).toContain('rival');
  });
});
