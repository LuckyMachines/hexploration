import { describe, expect, it } from 'vitest';
import { createGuestExpedition, departGuestExpedition } from './guestExpedition';
import { memoryFromGuestExpedition } from './guestExpeditionMemory';

describe('guest expedition memory', () => {
  it('creates a stable shared memory entry from a completed guest expedition', () => {
    const completed = departGuestExpedition({
      ...createGuestExpedition(),
      currentLocation: '2,2',
      turns: 6,
      pressure: 61,
      relics: 1,
      collectedAliases: ['0,0'],
      resolvedEncounters: ['echo-fork'],
      routeHistory: ['2,2', '1,1', '0,1', '0,0', '0,1', '1,1', '2,2'],
    }, '2026-09-13T12:00:00.000Z');
    const memory = memoryFromGuestExpedition(completed);

    expect(memory).toMatchObject({
      id: 'guest-2026-09-13T12:00:00.000Z',
      source: 'guest-expedition',
      outcome: 'escaped',
      artifacts: 1,
      artifactNames: ['Tideglass Cradle'],
      survivors: 2,
      crew: 2,
    });
    expect(memory.score).toBeGreaterThan(0);
    expect(memory.badges).toEqual(expect.arrayContaining(['Escaped', 'Artifact Lift', 'Everybody Out']));
  });

  it('does not create a trophy before the expedition ends', () => {
    expect(memoryFromGuestExpedition(createGuestExpedition())).toBeNull();
  });
});
