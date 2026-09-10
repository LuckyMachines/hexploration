import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import boardSystem from '../src/board-system/board-system.json' with { type: 'json' };

const enabled = process.env.VITE_ENABLE_INTERNAL_TOOLS === 'true';
const artifactRoot = path.resolve('..', 'artifacts', 'board-system');
const captureRoot = path.join(artifactRoot, 'captures');
const metricsPath = path.join(artifactRoot, 'metrics', 'latest.json');
const scenes = [];
let remountHeapGrowthMiB = null;

async function openBoard(page, state, viewport, preferences = 'reduced-motion') {
  await page.setViewportSize(viewport);
  await page.emulateMedia({
    reducedMotion: preferences === 'reduced-motion' ? 'reduce' : 'no-preference',
    forcedColors: preferences === 'forced-colors' ? 'active' : 'none',
    colorScheme: 'dark',
  });
  await page.goto(`/board-lab?state=${state}&quality=balanced`, { waitUntil: 'domcontentloaded' });
  const lab = page.getByTestId('board-lab');
  const world = page.getByTestId('three-board-world');
  await expect(lab).toBeVisible();
  await expect(world).toHaveAttribute('data-renderer-state', 'ready', { timeout: 60_000 });
  const canvas = world.locator('canvas');
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  return { lab, world, canvas };
}

async function readMetrics(page, canvas, id, state, viewport) {
  const runtime = await canvas.evaluate((element) => ({
    drawCalls: Number(element.dataset.drawCalls || 0),
    triangles: Number(element.dataset.triangles || 0),
    textures: Number(element.dataset.textures || 0),
    frameP95Ms: element.dataset.frameP95 ? Number(element.dataset.frameP95) : null,
    renderP95Ms: element.dataset.renderP95 ? Number(element.dataset.renderP95) : null,
    pixelRatio: Number(element.dataset.pixelRatio || 1),
    assetExpected: Number(element.dataset.assetExpected || 0),
    assetLoaded: Number(element.dataset.assetLoaded || 0),
    assetLoading: Number(element.dataset.assetLoading || 0),
    assetFailures: Number(element.dataset.assetFailures || 0),
    assetFailureList: JSON.parse(element.dataset.assetFailureList || '[]'),
    assetBytes: Number(element.dataset.assetBytes || 0),
    contextLosses: Number(element.dataset.contextLosses || 0),
    lightingRig: element.dataset.lightingRig,
    boardBeat: element.dataset.boardBeat,
    timingEnvironment: 'headless-browser',
    tileTransformHash: element.dataset.tileTransformHash,
  }));
  return { id, state, viewport, canvasCount: await page.locator('canvas').count(), ...runtime };
}

