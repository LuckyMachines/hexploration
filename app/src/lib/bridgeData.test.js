import { describe, expect, it } from 'vitest';
import {
  bridgeDevlogEntries,
  challengeRouteFromBridge,
  mergeReadinessIntoProgress,
  publicVerdictLabel,
  readinessTone,
  scenarioRouteFromBridge,
  selectChallengeScenario,
  selectFeaturedScenario,
} from './bridgeData';

const report = {
  featuredScenario: { scenarioId: 'solo-artifact-hunt', gateVerdict: 'featured-ready', publicRoute: '/play?scenario=solo-artifact-hunt', readinessScore: 88, name: 'Solo Artifact Hunt' },
  challengeScenario: { scenarioId: 'escape-pressure-4p', gateVerdict: 'playable-with-caveats', challengeRoute: '/challenge?scenario=escape-pressure-4p&seed=x', readinessScore: 72, name: 'Escape Pressure 4P', nextFix: { title: 'Refresh' } },
  scenarios: [
    { scenarioId: 'solo-artifact-hunt', gateVerdict: 'featured-ready', readinessScore: 88, name: 'Solo Artifact Hunt', evidence: { feeling: { arcScore: 80 }, timeMachine: { trend: 'stable' } } },
    { scenarioId: 'escape-pressure-4p', gateVerdict: 'playable-with-caveats', readinessScore: 72, name: 'Escape Pressure 4P', warnings: [{ message: 'Partial setup' }], nextFix: { title: 'Refresh', command: 'npm run bridge:scenario -- --id=escape-pressure-4p' } },
  ],
};

describe('bridgeData', () => {
  it('selects featured and challenge scenarios safely', () => {
    expect(selectFeaturedScenario(report).scenarioId).toBe('solo-artifact-hunt');
    expect(selectChallengeScenario(report).scenarioId).toBe('escape-pressure-4p');
    expect(selectFeaturedScenario(null)).toBeNull();
  });

  it('formats routes and labels', () => {
    expect(scenarioRouteFromBridge(report.featuredScenario)).toContain('solo-artifact-hunt');
    expect(challengeRouteFromBridge(report.challengeScenario)).toContain('/challenge');
    expect(publicVerdictLabel('needs-fun-work')).toBe('Needs more fun');
    expect(readinessTone('blocked-by-setup')).toBe('red');
  });

  it('merges bridge readiness into progress rows', () => {
    const merged = mergeReadinessIntoProgress([{ scenarioId: 'solo-artifact-hunt', latestArcScore: null, trend: 'needs-runs' }], report);
    expect(merged[0].latestArcScore).toBe(80);
    expect(merged[0].trend).toBe('stable');
    expect(merged[0].bridgeReadiness.gateVerdict).toBe('featured-ready');
  });

  it('creates devlog entries from bridge report', () => {
    const entries = bridgeDevlogEntries(report);
    expect(entries[0].title).toContain('Featured ready');
    expect(entries[1].command).toContain('bridge:scenario');
  });
});
