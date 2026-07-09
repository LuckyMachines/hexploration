import { describe, expect, it } from 'vitest';
import { deriveExpeditionArc, EXPEDITION_ARC_IDS } from './expeditionArc';

describe('expeditionArc', () => {
  it('uses Survey as the fallback opening chapter', () => {
    const arc = deriveExpeditionArc({
      departPressure: { pressure: 12, routeStability: 88, recoveredValue: 0, currentDistanceToLanding: 4, readiness: { canFlee: false } },
      revealedCount: 2,
    });

    expect(arc.id).toBe(EXPEDITION_ARC_IDS.SURVEY);
    expect(arc.reasons).toContain('survey-needed');
  });

  it('enters Greed Window from pressure range', () => {
    const arc = deriveExpeditionArc({
      departPressure: { pressure: 44, routeStability: 56, recoveredValue: 0, currentDistanceToLanding: 3, readiness: { canFlee: false } },
      revealedCount: 5,
    });

    expect(arc.id).toBe(EXPEDITION_ARC_IDS.GREED_WINDOW);
    expect(arc.reasons).toContain('pressure-mid');
  });

  it('enters Greed Window from value or reveal trait opportunity', () => {
    const arc = deriveExpeditionArc({
      departPressure: { pressure: 20, routeStability: 80, recoveredValue: 0, currentDistanceToLanding: 3, readiness: { canFlee: false } },
      traitPreview: { trait: { id: 'cache', category: 'value' } },
      revealedCount: 5,
    });

    expect(arc.id).toBe(EXPEDITION_ARC_IDS.GREED_WINDOW);
    expect(arc.reasons).toContain('trait-opportunity');
  });

  it('enters Departure Window from value plus near landing', () => {
    const arc = deriveExpeditionArc({
      departPressure: { pressure: 58, routeStability: 62, recoveredValue: 1, currentDistanceToLanding: 2, readiness: { canFlee: false } },
      escapeCostPreview: { costType: 'close' },
      revealedCount: 7,
    });

    expect(arc.id).toBe(EXPEDITION_ARC_IDS.DEPARTURE_WINDOW);
    expect(arc.reasons).toContain('value-recovered');
    expect(arc.reasons).toContain('near-landing');
  });

  it('enters Redline from pressure', () => {
    const arc = deriveExpeditionArc({
      departPressure: { pressure: 76, routeStability: 24, recoveredValue: 0, currentDistanceToLanding: 3, readiness: { canFlee: false } },
      revealedCount: 5,
    });

    expect(arc.id).toBe(EXPEDITION_ARC_IDS.REDLINE);
    expect(arc.reasons).toContain('pressure-high');
  });

  it('enters Redline from crew-risk cost type', () => {
    const arc = deriveExpeditionArc({
      departPressure: { pressure: 52, routeStability: 48, recoveredValue: 1, currentDistanceToLanding: 3, readiness: { canFlee: false } },
      escapeCostPreview: { costType: 'crew-risk' },
      revealedCount: 6,
    });

    expect(arc.id).toBe(EXPEDITION_ARC_IDS.REDLINE);
    expect(arc.reasons).toContain('cost-risk');
  });

  it('enters Final Call from landing with recovered value', () => {
    const arc = deriveExpeditionArc({
      departPressure: { pressure: 40, routeStability: 60, recoveredValue: 1, currentDistanceToLanding: 0, readiness: { canFlee: true } },
      escapeCostPreview: { costType: 'clean', canEscape: true },
      revealedCount: 8,
    });

    expect(arc.id).toBe(EXPEDITION_ARC_IDS.FINAL_CALL);
    expect(arc.reasons).toContain('at-landing');
  });

  it('prioritizes Final Call over Greed Window', () => {
    const arc = deriveExpeditionArc({
      departPressure: { pressure: 88, routeStability: 12, recoveredValue: 0, currentDistanceToLanding: 4, readiness: { canFlee: false } },
      traitPreview: { trait: { id: 'relic-vein', category: 'value' } },
      revealedCount: 6,
    });

    expect(arc.id).toBe(EXPEDITION_ARC_IDS.FINAL_CALL);
  });

  it('prioritizes Redline over Departure Window', () => {
    const arc = deriveExpeditionArc({
      departPressure: { pressure: 72, routeStability: 28, recoveredValue: 1, currentDistanceToLanding: 1, readiness: { canFlee: false } },
      escapeCostPreview: { costType: 'close' },
      revealedCount: 8,
    });

    expect(arc.id).toBe(EXPEDITION_ARC_IDS.REDLINE);
  });

  it('clamps progress values', () => {
    const arc = deriveExpeditionArc({
      departPressure: { pressure: 140, routeStability: -20, recoveredValue: 4, currentDistanceToLanding: 0, readiness: { canFlee: true } },
      revealedCount: 99,
    });

    expect(Object.values(arc.progress).every((value) => value >= 0 && value <= 100)).toBe(true);
  });
});
