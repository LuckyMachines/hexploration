import { describe, expect, it } from 'vitest';
import { Action } from './constants';
import { AFTERMATH_CATEGORIES, actionAftermathCopy, cardAftermathTone, deriveTurnAftermath } from './turnAftermath';

describe('turnAftermath', () => {
  it('returns null for empty resolution data', () => {
    expect(deriveTurnAftermath()).toBeNull();
  });

  it('classifies stat losses as bad luck', () => {
    const moment = deriveTurnAftermath({
      playerIDs: [1],
      statUpdates: [[-1, 0, -2]],
      cardsDrawn: ['Bitter Weather'],
      cardResults: ['Lost movement and dexterity.'],
    });

    expect(moment.category).toBe(AFTERMATH_CATEGORIES.BAD_LUCK);
    expect(moment.tone).toBe('red');
    expect(moment.receipts[0].label).toBe('Hurt');
  });

  it('classifies inventory value as artifact payoff', () => {
    const moment = deriveTurnAftermath({
      playerActions: [{ playerID: 1, currentAction: Action.DIG }],
      playerIDs: [1],
      inventoryChanges: [['Sun Relic', '', '']],
      escapeCostPreview: { headline: 'Sun Relic at risk', costType: 'artifact-risk', label: 'Artifact at risk' },
    });

    expect(moment.category).toBe(AFTERMATH_CATEGORIES.ARTIFACT_PAYOFF);
    expect(moment.summary).toMatch(/Sun Relic/);
  });

  it('classifies pressure spikes from forecast data', () => {
    const moment = deriveTurnAftermath({
      previousDepartPressure: 42,
      departPressure: { pressure: 60, band: { label: 'Closing Route' }, readiness: { label: 'Not ready' } },
      escapeCostPreview: { headline: 'Recovered value at risk', costType: 'artifact-risk', label: 'Artifact at risk' },
    });

    expect(moment.category).toBe(AFTERMATH_CATEGORIES.PRESSURE_SPIKE);
    expect(moment.pressureDelta).toBe(18);
  });

  it('classifies route saves when pressure falls', () => {
    const moment = deriveTurnAftermath({
      previousDepartPressure: 68,
      departPressure: { pressure: 56, traitRoute: 9, band: { label: 'Closing Route' }, readiness: { label: 'Route improving' } },
    });

    expect(moment.category).toBe(AFTERMATH_CATEGORIES.ROUTE_SAVE);
    expect(moment.tone).toBe('blue');
  });

  it('prioritizes trait payoff over generic clean turns', () => {
    const moment = deriveTurnAftermath({
      playerActions: [{ playerID: 1, currentAction: Action.MOVE }],
      traitPreview: {
        trait: { id: 'old-trail', label: 'Old Trail' },
        effect: { matched: true, pressureDelta: -7, routeDelta: 9 },
        preferredActionLabel: 'Move',
        body: 'Old Trail makes the route home feel cheaper.',
      },
      statUpdates: [[1, 0, 0]],
    });

    expect(moment.category).toBe(AFTERMATH_CATEGORIES.TRAIT_PAYOFF);
    expect(moment.receipts.some((item) => item.value === 'Old Trail')).toBe(true);
  });

  it('prioritizes trait warning over pressure forecast', () => {
    const moment = deriveTurnAftermath({
      departPressure: { pressure: 84, band: { label: 'Collapse Risk' }, readiness: { label: 'Costly' } },
      escapeCostPreview: { headline: 'Route collapse projected', costType: 'route-collapse', label: 'Route collapse' },
      traitPreview: {
        trait: { id: 'unstable-ground', label: 'Unstable Ground' },
        effect: { warning: true, pressureDelta: 10, routeDelta: -8 },
        warning: 'Unstable Ground made this route expensive.',
        body: 'Unstable Ground made this route expensive.',
      },
    });

    expect(moment.category).toBe(AFTERMATH_CATEGORIES.TRAIT_WARNING);
    expect(moment.score).toBeGreaterThan(90);
  });

  it('uses highest emotional score', () => {
    const moment = deriveTurnAftermath({
      playerActions: [{ playerID: 1, currentAction: Action.REST }],
      playerIDs: [1],
      statUpdates: [[1, 1, 0]],
      previousDepartPressure: 50,
      departPressure: { pressure: 44, band: { label: 'Stretching Route' }, readiness: { label: 'Not ready' } },
    });

    expect([AFTERMATH_CATEGORIES.ROUTE_SAVE, AFTERMATH_CATEGORIES.CREW_SAVE]).toContain(moment.category);
    expect(moment.receipts.length).toBeGreaterThan(0);
  });

  it('provides action and card copy helpers', () => {
    expect(actionAftermathCopy(Action.HELP)).toMatch(/teammate/);
    expect(cardAftermathTone({ cardResult: 'Lost movement', statUpdate: [-1, 0, 0] })).toBe('red');
    expect(cardAftermathTone({ inventoryChange: ['Relic', '', ''] })).toBe('gold');
  });
});
