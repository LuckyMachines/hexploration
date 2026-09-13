import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const playUrl = process.env.XENOVOYA_CAPTURE_PLAY_URL || 'http://127.0.0.1:11136';
const outputDir = path.resolve(process.env.XENOVOYA_CAPTURE_OUTPUT_DIR || '../../xenovoya-coordinator/reports/visual-evidence/2026-09-13/premium-aaa-vertical-slice/after');

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function createPage(viewport, reducedMotion = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await context.addInitScript(({ reduceMotion }) => {
    window.__XENOVOYA_PRESENTATION_SCALE__ = 4;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('xenovoya:user-preferences', JSON.stringify({ reducedMotion: reduceMotion, tacticalBoard: false, analytics: false }));
    localStorage.setItem('xenovoya:audio', JSON.stringify({ musicEnabled: false, sfxEnabled: false }));
  }, { reduceMotion: reducedMotion });
  return { context, page: await context.newPage() };
}

async function waitForWorld(page) {
  await page.getByTestId('three-board-world').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="three-board-world"]')?.dataset.rendererState === 'ready', null, { timeout: 30_000 });
}

async function capture(page, name, options = {}) {
  await page.screenshot({ path: path.join(outputDir, name), animations: 'disabled', ...options });
}

async function selectRoute(page, alias) {
  await page.getByRole('group', { name: /Reachable routes/i }).getByRole('button', { name: new RegExp(`^${alias.replace(',', ',?\\s*')}`) }).click();
}

try {
  {
    const { context, page } = await createPage({ width: 1440, height: 1000 });
    await page.goto(`${playUrl}/guest`, { waitUntil: 'domcontentloaded' });
    await waitForWorld(page);
    await capture(page, '01-arrival-desktop.png');

    await page.getByRole('button', { name: /Focus world/i }).click();
    await page.waitForTimeout(120);
    await capture(page, '02-focus-world-desktop.png');
    await page.getByRole('button', { name: /Exit focus/i }).click();

    await selectRoute(page, '3,2');
    await page.getByTestId('commit-guest-route').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => {
      const world = document.querySelector('[data-testid="three-board-world"]');
      return world?.dataset.rendererState === 'ready'
        && world.querySelector('canvas')?.dataset.presentationStage === 'impact';
    });
    await capture(page, '03-crossing-impact-desktop.png', { animations: 'allow' });
    await page.getByRole('heading', { name: /Tideglass Answered/i }).waitFor();
    await waitForWorld(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, '04-relic-awakened-desktop.png');

    await selectRoute(page, '2,2');
    await page.getByTestId('commit-guest-route').click();
    await page.getByRole('button', { name: /Depart with 1 relic/i }).waitFor();
    await page.getByRole('button', { name: /Depart with 1 relic/i }).click();
    await page.getByText(/Expedition memory secured/i).waitFor();
    await waitForWorld(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, '05-safe-extraction-desktop.png', { animations: 'allow' });
    await context.close();
  }

  {
    const { context, page } = await createPage({ width: 390, height: 844 }, true);
    await page.goto(`${playUrl}/guest?mode=practice`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Use tactical map/i }).click();
    await page.getByTestId('guest-tactical-board').waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await capture(page, '06-tactical-mobile-reduced-motion.png');
    await context.close();
  }
} finally {
  await browser.close();
}

process.stdout.write(`${outputDir}\n`);
