import { test, expect } from '@playwright/test';

test('invalid game id shows validation state', async ({ page }) => {
  await page.goto('/game/not-a-number', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText(/Invalid survey id/i)).toBeVisible();
});

test('ui lab exposes board input and route controls', async ({ page }) => {
  await page.goto('/ui-lab', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: /Game UI Lab/i })).toBeVisible();
  await expect(page.getByText(/Input Feel Harness/i)).toBeVisible();
  const undoStep = page.getByRole('button', { name: /Undo Step/i }).first();
  await expect(undoStep).toBeVisible();
  await undoStep.click();
});
