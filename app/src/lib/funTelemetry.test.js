import { describe, expect, it } from 'vitest';
import { Action } from './constants';
import { buildActionDrama, buildFunTelemetry } from './funTelemetry';

describe('funTelemetry', () => {
  it('marks invalid routes as rattled redline fun state', () => {
    const telemetry = buildFunTelemetry({
      activeTab: Action.MOVE,
      movement: 2,
      movePath: ['1,0', '2,0'],
      routeStatus: {
        isValid: false,
        invalidReason: 'Route breaks adjacency.',
        label: 'Broken route',
      },
      stats: { movement: 1, agility: 1, dexterity: 3 },
      boardInput: { inputMode: 'keyboard', inputCadence: 'urgent', invalidCount: 1 },
      location: '0,0',
    });

    expect(telemetry.mood.key).toBe('rattled');
    expect(telemetry.nearMiss.active).toBe(true);
    expect(telemetry.risk.score).toBeGreaterThan(70);
    expect(telemetry.preview.label).toBe('Recover');
  });

  it('builds submit drama and journal entries for a planned dig', () => {
    const telemetry = buildFunTelemetry({
      activeTab: Action.DIG,
      movement: 3,
      routeStatus: { isValid: true, label: 'No route' },
      stats: { movement: 3, agility: 3, dexterity: 1 },
      events: [{ name: 'ActionSubmit', args: { playerID: 1 }, key: 'event-1' }],
      location: '2,1',
    });
    const drama = buildActionDrama(Action.DIG, {
      movement: 3,
      routeStatus: { isValid: true, label: 'No route' },
      stats: { movement: 3, agility: 3, dexterity: 1 },
      location: '2,1',
    });

    expect(telemetry.rareBeat.label).toBe('Lucky Find');
    expect(telemetry.journalEntries.length).toBeGreaterThan(1);
    expect(drama.receipt).toContain('Dig locked');
    expect(drama.cue).toBe('bright ping');
  });
});
