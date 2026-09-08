import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { UI_QUALITY_VERSION, uiQualityBudgets, uiQualityScenes } from './uiQualityMatrix';

describe('UI quality scene matrix', () => {
  it('keeps unique deterministic scenes with explicit sources and budgets', () => {
    expect(UI_QUALITY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(new Set(uiQualityScenes.map((scene) => scene.id)).size).toBe(uiQualityScenes.length);
    expect(uiQualityScenes.length).toBeGreaterThanOrEqual(6);
    for (const scene of uiQualityScenes) {
      expect(scene.route).toMatch(/^\//);
      expect(scene.selector).toBeTruthy();
      expect(['viewport', 'element']).toContain(scene.capture);
      expect(scene.viewport.width).toBeGreaterThanOrEqual(320);
      expect(scene.viewport.height).toBeGreaterThanOrEqual(640);
      expect(scene.sources.length).toBeGreaterThan(0);
      for (const source of scene.sources) expect(existsSync(resolve(process.cwd(), source)), source).toBe(true);
      expect(scene.maxDomNodes).toBeGreaterThan(0);
    }
  });

  it('keeps accessibility and geometry budgets strict', () => {
    expect(uiQualityBudgets.maxHorizontalOverflowPx).toBeLessThanOrEqual(1);
    expect(uiQualityBudgets.minInteractiveTargetPx).toBeGreaterThanOrEqual(44);
    expect(uiQualityBudgets.maxSeriousAccessibilityViolations).toBe(0);
    expect(uiQualityBudgets.maxCriticalAccessibilityViolations).toBe(0);
    expect(uiQualityBudgets.maxFrameP95Ms).toBeLessThanOrEqual(50);
  });
});
