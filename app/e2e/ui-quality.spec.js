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
const metricsRunId = process.env.UI_QUALITY_RUN_ID || 'manual';
const sceneMetricsRoot = path.join(path.dirname(metricsPath), 'scenes');
const metrics = [];

function sceneMetricsPath(sceneId) {
  return path.join(sceneMetricsRoot, `${sceneId}.json`);
}

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
  if (scene.expandDetails) {
    await target.evaluate((element) => {
      let ancestor = element.parentElement;
      while (ancestor) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
        ancestor = ancestor.parentElement;
      }
    });
  }
  await expect(target).toBeVisible();
  if (scene.capture === 'element') await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  return target;
}

async function renderedMetrics(page, scene) {
  return page.evaluate(async ({ selector, minTarget }) => {
    const visible = (element) => {
      if (element.closest('.sr-only, [aria-hidden="true"]')) return false;
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

async function releaseWebGlContexts(page) {
  await page.evaluate(() => {
    document.querySelectorAll('canvas').forEach((canvas) => {
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    });
  });
}

test.describe('UI quality evidence', () => {
  test.beforeAll(async () => {
    await fs.mkdir(captureRoot, { recursive: true });
    await fs.mkdir(path.dirname(metricsPath), { recursive: true });
    await fs.mkdir(sceneMetricsRoot, { recursive: true });
  });

  for (const scene of uiQualityScenes) {
    qualityTest(`${scene.id} matches its approved visual contract`, async ({ page }) => {
      await installStabilityHarness(page);
      const target = await settleScene(page, scene);
      const measurements = await renderedMetrics(page, scene);
      const screenshot = scene.capture === 'viewport'
        ? await page.screenshot({ animations: 'disabled', fullPage: false })
        : await target.screenshot({ animations: 'disabled' });
      await releaseWebGlContexts(page);
      const axe = await new AxeBuilder({ page }).include('#main-content').analyze();
      const serious = axe.violations.filter(({ impact }) => impact === 'serious');
      const critical = axe.violations.filter(({ impact }) => impact === 'critical');

      await fs.writeFile(path.join(captureRoot, `${scene.id}.png`), screenshot);
      const sceneMetrics = {
        id: scene.id,
        label: scene.label,
        route: scene.route,
        viewport: scene.viewport,
        ...measurements,
        accessibility: {
          serious: serious.map(({ id, help, nodes }) => ({ id, help, nodes: nodes.length })),
          critical: critical.map(({ id, help, nodes }) => ({ id, help, nodes: nodes.length })),
        },
      };
      metrics.push(sceneMetrics);
      await fs.writeFile(sceneMetricsPath(scene.id), `${JSON.stringify({ runId: metricsRunId, metrics: sceneMetrics }, null, 2)}\n`);

      expect(measurements.horizontalOverflowPx).toBeLessThanOrEqual(uiQualityBudgets.maxHorizontalOverflowPx);
      expect(measurements.domNodes).toBeLessThanOrEqual(scene.maxDomNodes);
      expect(measurements.smallInteractiveTargets, JSON.stringify(measurements.smallInteractiveTargets, null, 2)).toHaveLength(uiQualityBudgets.maxSmallInteractiveTargets);
      expect(measurements.cumulativeLayoutShift).toBeLessThanOrEqual(uiQualityBudgets.maxCumulativeLayoutShift);
      if (scene.maxFrameP95Ms) expect(measurements.frameP95Ms).toBeLessThanOrEqual(scene.maxFrameP95Ms);
      if (scene.maxTransferBytes) expect(measurements.transferBytes).toBeLessThanOrEqual(scene.maxTransferBytes);
      if (scene.maxNavigationDurationMs) expect(measurements.navigationDurationMs).toBeLessThanOrEqual(scene.maxNavigationDurationMs);
      expect(serious, JSON.stringify(serious, null, 2)).toHaveLength(uiQualityBudgets.maxSeriousAccessibilityViolations);
      expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(uiQualityBudgets.maxCriticalAccessibilityViolations);
      expect(screenshot).toMatchSnapshot(['ui-quality', `${scene.id}.png`], { maxDiffPixelRatio: 0.01, threshold: 0.2 });
    });
  }

  test.afterAll(async () => {
    const persistedMetrics = await Promise.all(uiQualityScenes.map(async (scene) => {
      try {
        const entry = JSON.parse(await fs.readFile(sceneMetricsPath(scene.id), 'utf8'));
        return entry.runId === metricsRunId ? entry.metrics : null;
      } catch {
        return null;
      }
    }));
    await fs.writeFile(metricsPath, `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      scenes: persistedMetrics.filter(Boolean),
    }, null, 2)}\n`);
  });
});
