import { test, expect } from '@playwright/test';

test('public play loop completes and exposes sharing', async ({ page }) => {
  await page.goto('/play?scenario=solo-artifact-hunt&seed=e2e-growth', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Solo Artifact Hunt/i })).toBeVisible();
  await expect(page.getByText(/Action preview/i)).toBeVisible();
  await expect(page.getByText(/Fun Report/i)).toBeVisible();
  await expect(page.getByText(/Evidence pending|Featured ready|Playable with caveats|Needs more fun|Missing evidence/i).first()).toBeVisible();
  await expect(page.getByText(/After the first reveal, this run earns a fingerprint/i)).toBeVisible();

  await page.getByRole('button', { name: /Move/i }).click();
  if (!await page.getByText(/Run Fingerprint/i).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /Dig/i }).click();
  }
  await expect(page.getByText(/Run Fingerprint/i)).toBeVisible();
  await expect(page.getByText(/Benchmark:/i).first()).toBeVisible();

  for (const label of ['Move', 'Flee', 'Flee', 'Rest']) {
    const button = page.getByRole('button', { name: new RegExp(label, 'i') });
    if (await button.isVisible().catch(() => false)) await button.click();
  }

  await expect(page.getByText(/Your next expedition/i)).toBeVisible();
  await expect(page.getByText(/Beat .*|Do not let the run disappear/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Save and share memory/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Take weekly challenge/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Go live with a crew/i })).toBeVisible();
  await expect(page.getByText(/Generate share card|Share copied/i)).toBeVisible();
  await page.getByRole('button', { name: /Save and share memory/i }).click();
  await expect(page.getByText(/Generated Share Relic/i)).toBeVisible();
  await expect(page.getByText(/Can you beat score|Can you escape under pressure/i).first()).toBeVisible();
  await expect(page.getByText(/Memory Created/i).first()).toBeVisible();
  await expect(page.getByText(/Beat This Challenge/i).first()).toBeVisible();
  await expect(page.getByText(/Run Relic Card/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Copy share text/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Download relic SVG/i }).first()).toBeVisible();
  const replay = page.getByRole('link', { name: /Replay this run/i });
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(page.getByRole('heading', { name: /Replay:/i })).toBeVisible();
  await expect(page.getByText(/Replay Fingerprint/i)).toBeVisible();
  await expect(page.getByText(/Replay Relic/i)).toBeVisible();
  await expect(page.getByText(/Share the expedition as a relic/i).first()).toBeVisible();
});

test('growth public routes render', async ({ page }) => {
  await page.goto('/challenge', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Challenge:/i })).toBeVisible();
  await expect(page.getByText(/Heavy Fog|Low Morale|Extra Relic|Damaged Route|Calm Start|Storm Season/i)).toBeVisible();

  await page.goto('/scenarios', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Expedition Scenarios/i })).toBeVisible();
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
