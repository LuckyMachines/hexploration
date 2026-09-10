import { expect, test } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve(process.cwd(), '..', 'reports', 'ux', 'journeys', 'latest.json');
const journeys = [];

async function clearState(page) {
  await page.route('**/js/script.manual.js', (route) => route.abort());
  await page.addInitScript(() => {
    window.__uxCapturedEvents = [];
    window.plausible = (...args) => window.__uxCapturedEvents.push(args);
    try { Object.defineProperty(Navigator.prototype, 'doNotTrack', { configurable: true, get: () => '0' }); } catch { /* browser-owned */ }
    localStorage.removeItem('xenovoya:return-loop:v2');
    localStorage.removeItem('xenovoya:return-loop:v1');
    localStorage.removeItem('xenovoya:analytics-dedupe:v1');
    sessionStorage.removeItem('xenovoya:analytics-journey:v1');
    sessionStorage.removeItem('xenovoya:analytics-journey-sequence:v1');
  });
}

async function analyticsEvents(page) {
  return page.evaluate(() => (window.__uxCapturedEvents || []).map(([name]) => name).filter((name) => name !== 'pageview'));
}

test.describe.serial('journey-level UX budgets', () => {
  test('first player reaches a visible, consequential decision in three actions', async ({ page }) => {
    await clearState(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    const panel = page.getByTestId('return-loop-panel');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toBeVisible();
    const startedAt = Date.now();

    await panel.getByRole('button', { name: /Scout/ }).click();
    const firstActionMs = Date.now() - startedAt;
    await panel.getByRole('button', { name: 'Create expedition thread' }).click();
    await expect(panel).toContainText('A relic-frequency is still pointing beyond the first ridge.');
    await panel.getByRole('button', { name: 'Mark decision ready' }).click();
    await expect(panel).toContainText('Waiting on crew');
    const events = await analyticsEvents(page);
    for (const event of ['starter_opened', 'role_selected', 'meaningful_choice', 'visible_consequence', 'starter_completed']) expect(events).toContain(event);
    journeys.push({ id: 'first-meaningful-decision', actions: 3, backtracks: 0, errors: 0, firstActionMs, completionMs: Date.now() - startedAt, recoveryMs: 0, events });
  });

  test('returning player can resume the unresolved thread in one action', async ({ page }) => {
    const stored = {
      version: 2,
      player: { callsign: 'Voyager', role: 'scout', records: { expeditions: 1, rescues: 0, relics: 1 } },
      crew: [{ callsign: 'Voyager', role: 'scout', status: 'ready' }],
      expedition: { gameId: 'previous-run', name: 'Signal beneath the ridge', lifecycle: 'complete', pressure: 42, clue: 'A second signal answers from below.', lastConsequence: 'The crew returned with one relic.', nextAction: 'Follow the unresolved clue.', nextReason: 'The answer changes the next route.', updatedAt: new Date().toISOString() },
      events: [],
    };
    await page.route('**/js/script.manual.js', (route) => route.abort());
    await page.addInitScript((state) => {
      window.__uxCapturedEvents = [];
      window.plausible = (...args) => window.__uxCapturedEvents.push(args);
      try { Object.defineProperty(Navigator.prototype, 'doNotTrack', { configurable: true, get: () => '0' }); } catch { /* browser-owned */ }
      localStorage.setItem('xenovoya:return-loop:v2', JSON.stringify(state));
      localStorage.removeItem('xenovoya:return-loop:v1');
      localStorage.removeItem('xenovoya:analytics-dedupe:v1');
      sessionStorage.removeItem('xenovoya:analytics-journey:v1');
      sessionStorage.removeItem('xenovoya:analytics-journey-sequence:v1');
    }, stored);
    await page.goto('/', { waitUntil: 'networkidle' });
    const panel = page.getByTestId('return-loop-panel');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toContainText('Signal beneath the ridge');
    const startedAt = Date.now();
    await panel.getByRole('button', { name: 'Start next expedition thread' }).click();
    await expect(panel).toContainText('Active');
    const events = await analyticsEvents(page);
    for (const event of ['resume', 'recap', 'second_expedition_start']) expect(events).toContain(event);
    journeys.push({ id: 'return-to-unresolved-thread', actions: 1, backtracks: 0, errors: 0, firstActionMs: Date.now() - startedAt, completionMs: Date.now() - startedAt, recoveryMs: 0, events });
  });

  test.afterAll(async () => {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), source: 'playwright-synthetic', journeys }, null, 2)}\n`);
  });
});
