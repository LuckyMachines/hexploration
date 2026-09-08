import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { uiQualityBudgets, uiQualityScenes } from '../src/design-system/uiQualityMatrix';

const enabled = process.env.VITE_ENABLE_INTERNAL_TOOLS === 'true';
const qualityTest = enabled ? test : test.skip;
const captureRoot = process.env.UI_QUALITY_CAPTURE_DIR
  ? path.resolve(process.env.UI_QUALITY_CAPTURE_DIR)
  : path.resolve(process.cwd(), '..', 'artifacts', 'ui-quality', 'captures');
const metricsPath = process.env.UI_QUALITY_METRICS_PATH
  ? path.resolve(process.env.UI_QUALITY_METRICS_PATH)
  : path.resolve(process.cwd(), '..', 'artifacts', 'ui-quality', 'metrics', 'latest.json');
const metrics = [];

async function installStabilityHarness(page) {
  await page.addInitScript(() => {
    window.__uiQualityCLS = 0;
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__uiQualityCLS += entry.value;
        }
      });
      try { observer.observe({ type: 'layout-shift', buffered: true }); } catch { /* unsupported browser */ }
    }
  });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
}

async function settleScene(page, scene) {
  await page.setViewportSize(scene.viewport);
  await page.goto(scene.route, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: `
    *, *::before, *::after {
      animation-delay: 0s !important;
      animation-duration: 0s !important;
      caret-color: transparent !important;
      scroll-behavior: auto !important;
      transition-delay: 0s !important;
      transition-duration: 0s !important;
    }
  ` });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete));
  if (scene.waitForRenderer) {
    await expect(page.locator('[data-testid="three-board-world"]')).toHaveAttribute('data-renderer-state', 'ready', { timeout: 30_000 });
  }
  const target = page.locator(scene.selector).first();
  await expect(target).toBeVisible();
  if (scene.capture === 'element') await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  return target;
}

async function renderedMetrics(page, scene) {
  return page.evaluate(async ({ selector, minTarget }) => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const controls = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')].filter(visible);
    const smallTargets = controls.map((element) => {
      const nativeRect = element.getBoundingClientRect();
      const label = element.labels?.[0] || element.closest('label');
      const labelRect = label?.getBoundingClientRect();
      const rect = labelRect && labelRect.width >= nativeRect.width && labelRect.height >= nativeRect.height ? labelRect : nativeRect;
      return { label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 80) || element.tagName, width: rect.width, height: rect.height };
    }).filter(({ width, height }) => width < minTarget || height < minTarget);
    const target = document.querySelector(selector);
    const textLength = target?.innerText?.replace(/\s+/g, ' ').trim().length || 0;
    const targetRect = target?.getBoundingClientRect();
    const targetArea = targetRect ? Math.max(1, targetRect.width * targetRect.height) : 1;
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const frameDeltas = await new Promise((resolve) => {
      const samples = [];
      let previous = null;
      const sample = (time) => {
        if (previous !== null) samples.push(time - previous);
        previous = time;
        if (samples.length >= 30) resolve(samples);
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const sortedFrames = [...frameDeltas].sort((a, b) => a - b);
    const frameP95Ms = Number((sortedFrames[Math.min(sortedFrames.length - 1, Math.floor(sortedFrames.length * 0.95))] || 0).toFixed(2));
    return {
      domNodes: document.querySelectorAll('*').length,
      horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      interactiveCount: controls.length,
      smallInteractiveTargets: smallTargets,
      cumulativeLayoutShift: Number(window.__uiQualityCLS || 0),
      textCharactersPer100kPx: Math.round((textLength / targetArea) * 100000),
      canvasCount: document.querySelectorAll('canvas').length,
      navigationDurationMs: Math.round(navigation?.duration || 0),
      transferBytes: Math.round(resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0)),
      frameP95Ms,
    };
  }, { selector: scene.selector, minTarget: uiQualityBudgets.minInteractiveTargetPx });
}

test.describe.serial('UI quality evidence', () => {
  test.beforeAll(async () => {
    await fs.mkdir(captureRoot, { recursive: true });
    await fs.mkdir(path.dirname(metricsPath), { recursive: true });
  });

  for (const scene of uiQualityScenes) {
    qualityTest(`${scene.id} matches its approved visual contract`, async ({ page }) => {
      await installStabilityHarness(page);
      const target = await settleScene(page, scene);
      const measurements = await renderedMetrics(page, scene);
      const axe = await new AxeBuilder({ page }).include('#main-content').analyze();
      const serious = axe.violations.filter(({ impact }) => impact === 'serious');
      const critical = axe.violations.filter(({ impact }) => impact === 'critical');
      const screenshot = scene.capture === 'viewport'
        ? await page.screenshot({ animations: 'disabled', fullPage: false })
        : await target.screenshot({ animations: 'disabled' });

      await fs.writeFile(path.join(captureRoot, `${scene.id}.png`), screenshot);
      metrics.push({
        id: scene.id,
        label: scene.label,
        route: scene.route,
        viewport: scene.viewport,
        ...measurements,
        accessibility: {
          serious: serious.map(({ id, help, nodes }) => ({ id, help, nodes: nodes.length })),
          critical: critical.map(({ id, help, nodes }) => ({ id, help, nodes: nodes.length })),
        },
      });

      expect(measurements.horizontalOverflowPx).toBeLessThanOrEqual(uiQualityBudgets.maxHorizontalOverflowPx);
      expect(measurements.domNodes).toBeLessThanOrEqual(scene.maxDomNodes);
      expect(measurements.smallInteractiveTargets, JSON.stringify(measurements.smallInteractiveTargets, null, 2)).toHaveLength(uiQualityBudgets.maxSmallInteractiveTargets);
      expect(measurements.cumulativeLayoutShift).toBeLessThanOrEqual(uiQualityBudgets.maxCumulativeLayoutShift);
      if (scene.maxFrameP95Ms) expect(measurements.frameP95Ms).toBeLessThanOrEqual(scene.maxFrameP95Ms);
      expect(serious, JSON.stringify(serious, null, 2)).toHaveLength(uiQualityBudgets.maxSeriousAccessibilityViolations);
      expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(uiQualityBudgets.maxCriticalAccessibilityViolations);
      expect(screenshot).toMatchSnapshot(['ui-quality', `${scene.id}.png`], { maxDiffPixelRatio: 0.01, threshold: 0.2 });
    });
  }

  test.afterAll(async () => {
    await fs.writeFile(metricsPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), scenes: metrics }, null, 2)}\n`);
  });
});
