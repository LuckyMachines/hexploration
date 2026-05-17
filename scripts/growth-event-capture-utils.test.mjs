import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicRunEvents,
  mergeGrowthEvents,
} from './growth-event-capture-utils.mjs';

test('builds a complete public-run event stream', () => {
  const events = buildPublicRunEvents({
    scenarioId: 'escape-pressure-4p',
    seed: 'featured-ready-escape',
    arcScore: 66,
    generatedAt: '2026-05-17T12:00:00.000Z',
  });

  assert.deepEqual(events.map((event) => event.type), [
    'run_started',
    'action_taken',
    'action_taken',
    'action_taken',
    'run_completed',
    'share_card_generated',
    'replay_opened',
  ]);
  assert.equal(events[4].outcome, 'completed');
  assert.equal(events[5].arcScore, 66);
  assert.match(events[0].route, /escape-pressure-4p/);
});

test('dedupes captured events by public-run identity', () => {
  const first = buildPublicRunEvents({
    scenarioId: 'escape-pressure-4p',
    seed: 'featured-ready-escape',
    generatedAt: '2026-05-17T12:00:00.000Z',
  });
  const second = buildPublicRunEvents({
    scenarioId: 'escape-pressure-4p',
    seed: 'featured-ready-escape',
    generatedAt: '2026-05-17T13:00:00.000Z',
  });

  const merged = mergeGrowthEvents(first, second);
  assert.equal(merged.length, first.length);
  assert.equal(merged[0].generatedAt, '2026-05-17T13:00:00.000Z');
});
