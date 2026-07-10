import { describe, expect, it } from 'vitest';
import { buildExpeditionFingerprint } from './expeditionFingerprint';

function run(seed = 'fingerprint-seed') {
  return {
    seed,
    turn: 1,
    scenario: { id: 'solo-artifact-hunt' },
    state: { artifacts: [], departPressure: 30, danger: 24, routeStability: 70, distance: 3 },
  };
}

function event(overrides = {}) {
  return {
    turn: 1,
    action: 'move',
    before: { artifacts: [], departPressure: 28, danger: 22, routeStability: 72, distance: 3 },
    after: { artifacts: [], departPressure: 32, danger: 25, routeStability: 68, distance: 2, revealed: 2 },
    delta: { revealed: 1, departPressure: 4, artifacts: 0, distance: -1 },
    ...overrides,
  };
}

describe('expeditionFingerprint', () => {
  it('is deterministic for the same run state', () => {
    const first = buildExpeditionFingerprint({ run: run('same'), event: event() });
    const second = buildExpeditionFingerprint({ run: run('same'), event: event() });
    expect(first).toEqual(second);
    expect(first.title).toBeTruthy();
  });

  it('varies across seeds or state', () => {
    const first = buildExpeditionFingerprint({ run: run('alpha'), event: event() });
    const second = buildExpeditionFingerprint({ run: run('bravo'), event: event({ after: { ...event().after, distance: 4 } }) });
    expect(`${first.id}:${first.title}`).not.toBe(`${second.id}:${second.title}`);
  });

  it('creates a turn-two route fallback', () => {
    const fingerprint = buildExpeditionFingerprint({
      run: run('fallback'),
      event: event({ turn: 2, delta: { revealed: 0, departPressure: 2, artifacts: 0 }, after: { ...event().after, revealed: 1 } }),
    });
    expect(fingerprint.trigger).toBe('turn-two-route');
    expect(fingerprint.replayHook).toMatch(/Replay|cleaner/i);
  });

  it('creates an artifact-oriented fingerprint after a pickup', () => {
    const fingerprint = buildExpeditionFingerprint({
      run: run('artifact'),
      event: event({
        action: 'dig',
        discoveredArtifact: { name: 'Glass Idol' },
        before: { ...event().before, artifacts: [] },
        after: { ...event().after, artifacts: [{ name: 'Glass Idol' }], departPressure: 45 },
        delta: { artifacts: 1, departPressure: 12, revealed: 0 },
      }),
    });
    expect(fingerprint.trigger).toBe('artifact-pickup');
    expect(fingerprint.temptation).toBe('Fast artifact pickup');
    expect(fingerprint.beatTarget).toMatch(/value/i);
  });

  it('creates a pressure-oriented fingerprint when pressure spikes', () => {
    const fingerprint = buildExpeditionFingerprint({
      run: run('pressure'),
      event: event({
        after: { ...event().after, departPressure: 70, danger: 66, routeStability: 30 },
        delta: { revealed: 0, departPressure: 18, artifacts: 0 },
      }),
    });
    expect(fingerprint.trigger).toBe('pressure-spike');
    expect(fingerprint.danger).toMatch(/Pressure|Collapse|Route/i);
  });
});
