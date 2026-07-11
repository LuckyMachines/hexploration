import { describe, expect, it } from 'vitest';
import { deriveNextChallenge } from './expeditionChallenges';
import { memoryFromGrowthRun } from './expeditionGrowthMemory';
import { applyGrowthAction, createGrowthRun } from './growthLoop';
import {
  buildRunRelicCard,
  escapeRelicText,
  relicShareText,
  renderRunRelicSvg,
} from './expeditionRelicCard';

function completeRun() {
  let run = createGrowthRun({ scenarioId: 'solo-artifact-hunt', seed: 'relic-card' });
  for (const action of ['move', 'dig', 'move', 'flee', 'flee', 'rest']) {
    if (run.completed) break;
    run = applyGrowthAction(run, action);
  }
  return run;
}

describe('expeditionRelicCard', () => {
  it('builds a card from memory and challenge data', () => {
    const memory = memoryFromGrowthRun(completeRun());
    const challenge = deriveNextChallenge({ entries: [memory] }, memory);
    const card = buildRunRelicCard({ memory, challenge, origin: 'https://xenovoya.example' });
    expect(card.title).toBe(memory.fingerprint?.title || memory.title);
    expect(card.score).toBeGreaterThan(0);
    expect(card.fingerprint?.title).toBe(memory.fingerprint?.title);
    expect(card.challengeTarget).toBeTruthy();
    expect(card.recordUrl).toContain('https://xenovoya.example/replay/');
    expect(card.filename).toMatch(/\.svg$/);
  });

  it('renders a self-contained SVG card', () => {
    const memory = memoryFromGrowthRun(completeRun());
    const card = buildRunRelicCard({ memory, challenge: deriveNextChallenge({ entries: [memory] }, memory) });
    const svg = renderRunRelicSvg(card);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Xenovoya Run Relic');
    expect(svg).toContain('ROUTE MEMORY');
    expect(svg).not.toContain('<script');
  });

  it('escapes injected text in SVG output', () => {
    const memory = {
      id: 'unsafe',
      title: 'Bad <script>alert(1)</script>',
      scenarioName: 'Unsafe & Scenario',
      outcome: 'escaped',
      outcomeLabel: 'Escaped',
      score: 100,
      finalPressure: 10,
      escapeCostLevel: 'clean',
      escapeCostLabel: 'Clean',
      artifacts: 1,
      survivors: 1,
      crew: 1,
      badges: ['Badge <One>'],
    };
    const card = buildRunRelicCard({ memory });
    const svg = renderRunRelicSvg(card);
    expect(escapeRelicText(memory.title)).toContain('&lt;script&gt;');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).not.toContain('<script>alert');
  });

  it('creates share text with benchmark and record link', () => {
    const memory = memoryFromGrowthRun(completeRun());
    const card = buildRunRelicCard({
      memory,
      challenge: deriveNextChallenge({ entries: [memory] }, memory),
      origin: 'https://xenovoya.example',
    });
    expect(relicShareText(card)).toContain(card.title);
    expect(relicShareText(card)).toContain(card.challengeTitle);
    expect(relicShareText(card)).toContain('https://xenovoya.example');
  });
});
