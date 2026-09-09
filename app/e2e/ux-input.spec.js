import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('keyboard path exposes skip navigation and completes the starter decision', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  const panel = page.getByTestId('return-loop-panel');
  await panel.scrollIntoViewIfNeeded();
  const role = panel.getByRole('button', { name: /Scout/ });
  await role.focus();
  await page.keyboard.press('Enter');
  const create = panel.getByRole('button', { name: 'Create expedition thread' });
  await create.focus();
  await page.keyboard.press('Enter');
  const ready = panel.getByRole('button', { name: 'Mark decision ready' });
  await ready.focus();
  await page.keyboard.press('Enter');
  await expect(panel).toContainText('Waiting on crew');
});

test('200 percent text reflow preserves content and avoids page overflow at 320 CSS pixels', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole('heading', { name: /Chart the strange/ })).toBeVisible();
});

test('forced colors and reduced motion retain accessible structure', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'networkidle' });
  const axe = await new AxeBuilder({ page }).include('#main-content').analyze();
  const serious = axe.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact));
  expect(serious, JSON.stringify(serious, null, 2)).toHaveLength(0);
  const moving = await page.evaluate(() => [...document.querySelectorAll('*')].filter((element) => {
    const style = getComputedStyle(element);
    return style.animationDuration !== '0s' && style.animationPlayState === 'running';
  }).length);
  expect(moving).toBe(0);
});
