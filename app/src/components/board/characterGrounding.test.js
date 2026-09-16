import { describe, expect, it } from 'vitest';
import { characterGroundingFor } from './characterGrounding';

describe('character grounding', () => {
  it('uses state-specific transparent bottom padding', () => {
    expect(characterGroundingFor('signal-cartographer', 'neutral').bottomPaddingRatio).toBeCloseTo(52 / 1024);
    expect(characterGroundingFor('signal-cartographer', 'moving').bottomPaddingRatio).toBe(0);
    expect(characterGroundingFor('routekeeper', 'strained').bottomPaddingRatio).toBeCloseTo(70 / 1024);
  });

  it('widens low-pose shadows and stretches motion shadows', () => {
    expect(characterGroundingFor('field-mender', 'downed').pose).toBe('low');
    expect(characterGroundingFor('relic-tender', 'escaping').pose).toBe('motion');
    expect(characterGroundingFor('routekeeper', 'neutral').pose).toBe('standing');
  });
});
