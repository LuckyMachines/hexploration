import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function clearReturnState(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('xenovoya:return-loop:v2');
    localStorage.removeItem('xenovoya:return-loop:v1');
    localStorage.removeItem('xenovoya:analytics-dedupe:v1');
    sessionStorage.removeItem('xenovoya:analytics-journey:v1');
    sessionStorage.removeItem('xenovoya:analytics-journey-sequence:v1');
  });
}

async function openReturnLoop(page) {
  const details = page.getByTestId('return-loop-details');
  if (!(await details.evaluate((element) => element.open))) await details.locator('summary').click();
  return page.getByTestId('return-loop-panel');
}

test('screen-reader structure exposes the promise, landmarks, and named controls', async ({ page }) => {
  await clearReturnState(page);
  await page.goto('/', { waitUntil: 'networkidle' });

  const axe = await new AxeBuilder({ page }).include('#main-content').analyze();
  const serious = axe.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact));
  expect(serious, JSON.stringify(serious, null, 2)).toHaveLength(0);

  await expect(page.getByRole('heading', { level: 1, name: /Choose your expedition/i })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Player navigation' })).toBeAttached();
  await expect(page.getByRole('region', { name: 'Choose your expedition.' })).toBeAttached();
  await page.getByTestId('player-settings-toggle').click();
  await expect(page.getByRole('button', { name: 'Open Field Manual' })).toBeVisible();

  const headingLevels = await page.locator('#main-content h1, #main-content h2, #main-content h3').evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))));
  expect(headingLevels[0]).toBe(1);
  expect(headingLevels.filter((level) => level === 1)).toHaveLength(1);
  for (let index = 1; index < headingLevels.length; index += 1) expect(headingLevels[index] - headingLevels[index - 1]).toBeLessThanOrEqual(1);
});

test('starter changes are announced and the help dialog restores focus', async ({ page }) => {
  await clearReturnState(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  const panel = await openReturnLoop(page);
  await panel.scrollIntoViewIfNeeded();

  const announcement = page.getByTestId('return-loop-announcement');
  await expect(announcement).toHaveAttribute('role', 'status');
  await expect(announcement).toHaveAttribute('aria-live', 'polite');
  await panel.getByRole('button', { name: /Scout/ }).click();
  await expect(announcement).toContainText('Create your first expedition thread');
  await panel.getByRole('button', { name: 'Create expedition thread' }).click();
  await expect(announcement).toContainText('Active');
  await panel.getByRole('button', { name: 'Mark decision ready' }).click();
  await expect(announcement).toContainText('Waiting on crew');

  await page.getByTestId('player-settings-toggle').click();
  const help = page.getByRole('button', { name: 'Open Field Manual' });
  await help.focus();
  await help.click();
  const dialog = page.getByRole('dialog', { name: 'Field Manual' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(help).toBeFocused();
});
