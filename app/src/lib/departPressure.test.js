import { describe, expect, it } from 'vitest';
import {
  departPressureDeltaForAction,
  deriveDepartPressure,
  escapeReadinessFor,
  pressureBandFor,
  recoveredValueForInventory,
  routeDistance,
} from './departPressure';

describe('departPressure', () => {
  it('measures distance and pressure bands', () => {
    expect(routeDistance('0,0', '2,1')).toBe(2);
    expect(pressureBandFor(12).id).toBe('stable');
    expect(pressureBandFor(82).id).toBe('collapse');
  });

  it('counts recovered value from equipped and inactive inventory', () => {
    expect(recoveredValueForInventory(
      { artifact: 'Sun Compass', relic: '', leftHandItem: 'Rope' },
      { itemBalances: [1, 2] },
    )).toBe(5);
  });

  it('derives a low-pressure clean escape at landing with value', () => {
    const pressure = deriveDepartPressure({
      location: '0,0',
      landingSite: '0,0',
      stats: { movement: 4, agility: 4, dexterity: 4 },
      activeInventory: { artifact: 'Sun Compass' },
      events: [],
    });

    expect(pressure.readiness.canFlee).toBe(true);
    expect(pressure.escapeQuality).toBe('clean');
    expect(pressure.atLanding).toBe(true);
  });

  it('flags collapse risk when far from landing with value and weak crew', () => {
    const pressure = deriveDepartPressure({
      location: '5,5',
      landingSite: '0,0',
      stats: { movement: 1, agility: 1, dexterity: 2 },
      activeInventory: { artifact: 'Glass Idol' },
      events: Array.from({ length: 6 }),
      crew: [{ isActive: true }, { isActive: false }],
    });

    expect(pressure.pressure).toBeGreaterThanOrEqual(75);
    expect(pressure.band.id).toBe('collapse');
    expect(pressure.readiness.canFlee).toBe(false);
  });

  it('explains escape requirements directly', () => {
    expect(escapeReadinessFor({ atLanding: false, recoveredValue: 1, distanceToLanding: 2 }).missing).toContain('landing');
    expect(escapeReadinessFor({ atLanding: true, recoveredValue: 0, pressure: 10 }).missing).toContain('value');
    expect(escapeReadinessFor({ atLanding: true, recoveredValue: 1, pressure: 90 }).label).toBe('High-risk escape');
  });

  it('changes pressure by action intent', () => {
    expect(departPressureDeltaForAction('dig', { digStreak: 2 })).toBeGreaterThan(10);
    expect(departPressureDeltaForAction('rest')).toBeLessThan(0);
    expect(departPressureDeltaForAction('move', { movingTowardLanding: true })).toBeLessThan(0);
    expect(departPressureDeltaForAction('flee', { hasRecoveredValue: true })).toBeLessThan(0);
  });
});
