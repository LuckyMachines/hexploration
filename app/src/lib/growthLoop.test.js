import { describe, expect, it } from 'vitest';
import {
  applyGrowthAction,
  buildCreatorScenario,
  buildDevlogEntries,
  buildPublicProgress,
  createGrowthRun,
  decodeRun,
  encodeRun,
  rankChallengeRuns,
  replayPathForRun,
  shareTextForRun,
  summarizeGrowthRun,
  WEEKLY_CHALLENGE,
} from './growthLoop';

function finish(run) {
  let next = run;
  for (const action of ['move', 'dig', 'move', 'help', 'flee', 'flee', 'rest']) {
    if (next.completed) break;
    next = applyGrowthAction(next, action);
  }
  return next;
}

describe('growthLoop', () => {
  it('creates deterministic seeded runs and applies actions', () => {
    const first = applyGrowthAction(createGrowthRun({ scenarioId: 'solo-artifact-hunt', seed: 'abc' }), 'move');
    const second = applyGrowthAction(createGrowthRun({ scenarioId: 'solo-artifact-hunt', seed: 'abc' }), 'move');
    expect(first.timeline[0].lifePulse).toBe(second.timeline[0].lifePulse);
    expect(first.timeline[0].text).toMatch(/board|pressure|route/i);
  });

  it('summarizes, shares, and serializes completed runs', () => {
    const run = finish(createGrowthRun({ scenarioId: WEEKLY_CHALLENGE.scenarioId, seed: WEEKLY_CHALLENGE.seed }));
    const summary = summarizeGrowthRun(run);
    expect(summary.turns).toBeGreaterThan(0);
    expect(summary.arcScore).toBeGreaterThanOrEqual(0);
    expect(summary.fingerprint?.title).toBeTruthy();
    expect(shareTextForRun(run)).toContain(summary.scenarioName);
    expect(shareTextForRun(run)).toContain(summary.fingerprint.title);
    expect(replayPathForRun(run)).toMatch(/^\/replay\//);
    expect(decodeRun(encodeRun(run)).seed).toBe(run.seed);
  });

  it('creates an expedition fingerprint by the second turn', () => {
    let run = createGrowthRun({ scenarioId: 'solo-artifact-hunt', seed: 'fingerprint-run' });
    run = applyGrowthAction(run, 'move');
    if (!run.fingerprint) run = applyGrowthAction(run, 'inspect');
    expect(run.fingerprint?.title).toBeTruthy();
    expect(run.timeline.some((event) => event.fingerprint?.title === run.fingerprint.title)).toBe(true);
  });

  it('ranks challenge runs by challenge score', () => {
    const low = finish(createGrowthRun({ scenarioId: WEEKLY_CHALLENGE.scenarioId, seed: 'low' }));
    const high = finish(createGrowthRun({ scenarioId: WEEKLY_CHALLENGE.scenarioId, seed: 'high' }));
    const ranked = rankChallengeRuns([low, high]);
    expect(ranked[0]).toBeTruthy();
    expect(summarizeGrowthRun(ranked[0]).challengeScore).toBeGreaterThanOrEqual(summarizeGrowthRun(ranked[1]).challengeScore);
  });

  it('builds progress, devlog entries, and creator previews', () => {
    const run = finish(createGrowthRun({ scenarioId: 'solo-artifact-hunt', seed: 'creator' }));
    const progress = buildPublicProgress({ runs: [run] });
    expect(progress.find((item) => item.scenarioId === 'solo-artifact-hunt').runs).toBe(1);
    expect(buildDevlogEntries(progress)[0].title).toBeTruthy();
    expect(buildCreatorScenario({ prompt: 'moon cave escape', players: 2 }).playPath).toContain('/play');
  });
});
