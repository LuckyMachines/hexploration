import { test, expect } from '@playwright/test';

const expectOpenGame = process.env.E2E_EXPECT_OPEN_GAME === 'true';

test('home page renders core surfaces', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Expedition Console/i })).toBeVisible();
  await expect(page.getByText(/System Health/i)).toBeVisible();
  await expect(page.getByText(/Available Expeditions/i)).toBeVisible();
});

test('seeded anvil mode shows at least one expedition', async ({ page }) => {
  test.skip(!expectOpenGame, 'Only required for anvil-seeded runs.');

  await page.goto('/');
  await expect(page.locator('text=/EXP-\\d{3}/').first()).toBeVisible();
});

test('field manual modal opens and closes with Escape', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /Open Field Manual/i }).click();
  await expect(page.getByRole('dialog', { name: /Field Manual/i })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /Field Manual/i })).toBeHidden();
});
