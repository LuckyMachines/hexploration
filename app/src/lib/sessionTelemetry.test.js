import { describe, expect, it } from 'vitest';
import { recordSessionMetric, sessionMetricSummary } from './sessionTelemetry';

describe('session performance telemetry', () => {
  it('records bounded percentile evidence without identity data', () => {
    recordSessionMetric('local_save_ack_ms', 12, { source: 'indexeddb' });
    recordSessionMetric('local_save_ack_ms', 18, { source: 'indexeddb' });
    const summary = sessionMetricSummary('local_save_ack_ms');
    expect(summary).toMatchObject({ count: 2, p95: 18, budget: 50, passing: true });
  });
});
