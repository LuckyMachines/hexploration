import { expect, test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import materialSystem from '../src/art-pipeline/material-system.json' with { type: 'json' };

const enabled = process.env.VITE_ENABLE_INTERNAL_TOOLS === 'true';
const captureRoot = path.resolve('..', 'artifacts', 'materials', 'renders');

test.describe('material and lighting system', () => {
  test.skip(!enabled, 'Internal material lab is disabled in player builds.');

  test.beforeAll(async () => {
    await fs.mkdir(captureRoot, { recursive: true });
  });

  test('renders every surface contract and debug channel', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/material-lab', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('material-lab')).toBeVisible();
    await expect(page.locator('canvas[data-material-preview="ready"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Glassroot Canopy' })).toHaveAttribute('aria-pressed', 'true');
    for (const channel of ['albedo', 'normal', 'roughness', 'ao', 'height', 'emissive']) {
      await expect(page.getByAltText(`Glassroot Canopy ${channel === 'albedo' ? 'baseColor' : channel} map`)).toBeVisible();
    }
    await page.getByTestId('material-lab').screenshot({ path: path.join(captureRoot, 'material-lab-neutral.png'), animations: 'disabled' });
  });

  test('captures every material in the same neutral rig', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 960, height: 680 });
    for (const material of materialSystem.materials) {
      await page.goto(`/material-lab?material=${material.id}&rig=neutral&quality=high`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('canvas[data-material-preview="ready"]')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('material-preview-scene').screenshot({ path: path.join(captureRoot, `lookdev-${material.id}-neutral.png`), animations: 'disabled' });
    }
  });

  for (const rigId of materialSystem.qualityContract.captureRigs) {
    test(`captures ${rigId} lighting`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 820 });
      await page.goto(`/material-lab?material=violet-reliquary&rig=${rigId}&quality=high`, { waitUntil: 'domcontentloaded' });
      const canvas = page.locator('canvas[data-material-preview="ready"]');
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      const metrics = await canvas.evaluate((element) => ({
        drawCalls: Number(element.dataset.drawCalls || 0),
        textures: Number(element.dataset.textures || 0),
      }));
      expect(metrics.drawCalls).toBeLessThanOrEqual(20);
      expect(metrics.textures).toBeLessThanOrEqual(20);
      await page.getByTestId('material-preview-scene').screenshot({ path: path.join(captureRoot, `lookdev-${rigId}.png`), animations: 'disabled' });
    });
  }

  test('keeps efficient rendering intentional', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/material-lab?material=emberglass-dunes&quality=efficient', { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('canvas[data-material-preview="ready"]');
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    const textures = await canvas.evaluate((element) => Number(element.dataset.textures || 0));
    expect(textures).toBeLessThanOrEqual(12);
    await page.getByTestId('material-preview-scene').screenshot({ path: path.join(captureRoot, 'lookdev-efficient-mobile.png'), animations: 'disabled' });
  });

  test('captures integrated board rigs without moving its layout', async ({ page }) => {
    test.setTimeout(150_000);
    const browserErrors = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    await page.setViewportSize({ width: 1440, height: 1100 });
    const runtimeEvidence = [];
    for (const lens of ['ready', 'danger']) {
      await page.goto(`/design-system?view=gameplay&lens=${lens}&motion=reduce`, { waitUntil: 'domcontentloaded' });
      const board = page.locator('[data-design-section="board"]');
      await expect.poll(() => board.locator('[data-renderer-state]').getAttribute('data-renderer-state'), { timeout: 60_000 }).toMatch(/ready|unavailable/);
      try {
        await expect(board.locator('[data-renderer-state="ready"]')).toBeVisible();
      } catch (error) {
        const state = await board.locator('[data-renderer-state]').getAttribute('data-renderer-state').catch(() => 'missing');
        const rendererError = await board.locator('[data-renderer-error]').getAttribute('data-renderer-error').catch(() => 'none');
        throw new Error(`Board renderer remained ${state}. Renderer error: ${rendererError}. Browser errors: ${browserErrors.join(' | ') || 'none'}`, { cause: error });
      }
      const canvas = board.locator('canvas');
      await expect(canvas).toHaveAttribute('data-material-system-version', materialSystem.version);
      const metrics = await canvas.evaluate((element) => ({
        drawCalls: Number(element.dataset.drawCalls || 0),
        triangles: Number(element.dataset.triangles || 0),
        textures: Number(element.dataset.textures || 0),
        lightingRig: element.dataset.lightingRig,
      }));
      expect(metrics.drawCalls).toBeLessThanOrEqual(materialSystem.qualityContract.performance.maxDrawCalls);
      expect(metrics.textures).toBeLessThanOrEqual(materialSystem.qualityContract.performance.maxTextures);
      expect(metrics.triangles).toBeGreaterThan(0);
      expect(metrics.lightingRig).toBe(lens === 'danger' ? 'danger' : 'neutral');
      runtimeEvidence.push({ lens, ...metrics });
      await board.screenshot({ path: path.join(captureRoot, `board-${lens}.png`), animations: 'disabled' });
    }
    await fs.writeFile(
      path.join(captureRoot, 'board-runtime-metrics.json'),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), materialSystemVersion: materialSystem.version, states: runtimeEvidence }, null, 2)}\n`,
    );
  });

  test('holds the board frame budget and exposes adaptive resolution', async ({ page }) => {
    test.setTimeout(150_000);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => window.localStorage.removeItem('xenovoya:user-preferences'));
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto('/design-system?view=gameplay&lens=ready', { waitUntil: 'domcontentloaded' });
    const canvas = page.locator('[data-design-section="board"] [data-renderer-state="ready"] canvas');
    await expect(canvas).toBeVisible({ timeout: 60_000 });
    await canvas.scrollIntoViewIfNeeded();
    await expect.poll(() => canvas.getAttribute('data-frame-p95'), { timeout: 60_000 }).not.toBeNull();
    const performance = await canvas.evaluate((element) => ({
      frameP95Ms: Number(element.dataset.frameP95),
      pixelRatio: Number(element.dataset.pixelRatio),
      quality: element.dataset.boardQuality,
    }));
    const metFrameBudget = performance.frameP95Ms <= materialSystem.qualityContract.performance.maxFrameP95Ms;
    expect(metFrameBudget || performance.pixelRatio === 1).toBe(true);
    expect(performance.pixelRatio).toBeGreaterThanOrEqual(1);
    expect(performance.quality).toMatch(/high|balanced/);
    await fs.writeFile(
      path.join(captureRoot, 'runtime-metrics.json'),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), ...performance }, null, 2)}\n`,
    );
  });
});