test.describe.serial('board system evidence', () => {
  test.skip(!enabled, 'Internal board lab is disabled in player builds.');

  test.beforeAll(async () => {
    await fs.mkdir(captureRoot, { recursive: true });
    await fs.mkdir(path.dirname(metricsPath), { recursive: true });
  });

  test.afterAll(async () => {
    if (scenes.length > 0) {
      await fs.writeFile(metricsPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), contractVersion: boardSystem.version, remountHeapGrowthMiB, scenes }, null, 2)}\n`);
    }
  });

  for (const viewport of boardSystem.requiredEvidence.viewports) {
    for (const state of boardSystem.requiredEvidence.states) {
      test(`${state} is stable at ${viewport.id}`, async ({ page }) => {
        const { lab, canvas } = await openBoard(page, state, viewport);
        await expect(lab).toHaveAttribute('data-board-state', state);
        await expect(page.getByTestId('board-lab-state-label')).toHaveText(state, { ignoreCase: true });
        const axe = await new AxeBuilder({ page }).include('[data-testid="board-lab"]').analyze();
        const serious = axe.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact));
        expect(serious, JSON.stringify(serious, null, 2)).toHaveLength(0);
        const scene = await readMetrics(page, canvas, `${state}-${viewport.id}`, state, viewport.id);
        expect(scene.canvasCount).toBeLessThanOrEqual(boardSystem.performance.maxCanvasCount);
        expect(scene.drawCalls).toBeLessThanOrEqual(boardSystem.performance.maxDrawCalls);
        expect(scene.triangles).toBeLessThanOrEqual(boardSystem.performance.maxTriangles);
        expect(scene.assetFailures).toBeLessThanOrEqual(boardSystem.performance.maxAssetFailures);
        expect(scene.contextLosses).toBeLessThanOrEqual(boardSystem.performance.maxContextLosses);
        expect(scene.assetLoading).toBe(0);
        expect(scene.assetExpected).toBeGreaterThan(0);
        expect(scene.assetLoaded + scene.assetFailures).toBe(scene.assetExpected);
        expect(scene.boardBeat).toBeTruthy();
        expect(scene.tileTransformHash).toBeTruthy();
        scenes.push(scene);
        await page.evaluate(() => {
          document.activeElement?.blur();
          document.querySelectorAll('[data-capture-hide]').forEach((element) => {
            element.style.visibility = 'hidden';
          });
        });
        const screenshot = await lab.screenshot({ animations: 'disabled' });
        await fs.writeFile(path.join(captureRoot, `${state}-${viewport.id}.png`), screenshot);
        expect(screenshot).toMatchSnapshot(['board-system', `${state}-${viewport.id}.png`], { maxDiffPixelRatio: 0.012, threshold: 0.2 });
      });
    }
  }

  test('transient state changes never move terrain or the camera', async ({ page }) => {
    const { canvas } = await openBoard(page, 'ready', { width: 1440, height: 1000 });
    const before = await canvas.evaluate((element) => ({ tiles: element.dataset.tileTransformHash, camera: element.dataset.cameraPose }));
    await page.getByRole('button', { name: 'Hover', exact: true }).click();
    await expect(page.getByTestId('board-lab')).toHaveAttribute('data-board-state', 'hover');
    const afterHover = await canvas.evaluate((element) => ({ tiles: element.dataset.tileTransformHash, camera: element.dataset.cameraPose }));
    await page.getByRole('button', { name: 'Selected', exact: true }).click();
    await expect(page.getByTestId('board-lab')).toHaveAttribute('data-board-state', 'selected');
    const afterSelection = await canvas.evaluate((element) => ({ tiles: element.dataset.tileTransformHash, camera: element.dataset.cameraPose }));
    expect(afterHover).toEqual(before);
    expect(afterSelection).toEqual(before);
  });

  test('renders exact-engine turn evidence through the canonical board model', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/board-lab?scenario=escape-pressure-4p&turn=0&quality=balanced', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('three-board-world')).toHaveAttribute('data-renderer-state', 'ready', { timeout: 60_000 });
    await expect(page.getByText('exact-engine', { exact: true })).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(1);
    await expect(page.locator('canvas')).toHaveAttribute('data-board-beat', /.+/);
  });

  test('camera controls stay bounded and return to the deterministic default', async ({ page }) => {
    const { world, canvas } = await openBoard(page, 'ready', { width: 1440, height: 1000 });
    const initialPose = await canvas.getAttribute('data-camera-pose');
    await page.getByRole('button', { name: 'Open camera controls' }).click();
    await page.getByRole('button', { name: 'Rotate camera left' }).click();
    await expect(world).toHaveAttribute('data-camera-view', 'custom');
    expect(await canvas.getAttribute('data-camera-pose')).not.toBe(initialPose);
    await page.getByRole('button', { name: 'Reset camera view' }).click();
    await expect(world).toHaveAttribute('data-camera-view', 'default');
    expect(await canvas.getAttribute('data-camera-pose')).toBe(initialPose);
    for (const preset of ['Overview', 'Party', 'Intent']) {
      await page.getByRole('button', { name: `${preset} camera preset` }).click();
      await expect(world).toHaveAttribute('data-camera-view', 'custom');
      expect(await canvas.getAttribute('data-camera-pose')).not.toBe(initialPose);
      await page.getByRole('button', { name: 'Reset camera view' }).click();
      await expect(world).toHaveAttribute('data-camera-view', 'default');
    }
  });

  test('keyboard tile controls reach the same canonical input channel', async ({ page }) => {
    const { lab } = await openBoard(page, 'ready', { width: 1440, height: 1000 });
    const tile = page.getByRole('button', { name: /^0,0 / });
    await tile.focus();
    await tile.press('Enter');
    await expect(lab).toHaveAttribute('data-last-input-alias', '0,0');
  });

  test('reports context loss and recovers without adding a canvas', async ({ page }) => {
    const { world, canvas } = await openBoard(page, 'ready', { width: 1440, height: 1000 });
    const canLoseContext = await canvas.evaluate((element) => {
      const gl = element.getContext('webgl2') || element.getContext('webgl');
      window.__boardContextLossExtension = gl?.getExtension('WEBGL_lose_context') || null;
      window.__boardContextLossExtension?.loseContext();
      return Boolean(window.__boardContextLossExtension);
    });
    expect(canLoseContext).toBe(true);
    await expect(world).toHaveAttribute('data-renderer-state', 'unavailable');
    await expect(canvas).toHaveAttribute('data-context-losses', '1');
    await page.evaluate(() => window.__boardContextLossExtension?.restoreContext());
    await expect(world).toHaveAttribute('data-renderer-state', 'ready');
    await expect(page.locator('canvas')).toHaveCount(1);
  });

  test('disposes repeated renderer mounts without accumulating canvases', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await openBoard(page, 'ready', { width: 1440, height: 1000 });
    await cdp.send('HeapProfiler.collectGarbage');
    const before = await cdp.send('Runtime.getHeapUsage');
    for (let index = 0; index < 4; index += 1) {
      await page.getByRole('button', { name: 'Remount board renderer' }).click();
      await expect(page.getByTestId('three-board-world')).toHaveAttribute('data-renderer-state', 'ready', { timeout: 60_000 });
      await expect(page.locator('canvas')).toHaveCount(1);
    }
    await cdp.send('HeapProfiler.collectGarbage');
    const after = await cdp.send('Runtime.getHeapUsage');
    remountHeapGrowthMiB = Math.max(0, (after.usedSize - before.usedSize) / (1024 * 1024));
    expect(remountHeapGrowthMiB).toBeLessThanOrEqual(boardSystem.performance.maxRemountHeapGrowthMiB);
  });

  test('meets strict frame and render budgets without a resolution escape hatch', async ({ page }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none', colorScheme: 'dark' });
    await page.goto('/board-lab?state=ready&quality=balanced&density=full', { waitUntil: 'domcontentloaded' });
    const canvas = page.getByTestId('three-board-world').locator('canvas');
    await expect(page.getByTestId('three-board-world')).toHaveAttribute('data-renderer-state', 'ready', { timeout: 60_000 });
    await expect(canvas).toBeVisible();
    await expect.poll(() => canvas.getAttribute('data-frame-p95'), { timeout: 90_000 }).not.toBeNull();
    await expect.poll(() => canvas.getAttribute('data-render-p95'), { timeout: 90_000 }).not.toBeNull();
    const metrics = await readMetrics(page, canvas, 'performance-desktop', 'ready', 'desktop');
    expect(metrics.frameP95Ms).toBeLessThanOrEqual(boardSystem.performance.maxHeadlessFrameP95Ms);
    expect(metrics.renderP95Ms).toBeLessThanOrEqual(boardSystem.performance.maxRenderP95Ms);
    expect(metrics.drawCalls).toBeLessThanOrEqual(boardSystem.performance.maxDrawCalls);
    expect(JSON.parse(metrics.tileTransformHash)).toHaveLength(100);
    scenes.push(metrics);
    await page.evaluate(() => {
      document.activeElement?.blur();
      document.querySelectorAll('[data-capture-hide]').forEach((element) => {
        element.style.visibility = 'hidden';
      });
    });
    const stressCapture = await page.getByTestId('board-lab').screenshot({ animations: 'disabled' });
    await fs.writeFile(path.join(captureRoot, 'stress-100-tile-desktop.png'), stressCapture);
  });

  test('preserves controls and status under forced colors', async ({ page }) => {
    const { world } = await openBoard(page, 'danger', { width: 390, height: 844 }, 'forced-colors');
    await expect(world).toHaveAttribute('data-board-phase', 'danger');
    await expect(page.getByRole('button', { name: 'Open camera controls' })).toBeVisible();
  });
});
