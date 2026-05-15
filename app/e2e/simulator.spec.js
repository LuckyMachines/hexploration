import { test, expect } from '@playwright/test';

test('simulator workbench renders without a report', async ({ page }) => {
  await page.goto('/simulator', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Gameplay Simulator/i })).toBeVisible();
  await expect(page.getByText(/Same-engine tuning workbench/i)).toBeVisible();
  await expect(page.getByText(/Run the simulator from the repo root/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Scenario Setup Forge/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Gameplay Oracle/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Scenario Autopilot/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Playable Design Memory/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Scenario Designer/i })).toBeVisible();
  await expect(page.getByText(/Solo Artifact Hunt/i)).toBeVisible();
});
