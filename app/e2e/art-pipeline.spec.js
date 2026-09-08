import AxeBuilder from '@axe-core/playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const internalToolsEnabled = process.env.VITE_ENABLE_INTERNAL_TOOLS === 'true';
const internalTest = internalToolsEnabled ? test : test.skip;

internalTest('art lab filters assets and preserves the selected production brief', async ({ page }) => {
  await page.goto('/art-lab', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Joy is designed/i })).toBeVisible();
  await expect(page.getByTestId('art-pipeline-registry')).toBeVisible();

  await page.getByRole('button', { name: 'approved', exact: true }).click();
  await page.locator('[data-asset-id="fx-discovery-bloom"]').click();
  await expect(page).toHaveURL(/status=approved/);
  await expect(page).toHaveURL(/asset=fx-discovery-bloom/);
  await expect(page.getByTestId('compiled-art-brief')).toContainText('genuinely transparent alpha');
  await expect(page.getByTestId('compiled-art-brief')).toContainText('Turn uncertainty into an inviting new possibility');
  const preview = page.locator('[data-asset-id="fx-discovery-bloom"] img');
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((image) => [image.naturalWidth, image.naturalHeight])).toEqual([1536, 1024]);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-asset-id="fx-discovery-bloom"]')).toHaveAttribute('aria-pressed', 'true');
});

internalTest('art lab remains accessible and readable on a narrow viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/art-lab?asset=relic-sunstone-lens-focal&status=approved', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);

  const dimensions = await page.locator('#main-content').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  const overflowing = await page.locator('#main-content *').evaluateAll((elements) => elements
    .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
    .slice(0, 8)
    .map((element) => ({
      tag: element.tagName,
      className: element.className,
      right: Math.round(element.getBoundingClientRect().right),
      scrollWidth: element.scrollWidth,
    })));
  expect(dimensions.scrollWidth, JSON.stringify(overflowing, null, 2)).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  const results = await new AxeBuilder({ page }).include('#main-content').analyze();
  const blocking = results.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact));
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);

  if (testInfo.project.name === 'chromium-desktop') {
    const captureDir = path.resolve(process.cwd(), '..', 'captures', 'art-pipeline');
    await fs.mkdir(captureDir, { recursive: true });
    const mobilePreviews = page.locator('[data-testid="art-pipeline-registry"] img');
    await expect.poll(async () => mobilePreviews.evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: path.join(captureDir, 'art-lab-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/art-lab?asset=relic-sunstone-lens-focal', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Joy is designed/i })).toBeVisible();
    await expect(page.getByTestId('art-pipeline-registry')).toBeVisible();
    const previews = page.locator('[data-testid="art-pipeline-registry"] img');
    await expect.poll(async () => previews.evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: path.join(captureDir, 'art-lab-desktop.png'), fullPage: true });
  }
});

internalTest('promoted relic parts render around truthful run data', async ({ page }, testInfo) => {
  await page.goto('/design-system?view=journeys&motion=reduce', { waitUntil: 'domcontentloaded' });
  const card = page.getByRole('article', { name: 'The Lantern Route Run Relic Card' });
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByText('842', { exact: true })).toBeVisible();
  await expect(card.getByText('4 / 4', { exact: true })).toBeVisible();

  const relic = card.locator('img[src="/images/art/relics/choir-seed.png"]');
  await expect(relic).toBeVisible();
  await expect.poll(() => relic.evaluate((image) => [image.naturalWidth, image.naturalHeight])).toEqual([1024, 1024]);
  const environment = card.locator('img[src="/images/art/environments/glassroot-cavern.webp"]');
  await expect(environment).toBeVisible();
  await expect.poll(() => environment.evaluate((image) => [image.naturalWidth, image.naturalHeight])).toEqual([1024, 700]);
  await expect(card.locator('[data-art-composition="choir-seed-glassroot-memory"]')).toBeVisible();

  if (testInfo.project.name === 'chromium-desktop') {
    const captureDir = path.resolve(process.cwd(), '..', 'captures', 'art-pipeline');
    await fs.mkdir(captureDir, { recursive: true });
    await page.addStyleTag({ content: '[data-testid="design-system-controls"] { position: static !important; }' });
    await card.screenshot({ path: path.join(captureDir, 'run-relic-in-context.png') });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/design-system?view=journeys&motion=reduce', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: 'a[href="#main-content"] { display: none !important; }' });
    const mobileCard = page.getByRole('article', { name: 'The Lantern Route Run Relic Card' });
    await mobileCard.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.activeElement?.blur());
    const mobileDimensions = await mobileCard.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(mobileDimensions.scrollWidth).toBeLessThanOrEqual(mobileDimensions.clientWidth + 1);
    await mobileCard.screenshot({ path: path.join(captureDir, 'run-relic-in-context-mobile.png') });
  }
});
