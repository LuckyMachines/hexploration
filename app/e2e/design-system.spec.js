import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

const internalToolsEnabled = process.env.VITE_ENABLE_INTERNAL_TOOLS === 'true';
const internalTest = internalToolsEnabled ? test : test.skip;

internalTest('review state is shareable and comparison preserves geometry', async ({ page }) => {
  await page.goto('/design-system', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: 'Gameplay', exact: true }).click();
  await page.getByRole('button', { name: 'Danger', exact: true }).click();
  await page.getByRole('button', { name: 'Compare states', exact: true }).click();
  await page.getByLabel('Compare with state').selectOption('waiting');
  await page.getByRole('button', { name: 'Reduce motion', exact: true }).click();

  await expect(page).toHaveURL(/view=gameplay/);
  await expect(page).toHaveURL(/lens=danger/);
  await expect(page).toHaveURL(/compare=1/);
  await expect(page).toHaveURL(/compareWith=waiting/);
  await expect(page).toHaveURL(/motion=reduce/);
  const comparison = page.getByTestId('state-comparison');
  await expect(comparison).toBeVisible();
  await expect(comparison.getByTestId('state-summary-danger')).toBeVisible();
  await expect(comparison.getByTestId('state-summary-waiting')).toBeVisible();
  await expect(page.locator('[data-testid="three-board-world"]')).toHaveCount(1);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Gameplay', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Motion reduced', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

internalTest('design system has no serious or critical automated accessibility violations', async ({ page }) => {
  await page.goto('/design-system?view=components&motion=reduce', { waitUntil: 'domcontentloaded' });
  const results = await new AxeBuilder({ page }).include('#main-content').analyze();
  const blocking = results.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact));
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
});

internalTest('3D board camera moves only through deliberate orbit, pan, and zoom controls', async ({ page }) => {
  await page.goto('/design-system?view=gameplay&lens=ready&motion=reduce', { waitUntil: 'domcontentloaded' });
  const board = page.getByTestId('three-board-world');
  await expect(board).toHaveAttribute('data-renderer-state', 'ready');
  await expect(page.getByTestId('board-camera-controls')).toBeVisible();

  const canvas = board.locator('canvas');
  const initialPose = await canvas.getAttribute('data-camera-pose');
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();

  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.45);
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.55);
  await expect(board).toHaveAttribute('data-camera-view', 'default');
  await expect(canvas).toHaveAttribute('data-camera-pose', initialPose);

  await page.getByRole('button', { name: 'Open camera controls' }).click();
  await page.getByRole('button', { name: 'Rotate camera left' }).click();
  await expect(board).toHaveAttribute('data-camera-view', 'custom');
  const rotatedPose = await canvas.getAttribute('data-camera-pose');
  expect(rotatedPose).not.toBe(initialPose);

  await page.getByRole('button', { name: 'Zoom camera in' }).click();
  await expect(canvas).not.toHaveAttribute('data-camera-pose', rotatedPose);
  await page.getByRole('button', { name: 'Reset camera view' }).click();
  await expect(board).toHaveAttribute('data-camera-view', 'default');
  await expect(canvas).toHaveAttribute('data-camera-pose', initialPose);

  await page.getByRole('button', { name: 'Pan camera right' }).click();
  await expect(board).toHaveAttribute('data-camera-view', 'custom');
  await expect(canvas).not.toHaveAttribute('data-camera-pose', initialPose);
  await page.getByRole('button', { name: 'Close camera controls' }).click();
});

internalTest('design system survives 200 percent text and a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/design-system?view=standards&motion=reduce', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: 'html { font-size: 36px !important; }' });

  const dimensions = await page.locator('.design-system-shell').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  const reset = page.getByRole('button', { name: 'Reset', exact: true });
  const box = await reset.boundingBox();
  expect(box?.height || 0).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('heading', { name: /Accessibility and writing/i })).toBeVisible();
});

internalTest('copy stress mode is reversible without a reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/design-system?view=foundation', { waitUntil: 'domcontentloaded' });
  const heading = page.getByRole('heading', { name: /One language.*Every expedition moment/i });
  await expect(heading).toBeVisible();

  await page.getByRole('button', { name: 'Stress copy', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/xv-pseudo-locale/);
  await expect(page).toHaveURL(/pseudo=1/);
  const stressedWidth = await page.locator('.design-system-shell').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(stressedWidth.scrollWidth).toBeLessThanOrEqual(stressedWidth.clientWidth + 1);

  await page.getByRole('button', { name: 'Copy stress on', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/xv-pseudo-locale/);
  await expect(heading).toBeVisible();
});

internalTest('failure examples preserve context and expose a reversible recovery', async ({ page }) => {
  await page.goto('/design-system?view=components&motion=reduce', { waitUntil: 'domcontentloaded' });
  const lab = page.getByTestId('recovery-lab');
  await expect(lab.getByText('Wallet declined')).toBeVisible();

  await lab.getByRole('button', { name: 'Try wallet again', exact: true }).click();
  await expect(lab.getByText('Recovery available').first()).toBeVisible();
  await expect(lab.getByText(/no player intent or progress was lost/i).first()).toBeVisible();

  await lab.getByRole('button', { name: 'Reset example', exact: true }).first().click();
  await expect(lab.getByText('Wallet declined')).toBeVisible();
});
