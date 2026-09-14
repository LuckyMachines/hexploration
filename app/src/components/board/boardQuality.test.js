import { describe, expect, it } from 'vitest';
import {
  BOARD_QUALITY_MODES,
  nextPixelRatio,
  resolveBoardQuality,
  settleRendererWarmup,
  shouldUseAsyncShaderWarmup,
  shouldUseCompressedTextures,
} from './boardQuality';

describe('resolveBoardQuality', () => {
  it('keeps full board quality on capable desktop hardware', () => {
    expect(resolveBoardQuality()).toMatchObject({
      requestedMode: BOARD_QUALITY_MODES.AUTO,
      mode: BOARD_QUALITY_MODES.BALANCED,
      pixelRatioCap: 1.5,
      shadows: true,
      shadowMapSize: 1536,
      particleScale: 0.72,
      anisotropy: 4,
    });
  });

  it('selects high quality for a wide capable desktop', () => {
    expect(resolveBoardQuality({ viewportWidth: 1440 })).toMatchObject({
      mode: BOARD_QUALITY_MODES.HIGH,
      pixelRatioCap: 2,
      shadowMapSize: 2048,
      anisotropy: 8,
    });
  });

  it('selects efficient rendering for constrained hardware', () => {
    expect(resolveBoardQuality({ deviceMemory: 4 })).toMatchObject({
      mode: BOARD_QUALITY_MODES.EFFICIENT,
      pixelRatioCap: 1,
      shadows: false,
      particleScale: 0.35,
    });
  });

  it('honors an explicit efficiency preference', () => {
    expect(resolveBoardQuality({ mode: BOARD_QUALITY_MODES.EFFICIENT, deviceMemory: 16 })).toMatchObject({
      mode: BOARD_QUALITY_MODES.EFFICIENT,
      shadows: false,
    });
  });

  it('uses the CSP-safe material path in production', () => {
    expect(shouldUseCompressedTextures({ requested: true, production: true })).toBe(false);
    expect(shouldUseCompressedTextures({ requested: true, production: false })).toBe(true);
    expect(shouldUseCompressedTextures({ requested: false, production: false })).toBe(false);
  });

  it('adapts pixel density only when frame pacing leaves the target band', () => {
    expect(nextPixelRatio({ current: 2, frameP95Ms: 100, maximum: 2 })).toBe(1);
    expect(nextPixelRatio({ current: 1.5, frameP95Ms: 33, maximum: 1.5 })).toBe(1.35);
    expect(nextPixelRatio({ current: 1.2, frameP95Ms: 10, maximum: 1.5 })).toBe(1.3);
    expect(nextPixelRatio({ current: 1.4, frameP95Ms: 22, maximum: 1.5 })).toBe(1.4);
  });

  it('never lets optional shader warm-up block renderer readiness indefinitely', async () => {
    expect(await settleRendererWarmup(() => Promise.resolve())).toBe('complete');
    expect(await settleRendererWarmup(() => Promise.reject(new Error('compile unavailable')))).toBe('failed');
    expect(await settleRendererWarmup(() => undefined)).toBe('unsupported');
    expect(await settleRendererWarmup(() => new Promise(() => {}), { timeoutMs: 1 })).toBe('timed-out');
  });

  it('uses synchronous shader compilation on WebKit where async compilation can stall', () => {
    expect(shouldUseAsyncShaderWarmup('Mozilla/5.0 AppleWebKit/605.1.15 Version/18.5 Safari/605.1.15')).toBe(false);
    expect(shouldUseAsyncShaderWarmup('Mozilla/5.0 AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36')).toBe(true);
    expect(shouldUseAsyncShaderWarmup('Mozilla/5.0 Gecko/20100101 Firefox/142.0')).toBe(true);
  });
});
