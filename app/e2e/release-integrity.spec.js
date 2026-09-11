import { test, expect } from '@playwright/test';

const publicRoutes = ['/', '/guest', '/privacy', '/not-a-public-route'];

for (const route of publicRoutes) {
  test(`${route} keeps a sound document structure without horizontal overflow`, async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    const response = await page.goto(route, { waitUntil: 'networkidle' });
    expect(response?.ok()).toBe(true);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(pageErrors).toEqual([]);
  });
}

test('skip link moves keyboard focus to the main content', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('primary public controls meet the 44px touch target bar', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const controls = page.locator('header a:visible, header button:visible, #live-expedition a:visible, #live-expedition button:visible');
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    const box = await control.boundingBox();
    expect(box, `control ${index} should have a rendered box`).not.toBeNull();
    expect(box.height, `control ${index} should be at least 44px tall`).toBeGreaterThanOrEqual(44);
  }
});

test('the no-JavaScript shell carries production discovery metadata', async ({ request }) => {
  const response = await request.get('/');
  expect(response.ok()).toBe(true);
  const html = await response.text();

  expect(html).toContain('<link rel="canonical" href="https://play.xenovoya.com"');
  expect(html).toContain('https://play.xenovoya.com/seo/xenovoya-share-card.png');
  expect(html).toContain('name="description"');
  expect(html).toContain('name="theme-color"');
});
