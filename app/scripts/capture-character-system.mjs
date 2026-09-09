import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const appRoot = process.cwd();
const port = Number.parseInt(process.env.CHARACTER_CAPTURE_PORT || '11133', 10);
const baseURL = `http://127.0.0.1:${port}`;
const outputDir = path.resolve(appRoot, '..', 'artifacts', 'art', 'characters', 'reviews', 'ui');
const viteBin = path.resolve(appRoot, 'node_modules', 'vite', 'bin', 'vite.js');

async function waitForServer(processHandle, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (processHandle.exitCode !== null) throw new Error(`Vite exited before capture with code ${processHandle.exitCode}`);
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${baseURL}`);
}

async function settlePage(page) {
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}',
  });
}

async function capture(page, route, selector, filename, { board = false } = {}) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await settlePage(page);
  const target = page.locator(selector).first();
  await target.waitFor({ state: 'visible', timeout: 30_000 });
  if (board) {
    const world = page.locator('[data-testid="three-board-world"]');
    await world.waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(1_500);
  }
  await target.scrollIntoViewIfNeeded();
  await target.screenshot({ path: path.join(outputDir, filename), animations: 'disabled' });
  process.stdout.write(`CAPTURED ${filename}\n`);
}

await mkdir(outputDir, { recursive: true });
const server = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: appRoot,
  env: { ...process.env, VITE_ENABLE_INTERNAL_TOOLS: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let browser;
try {
  await waitForServer(server);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1720, height: 1200 }, deviceScaleFactor: 1 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await capture(page, '/art-lab', '[data-testid="character-system"]', 'character-system-art-lab.png');
  await capture(page, '/design-system?view=gameplay&lens=ready&motion=reduce', '[data-design-section="gameplay"]', 'character-system-dossiers.png');
  await capture(page, '/design-system?view=gameplay&lens=ready&motion=reduce', '[data-design-section="board"]', 'character-system-board.png', { board: true });
  await page.close();
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      server.kill('SIGTERM');
    }
  }
}

process.stdout.write(`OUTPUT ${outputDir}\n`);
