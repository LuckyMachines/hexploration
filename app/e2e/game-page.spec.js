import { test, expect } from '@playwright/test';

test('invalid game id shows validation state', async ({ page }) => {
  await page.goto('/game/not-a-number');

  await expect(page.getByText(/Invalid expedition id/i)).toBeVisible();
});
