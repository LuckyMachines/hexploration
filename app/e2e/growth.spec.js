import { test, expect } from '@playwright/test';

test('public play loop completes and exposes sharing', async ({ page }) => {
  await page.goto('/play?scenario=solo-artifact-hunt&seed=e2e-growth', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Solo Artifact Hunt/i })).toBeVisible();
  await expect(page.getByText(/Action preview/i)).toBeVisible();
  await expect(page.getByText(/Fun Report/i)).toBeVisible();
  await expect(page.getByText(/Evidence pending|Featured ready|Playable with caveats|Needs more fun|Missing evidence/i).first()).toBeVisible();

  for (const label of ['Move', 'Dig', 'Move', 'Flee', 'Flee', 'Rest']) {
    const button = page.getByRole('button', { name: new RegExp(label, 'i') });
    if (await button.isVisible().catch(() => false)) await button.click();
  }

  await expect(page.getByText(/Generate share card|Share copied/i)).toBeVisible();
  await page.getByRole('button', { name: /Generate share card/i }).click();
  await expect(page.getByText('Share card', { exact: true })).toBeVisible();
  await expect(page.getByText(/Can you beat this run/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Replay run/i })).toBeVisible();
});

test('growth public routes render', async ({ page }) => {
  await page.goto('/challenge', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Challenge:/i })).toBeVisible();
  await expect(page.getByText(/Heavy Fog|Low Morale|Extra Relic|Damaged Route|Calm Start|Storm Season/i)).toBeVisible();

  await page.goto('/scenarios', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Scenario Gallery/i })).toBeVisible();
  await expect(page.getByText(/Escape Pressure 4P/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Featured ready/i })).toBeVisible();

  await page.goto('/progress', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Scenario Progress/i })).toBeVisible();
  await expect(page.getByText(/Ready/i).first()).toBeVisible();

  await page.goto('/devlog', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Design Devlog/i })).toBeVisible();

  await page.goto('/create-scenario', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Create Scenario/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Test scenario/i })).toBeVisible();
  await expect(page.getByText(/Evidence requirements/i)).toBeVisible();
});
