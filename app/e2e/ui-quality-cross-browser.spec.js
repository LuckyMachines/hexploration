import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const enabled = process.env.VITE_ENABLE_INTERNAL_TOOLS === 'true';
const qualityTest = enabled ? test : test.skip;

qualityTest('public promise reflows without serious accessibility defects', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toContainText('Choose your expedition');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const axe = await new AxeBuilder({ page }).include('#main-content').analyze();
  expect(axe.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact)), JSON.stringify(axe.violations, null, 2)).toHaveLength(0);
});

qualityTest('board review keeps its hierarchy and renderer contract', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/design-system?view=gameplay&lens=ready&motion=reduce', { waitUntil: 'networkidle' });
  await expect(page.locator('[data-design-section="board"]')).toBeVisible();
  await expect(page.locator('[data-testid="three-board-world"]')).toHaveAttribute('data-renderer-state', 'ready', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'The board owns the stage' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
