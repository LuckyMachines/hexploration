import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_DURATION_MS,
  premiumBeatKey,
  presentationDurationMs,
  presentationFrame,
  presentationStage,
} from './premiumPresentation';

describe('premium board presentation', () => {
  it('gives each turn and destination a deterministic beat key', () => {
    expect(premiumBeatKey({ phase: 'resolving', intentAlias: '3,2', currentLocation: '2,2', source: { turn: 1 } }, { id: 'world-answering' }))
      .toBe('world-answering:resolving:3,2:2,2:1');
  });

  it('moves through anticipation, action, impact, and settle', () => {
    expect(presentationStage(0.1)).toBe('anticipation');
    expect(presentationStage(0.4)).toBe('action');
    expect(presentationStage(0.75)).toBe('impact');
    expect(presentationStage(0.95)).toBe('settle');
  });

  it('finishes travel without leaving a camera pulse behind', () => {
    const frame = presentationFrame({ startedAt: 100, now: 100 + PRESENTATION_DURATION_MS, resolving: true });
    expect(frame.travel).toBe(1);
    expect(frame.lensPulse).toBeCloseTo(0, 5);
    expect(frame.complete).toBe(true);
  });

  it('allows deterministic captures to stretch the clock without changing production timing', () => {
    window.__XENOVOYA_PRESENTATION_SCALE__ = 4;
    expect(presentationDurationMs()).toBe(PRESENTATION_DURATION_MS * 4);
    delete window.__XENOVOYA_PRESENTATION_SCALE__;
    expect(presentationDurationMs()).toBe(PRESENTATION_DURATION_MS);
  });

  it('uses a stable still frame outside resolution', () => {
    expect(presentationFrame({ startedAt: 0, now: 100, resolving: false })).toMatchObject({
      stage: 'settle',
      travel: 0,
      lift: 0,
      lensPulse: 0,
    });
  });
});
