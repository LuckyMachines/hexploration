#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import playwright from '../app/node_modules/playwright/index.js';

const { chromium } = playwright;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.argv[2] || 'http://127.0.0.1:31847';
const state = process.argv[3] || 'ready';
const outputRoot = path.join(repoRoot, 'artifacts/art/runtime-review-2026-09-16/after');
mkdirSync(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark', reducedMotion: 'reduce' });
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('response', (response) => {
  if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.url()}`);
});
await page.goto(`${baseUrl}/board-lab?state=${state}&quality=balanced`, { waitUntil: 'domcontentloaded' });
const world = page.getByTestId('three-board-world');
await world.waitFor({ state: 'visible', timeout: 60_000 });
await page.waitForFunction(() => document.querySelector('[data-testid="three-board-world"]')?.dataset.rendererState === 'ready', null, { timeout: 60_000 });
await page.waitForTimeout(1600);
const canvas = world.locator('canvas');
const diagnostics = await canvas.evaluate((element) => ({ ...element.dataset, width: element.width, height: element.height }));
await world.screenshot({ path: path.join(outputRoot, `board-${state}.png`), animations: 'disabled' });
writeFileSync(path.join(outputRoot, `board-${state}.json`), `${JSON.stringify({ state, diagnostics, errors }, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify({ state, diagnostics, errors }, null, 2));
