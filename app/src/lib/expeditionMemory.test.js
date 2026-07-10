import { describe, expect, it } from 'vitest';
import { applyGrowthAction, createGrowthRun } from './growthLoop';
import {
  EXPEDITION_MEMORY_STORAGE_KEY,
  badgesForMemory,
  bestMemoryForCategory,
  deriveMemoryInsight,
  loadExpeditionMemory,
  memoryFromGameOver,
  memoryFromGrowthRun,
  memoryStats,
  recordExpeditionMemory,
  saveExpeditionMemory,
  scoreExpeditionMemory,
} from './expeditionMemory';

function storageWith(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

function completeRun(seed = 'memory-seed') {
  let run = createGrowthRun({ scenarioId: 'solo-artifact-hunt', seed });
  for (const action of ['move', 'dig', 'move', 'flee', 'flee', 'rest']) {
    if (run.completed) break;
    run = applyGrowthAction(run, action);
  }
  return run;
}

describe('expeditionMemory', () => {
  it('loads an empty state and recovers from corrupt storage', () => {
    expect(loadExpeditionMemory(storageWith()).entries).toEqual([]);
    const corrupt = storageWith({ [EXPEDITION_MEMORY_STORAGE_KEY]: '{broken' });
    expect(loadExpeditionMemory(corrupt).entries).toEqual([]);
  });

  it('records completed growth runs as deduped ranked memories', () => {
    const storage = storageWith();
    const first = memoryFromGrowthRun(completeRun('first-memory'));
    const second = memoryFromGrowthRun(completeRun('second-memory'));
    recordExpeditionMemory(first, storage);
    recordExpeditionMemory(first, storage);
    const memory = recordExpeditionMemory(second, storage);
    expect(memory.entries).toHaveLength(2);
    expect(memory.badges.length).toBeGreaterThan(0);
    expect(memory.entries[0].insight).toBeTruthy();
    expect(memory.entries[0].fingerprint?.title).toBeTruthy();
    expect(memory.entries[0].score).toBeGreaterThanOrEqual(memory.entries[1].score);
  });

  it('builds live Game Over memories without raw proof payloads', () => {
    const entry = memoryFromGameOver({
      gameId: 12,
      players: [{ isActive: true }, { isActive: false }],
      finalPressure: { pressure: 82, recoveredValue: 2 },
      finalEscapeCost: { level: 'crew-risk', label: 'Crew at risk' },
      finalArc: { id: 'redline', label: 'Redline', priority: 80 },
      replayProof: [{ tx: '0xabc' }, { tx: '0xdef' }],
      reportPath: '/game/12',
      events: [1, 2, 3],
    });
    expect(entry.source).toBe('live-expedition');
    expect(entry.proofCount).toBe(2);
    expect(entry.badges).toContain('Redline Survivor');
    expect(JSON.stringify(entry)).not.toContain('0xabc');
  });

  it('summarizes stats and category bests', () => {
    const clean = {
      id: 'clean',
      title: 'Clean',
      outcome: 'escaped',
      score: 600,
      escapeCostLevel: 'clean',
      finalPressure: 30,
      artifacts: 1,
      survivors: 1,
      crew: 1,
      badges: ['Clean Departure'],
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    const redline = {
      ...clean,
      id: 'redline',
      title: 'Redline',
      score: 700,
      escapeCostLevel: 'close',
      finalPressure: 86,
      badges: ['Redline Survivor'],
      timestamp: '2026-01-02T00:00:00.000Z',
    };
    const memory = saveExpeditionMemory({ entries: [clean, redline] }, storageWith());
    expect(memoryStats(memory).best.id).toBe('redline');
    expect(bestMemoryForCategory(memory, 'clean').id).toBe('clean');
    expect(bestMemoryForCategory(memory, 'redline').id).toBe('redline');
  });

  it('scores and explains memories', () => {
    const entry = {
      outcome: 'escaped',
      escapeCostLevel: 'clean',
      artifacts: 2,
      survivors: 2,
      crew: 2,
      finalPressure: 24,
      arcScore: 72,
      badges: [],
    };
    expect(scoreExpeditionMemory(entry)).toBeGreaterThan(800);
    expect(badgesForMemory(entry)).toContain('Clean Departure');
    expect(deriveMemoryInsight(entry)).toMatch(/clean departure/i);
    expect(deriveMemoryInsight({
      ...entry,
      fingerprint: { title: 'Glass Trail', replayHook: 'Replay this seed for a cleaner exit.' },
    })).toContain('Glass Trail');
  });
});
