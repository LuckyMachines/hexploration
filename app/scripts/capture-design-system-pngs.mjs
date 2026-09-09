import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseURL = String(process.env.DESIGN_SYSTEM_BASE_URL || 'http://127.0.0.1:22678').replace(/\/$/, '');
const outputDir = path.resolve('public', 'design-system-pngs');
const scenes = [
  { file: '01-system-overview.png', route: '/design-system?view=all&lens=ready&motion=reduce', selector: '[data-design-section="overview"]', viewport: { width: 1440, height: 1100 } },
  { file: '02-foundations.png', route: '/design-system?view=foundation&lens=ready&motion=reduce', selector: '[data-design-section="foundations"]', viewport: { width: 1440, height: 1100 } },
  { file: '03-controls.png', route: '/design-system?view=components&lens=ready&motion=reduce', selector: '[data-design-section="controls"]', viewport: { width: 1440, height: 1100 } },
  { file: '04-board-ready.png', route: '/design-system?view=gameplay&lens=ready&motion=reduce', selector: '[data-design-section="board"]', viewport: { width: 1440, height: 1100 }, board: true },
  { file: '05-board-danger.png', route: '/design-system?view=gameplay&lens=danger&motion=reduce', selector: '[data-design-section="board"]', viewport: { width: 1440, height: 1100 }, board: true },
  { file: '06-journey-complete.png', route: '/design-system?view=journeys&lens=complete&motion=reduce', selector: '[data-design-section="journeys"]', viewport: { width: 1440, height: 1100 } },
  { file: '07-responsive-mobile.png', route: '/design-system?view=journeys&lens=danger&motion=reduce', selector: '[data-design-section="responsive"]', viewport: { width: 390, height: 844 } },
  { file: '08-standards-and-evidence.png', route: '/design-system?view=standards&lens=ready&motion=reduce', selector: '[data-design-section="standards"]', viewport: { width: 1440, height: 1100 } },
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const scene of scenes) {
    const page = await browser.newPage({ viewport: scene.viewport, deviceScaleFactor: 1 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto(`${baseURL}${scene.route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}[data-testid="design-system-controls"],[data-capture-hide]{display:none!important}' });
    await page.evaluate(() => document.fonts?.ready);
    const target = page.locator(scene.selector).first();
    await target.waitFor({ state: 'visible', timeout: 20_000 });
    if (scene.board) await page.locator('[data-testid="three-board-world"]').waitFor({ state: 'visible', timeout: 20_000 });
    const initialBox = await target.boundingBox();
    if (initialBox) {
      await page.setViewportSize({
        width: scene.viewport.width,
        height: Math.min(5_000, Math.max(scene.viewport.height, Math.ceil(initialBox.height) + 160)),
      });
    }
    await target.scrollIntoViewIfNeeded();
    await target.screenshot({ path: path.join(outputDir, scene.file), animations: 'disabled' });
    process.stdout.write(`CAPTURED ${scene.file}\n`);
    await page.close();
  }
} finally {
  await browser.close();
}

process.stdout.write(`OUTPUT ${outputDir}\n`);
