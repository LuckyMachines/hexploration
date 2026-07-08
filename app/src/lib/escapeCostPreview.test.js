import { describe, expect, it } from 'vitest';
import { deriveDepartPressure } from './departPressure';
import {
  bestMitigationForPreview,
  deriveEscapeCostPreview,
  ESCAPE_COST_LEVELS,
  MITIGATION_IDS,
  selectAtRiskItem,
  selectAtRiskPlayer,
} from './escapeCostPreview';
import { Action } from './constants';

function pressure(overrides = {}) {
  return deriveDepartPressure({
    location: '0,0',
    landingSite: '0,0',
    stats: { movement: 4, agility: 4, dexterity: 4 },
    activeInventory: { artifact: 'Sun Compass' },
    events: [],
    ...overrides,
  });
}

describe('escapeCostPreview', () => {
  it('selects the first recovered value at risk', () => {
    expect(selectAtRiskItem({
      artifact: '',
      relic: 'Glass Idol',
      leftHandItem: 'Rope',
    })).toBe('Glass Idol');
  });

  it('selects the weakest player deterministically', () => {
    const target = selectAtRiskPlayer([
      { playerID: 2, movement: 4, agility: 4, dexterity: 4 },
      { playerID: 1, movement: 1, agility: 2, dexterity: 2 },
    ]);

    expect(target.label).toBe('P1');
  });

  it('returns clean preview for stable ready escape', () => {
    const preview = deriveEscapeCostPreview({
      departPressure: pressure(),
      activeInventory: { artifact: 'Sun Compass' },
    });

    expect(preview.level).toBe(ESCAPE_COST_LEVELS.CLEAN);
    expect(preview.headline).toMatch(/No cost/i);
    expect(preview.mitigations.map((item) => item.id)).toContain(MITIGATION_IDS.DEPART_NOW);
  });

  it('returns close preview for stretching pressure', () => {
    const preview = deriveEscapeCostPreview({
      departPressure: { ...pressure(), pressure: 36, band: { id: 'stretching', label: 'Stretching Route' } },
      activeInventory: { artifact: 'Sun Compass' },
    });

    expect(preview.level).toBe(ESCAPE_COST_LEVELS.CLOSE);
    expect(preview.bestMitigation.action).toBe(Action.FLEE);
  });

  it('returns artifact risk for closing pressure with value', () => {
    const preview = deriveEscapeCostPreview({
      departPressure: { ...pressure(), pressure: 62, band: { id: 'closing', label: 'Closing Route' } },
      activeInventory: { artifact: 'Glass Idol' },
    });

    expect(preview.level).toBe(ESCAPE_COST_LEVELS.ARTIFACT_RISK);
    expect(preview.headline).toContain('Glass Idol');
    expect(preview.mitigations.some((item) => item.id === MITIGATION_IDS.SECURE_ARTIFACT)).toBe(true);
  });

  it('returns crew risk for collapse pressure when escape is ready', () => {
    const preview = deriveEscapeCostPreview({
      departPressure: { ...pressure(), pressure: 84, band: { id: 'collapse', label: 'Collapse Risk' } },
      activeInventory: { artifact: 'Glass Idol' },
      players: [{ playerID: 3, movement: 1, agility: 1, dexterity: 2 }],
    });

    expect(preview.level).toBe(ESCAPE_COST_LEVELS.CREW_RISK);
    expect(preview.headline).toContain('P3');
    expect(preview.mitigations.some((item) => item.id === MITIGATION_IDS.HELP_WEAKEST)).toBe(true);
  });

  it('returns route collapse when collapse pressure is not escape-ready', () => {
    const preview = deriveEscapeCostPreview({
      departPressure: pressure({
        location: '4,4',
        landingSite: '0,0',
        stats: { movement: 1, agility: 1, dexterity: 1 },
        events: Array.from({ length: 8 }),
      }),
      activeInventory: { artifact: 'Glass Idol' },
    });

    expect(preview.level).toBe(ESCAPE_COST_LEVELS.ROUTE_COLLAPSE);
    expect(preview.mitigations.some((item) => item.id === MITIGATION_IDS.STABILIZE_ROUTE)).toBe(true);
  });

  it('returns not-ready when value is missing at landing', () => {
    const preview = deriveEscapeCostPreview({
      departPressure: pressure({ activeInventory: {} }),
      activeInventory: {},
    });

    expect(preview.level).toBe(ESCAPE_COST_LEVELS.NOT_READY);
    expect(preview.costType).toBe('not-ready');
    expect(preview.mitigations.some((item) => item.id === MITIGATION_IDS.RECOVER_VALUE)).toBe(true);
  });

  it('marks return to landing available only with distance and movement', () => {
    const preview = deriveEscapeCostPreview({
      departPressure: pressure({
        location: '3,3',
        landingSite: '0,0',
        activeInventory: { artifact: 'Sun Compass' },
      }),
      activeInventory: { artifact: 'Sun Compass' },
      location: '3,3',
      landingSite: '0,0',
      movement: 2,
    });

    const mitigation = preview.mitigations.find((item) => item.id === MITIGATION_IDS.RETURN_TO_LANDING);
    expect(mitigation.available).toBe(true);
    expect(mitigation.action).toBe(Action.MOVE);
  });

  it('raises stop digging when severe cost is active and Dig is selected', () => {
    const preview = deriveEscapeCostPreview({
      departPressure: { ...pressure(), pressure: 62, band: { id: 'closing', label: 'Closing Route' } },
      activeInventory: { artifact: 'Glass Idol' },
      activeTab: Action.DIG,
    });

    expect(bestMitigationForPreview(preview, { activeTab: Action.DIG }).id).toBe(MITIGATION_IDS.STOP_DIGGING);
  });

  it('uses a deterministic fallback when direct options are unavailable', () => {
    const preview = deriveEscapeCostPreview({
      departPressure: {
        ...pressure({ activeInventory: {} }),
        readiness: { canFlee: false, body: 'Missing value.' },
      },
      activeInventory: {},
      movement: 0,
    });

    expect(preview.bestMitigation).toBeTruthy();
    expect(preview.bestMitigation.id).toBe(MITIGATION_IDS.RECOVER_VALUE);
  });
});
