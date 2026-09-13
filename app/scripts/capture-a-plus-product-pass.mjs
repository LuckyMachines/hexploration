import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const playUrl = process.env.XENOVOYA_CAPTURE_PLAY_URL || 'http://127.0.0.1:11136';
const marketingUrl = process.env.XENOVOYA_CAPTURE_MARKETING_URL || 'http://127.0.0.1:11135';
const outputDir = path.resolve(process.env.XENOVOYA_CAPTURE_OUTPUT_DIR || '../../xenovoya-coordinator/reports/visual-evidence/2026-09-12/a-plus-product-pass');

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function newPage(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('xenovoya:user-preferences', JSON.stringify({ reducedMotion: true, tacticalBoard: false, analytics: false }));
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '*,*::before,*::after{animation-duration:0.001ms!important;transition-duration:0.001ms!important;caret-color:transparent!important}';
      document.head.append(style);
    });
  });
  const page = await context.newPage();
  return { context, page };
}

async function capture(page, name, options = {}) {
  await page.screenshot({ path: path.join(outputDir, name), animations: 'disabled', ...options });
}

try {
  {
    const { context, page } = await newPage({ width: 1440, height: 1000 });
    await page.goto(marketingUrl, { waitUntil: 'networkidle' });
    await capture(page, '01-marketing-desktop.png');
    await context.close();
  }

  {
    const { context, page } = await newPage({ width: 1440, height: 1000 });
    await page.goto(`${playUrl}/?mode=choose`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: /Choose your expedition/i }).waitFor();
    await capture(page, '02-play-choose-desktop.png');
    await context.close();
  }

  {
    const { context, page } = await newPage({ width: 1440, height: 1000 });
    await page.goto(`${playUrl}/guest`, { waitUntil: 'domcontentloaded' });
    const board = page.getByTestId('three-board-world');
    await board.waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="three-board-world"]')?.dataset.rendererState === 'ready', null, { timeout: 30_000 });
    await capture(page, '03-guest-first-choice-desktop.png');
    await board.screenshot({ path: path.join(outputDir, '04-guest-board-3d.png'), animations: 'disabled' });
    await page.getByRole('group', { name: /Reachable routes/i }).getByRole('button', { name: /3,2 Uncharted/i }).click();
    await page.getByTestId('commit-guest-route').click();
    await page.getByRole('heading', { name: /Tideglass Answered/i }).waitFor();
    await page.waitForFunction(() => document.querySelector('[data-testid="three-board-world"]')?.dataset.rendererState === 'ready', null, { timeout: 30_000 });
    await capture(page, '05-guest-relic-desktop.png');
    await context.close();
  }

  {
    const { context, page } = await newPage({ width: 390, height: 844 });
    await page.goto(`${playUrl}/guest?mode=practice`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Use tactical map/i }).click();
    await page.getByTestId('guest-tactical-board').waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, '06-guest-tactical-mobile.png');
    await context.close();
  }
} finally {
  await browser.close();
}

process.stdout.write(`${outputDir}\n`);
