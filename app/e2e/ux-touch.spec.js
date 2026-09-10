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

async function expectTouchTargets(locator) {
  const small = await locator.locator('button:visible, a[href]:visible').evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { name: element.getAttribute('aria-label') || element.textContent.trim().slice(0, 60), width: rect.width, height: rect.height };
  }).filter(({ width, height }) => width < 44 || height < 44));
  expect(small, JSON.stringify(small, null, 2)).toHaveLength(0);
}

test('touch player completes the starter decision without hover or overflow', async ({ page, isMobile }) => {
  expect(isMobile).toBe(true);
  await clearReturnState(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  const panel = page.getByTestId('return-loop-panel');
  await panel.scrollIntoViewIfNeeded();
  await expectTouchTargets(panel);

  await panel.getByRole('button', { name: /Scout/ }).tap();
  await panel.getByRole('button', { name: 'Create expedition thread' }).tap();
  await expect(panel).toContainText('A relic-frequency is still pointing beyond the first ridge.');
  await panel.getByRole('button', { name: 'Mark decision ready' }).tap();
  await expect(panel).toContainText('Waiting on crew');
  await expectTouchTargets(panel);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('touch dialog and destructive confirmation remain deliberate', async ({ page }) => {
  await clearReturnState(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  const help = page.getByRole('button', { name: 'Open Field Manual' });
  await help.tap();
  const close = page.getByRole('dialog', { name: 'Field Manual' }).getByRole('button', { name: 'Close' });
  const closeBox = await close.boundingBox();
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);
  await close.tap();

  const panel = page.getByTestId('return-loop-panel');
  await panel.scrollIntoViewIfNeeded();
  await panel.getByRole('button', { name: /Scout/ }).tap();
  await panel.getByRole('button', { name: 'Create expedition thread' }).tap();
  await panel.getByRole('button', { name: 'Clear local history' }).tap();
  await expect(panel.getByRole('button', { name: 'Confirm local clear' })).toBeVisible();
  await expect(panel).toContainText('Sector 0 signal');
});
