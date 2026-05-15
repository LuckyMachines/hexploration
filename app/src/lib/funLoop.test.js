import { describe, expect, it } from 'vitest';
import { applyGrowthAction, createGrowthRun, summarizeGrowthRun } from './growthLoop';
import {
  actionPreviewFor,
  artifactFor,
  badgesForRun,
  funQualityForRun,
  modifierForSeed,
  personalBestsAfter,
  publicArtifactNames,
} from './funLoop';

function play(actions, options = {}) {
  return actions.reduce((run, action) => applyGrowthAction(run, action), createGrowthRun({ scenarioId: 'escape-pressure-4p', seed: 'fun-test', ...options }));
}

describe('funLoop', () => {
  it('builds previews with role and danger hooks', () => {
    const run = createGrowthRun({ scenarioId: 'escape-pressure-4p', seed: 'preview' });
    expect(actionPreviewFor(run, 'move').intent).toBe('Close distance');
    const danger = { ...run, state: { ...run.state, morale: 20, danger: 80 } };
    expect(actionPreviewFor(danger, 'rest').dangerHook).toMatch(/Comeback/);
  });

  it('adds artifacts, barks, moments, and fun quality', () => {
    const run = play(['dig', 'move', 'help', 'rest', 'flee', 'flee']);
    const summary = summarizeGrowthRun(run);
    expect(summary.runTitle).toBeTruthy();
    expect(summary.funQuality.funVerdict).toBeTruthy();
    expect(run.timeline.some((event) => event.bark)).toBe(true);
    expect(publicArtifactNames(run).length).toBe(summary.artifacts);
  });

  it('selects artifacts and challenge modifiers deterministically', () => {
    expect(artifactFor('seed', 2)).toEqual(artifactFor('seed', 2));
    expect(modifierForSeed('weekly-escape-001').name).toBeTruthy();
  });

  it('detects badges and personal bests', () => {
    const run = play(['move', 'dig', 'dig', 'flee', 'flee']);
    const quality = funQualityForRun(run);
    const summary = summarizeGrowthRun(run);
    expect(badgesForRun(run, summary, quality).length).toBeGreaterThan(0);
    expect(personalBestsAfter([{ ...run, completed: true, summary }]).highestArcScore).toBeGreaterThanOrEqual(0);
  });
});
