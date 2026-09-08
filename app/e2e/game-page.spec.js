import { test, expect } from '@playwright/test';

const internalToolsEnabled = process.env.VITE_ENABLE_INTERNAL_TOOLS === 'true';
const internalTest = internalToolsEnabled ? test : test.skip;

test('invalid game id shows validation state', async ({ page }) => {
  await page.goto('/game/not-a-number', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText(/Invalid survey id/i)).toBeVisible();
});

internalTest('ui lab exposes board input and route controls', async ({ page }) => {
  await page.goto('/ui-lab', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: /Game UI Lab/i })).toBeVisible();
  await expect(page.getByText(/Input Feel Harness/i)).toBeVisible();
  const undoStep = page.getByRole('button', { name: /Undo Step/i }).first();
  await expect(undoStep).toBeVisible();
  await undoStep.click();
});

internalTest('design system can review gameplay states and component coverage', async ({ page }) => {
  await page.goto('/design-system', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: /One language.*Every expedition moment/i })).toBeVisible();
  await page.getByRole('button', { name: 'Gameplay', exact: true }).click();
  await expect(page.locator('[data-design-section="board"]')).toBeVisible();
  await expect(page.locator('[data-design-section="foundations"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Danger', exact: true }).click();
  await expect(page.getByRole('img', { name: 'danger board state' }).first()).toBeVisible();
  await expect(page.getByText('The Sunstone Lens will be exposed')).toBeVisible();

  await page.getByRole('button', { name: 'Standards', exact: true }).click();
  const registry = page.getByTestId('coverage-registry');
  await registry.getByRole('searchbox').fill('Hex Board');
  await expect(registry.getByText('Hex Board')).toBeVisible();
  await expect(registry.getByText('Showing 1')).toBeVisible();
});
