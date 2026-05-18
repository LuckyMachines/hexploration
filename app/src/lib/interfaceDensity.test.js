import { describe, expect, it } from 'vitest';
import { deriveInterfaceDensity, InterfaceDensity, overlayVisibilityFromDensity } from './interfaceDensity';
import { TurnState } from './turnState';

describe('interfaceDensity', () => {
  it('keeps idle planning quiet', () => {
    const density = deriveInterfaceDensity({
      turnState: { state: TurnState.PLANNING },
      routeStatus: { isValid: true },
      movePath: [],
      boardInput: { inputCadence: 'idle' },
    });

    expect(density.level).toBe(InterfaceDensity.QUIET);
    expect(density.details.actionContextOpen).toBe(false);
  });

  it('focuses the UI when the player is planning a route', () => {
    const density = deriveInterfaceDensity({
      turnState: { state: TurnState.PLANNING },
      routeStatus: { isValid: true },
      movePath: ['1,0'],
      boardInput: { inputCadence: 'active' },
    });

    expect(density.level).toBe(InterfaceDensity.FOCUSED);
    expect(density.hasRouteIntent).toBe(true);
  });

  it('raises high alert for invalid route or redline risk', () => {
    const invalid = deriveInterfaceDensity({
      routeStatus: { isValid: false },
      movePath: ['1,0'],
    });
    const redline = deriveInterfaceDensity({
      routeStatus: { isValid: true },
      funTelemetry: { risk: { level: 'redline' } },
    });

    expect(invalid.level).toBe(InterfaceDensity.HIGH_ALERT);
    expect(redline.level).toBe(InterfaceDensity.HIGH_ALERT);
    expect(invalid.details.actionContextOpen).toBe(true);
  });

  it('keeps dense board readouts hidden in quiet mode', () => {
    const density = deriveInterfaceDensity({
      turnState: { state: TurnState.PLANNING },
      routeStatus: { isValid: true },
    });
    const visibility = overlayVisibilityFromDensity({
      density,
      currentLocation: '0,0',
      intentAlias: '0,0',
    });

    expect(visibility.intentCursor).toBe(false);
    expect(visibility.denseReadouts).toBe(false);
    expect(visibility.expressiveText).toBe(false);
  });

  it('shows localized readouts for focused controller planning', () => {
    const density = deriveInterfaceDensity({
      routeStatus: { isValid: true },
      movePath: ['1,0'],
      boardInput: { inputCadence: 'active' },
    });
    const visibility = overlayVisibilityFromDensity({
      density,
      inputMode: 'pad',
      currentLocation: '0,0',
      intentAlias: '1,0',
    });

    expect(visibility.intentCursor).toBe(true);
    expect(visibility.denseReadouts).toBe(true);
    expect(visibility.inputReadout).toBe(true);
  });
});

