import { expect, test } from '@playwright/test';
import { FIRST_PLAYER_FIXTURE } from './fixtures/first-player.js';

const PLAUSIBLE_SCRIPT = 'https://plausible.racerverse.com/js/script.manual.js';
const PLAUSIBLE_API = 'https://plausible.racerverse.com/api/event';

test('first-player journey emits each privacy-safe milestone once through return and second start', async ({ page, context }, testInfo) => {
  const captured = [];
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: async () => '',
        writeText: async () => {},
      },
    });
  });
  await page.route(PLAUSIBLE_API, async (route) => {
    captured.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, contentType: 'application/json', body: '{}' });
  });
  await page.route(PLAUSIBLE_SCRIPT, (route) => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: `(() => {
      const queued = window.plausible?.q || [];
      window.plausible = (name, options = {}) => fetch('${PLAUSIBLE_API}', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, props: options.props || {} })
      });
      queued.forEach((args) => window.plausible(...args));
    })();`,
  }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const panel = page.getByTestId('return-loop-panel');
  await panel.getByRole('button', { name: new RegExp(`^${FIRST_PLAYER_FIXTURE.roleLabel}`, 'i') }).click();
  await panel.getByRole('button', { name: /Create expedition thread/i }).click();
  await expect(panel.getByText(new RegExp(FIRST_PLAYER_FIXTURE.expeditionName, 'i'))).toBeVisible();
  await expect(panel.getByText(FIRST_PLAYER_FIXTURE.consequence)).toBeVisible();
  await panel.getByRole('button', { name: /Mark decision ready/i }).click();
  await expect(panel.getByText(/Waiting on crew/i)).toBeVisible();
  await panel.screenshot({ path: testInfo.outputPath('first-meaningful-outcome.png') });
  await panel.getByRole('button', { name: /Copy crew invite/i }).click();
  await expect(panel.getByRole('button', { name: /Invite copied/i })).toBeVisible();

  await page.evaluate((elapsedReturnDays) => {
    const key = 'xenovoya:return-loop:v1';
    const state = JSON.parse(localStorage.getItem(key));
    state.expedition.lifecycle = 'recoverable';
    state.expedition.updatedAt = new Date(Date.now() - elapsedReturnDays * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(key, JSON.stringify(state));
  }, FIRST_PLAYER_FIXTURE.elapsedReturnDays);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const returnedPanel = page.getByTestId('return-loop-panel');
  await expect(returnedPanel.getByText(/Recoverable/i)).toBeVisible();
  await returnedPanel.screenshot({ path: testInfo.outputPath('returned-player-recap.png') });
  await returnedPanel.getByRole('button', { name: /Start next expedition thread/i }).click();

  await expect.poll(() => captured.filter((event) => event.name !== 'pageview').length).toBeGreaterThanOrEqual(10);
  const events = captured.filter((event) => event.name !== 'pageview');
  const names = events.map((event) => event.name);
  for (const expected of FIRST_PLAYER_FIXTURE.expectedEvents) {
    expect(names.filter((name) => name === expected), `${expected} should be emitted once`).toHaveLength(1);
  }
  for (const event of events) {
    expect(event.props).toMatchObject({ event_version: '1', environment: 'test', release: 'e2e-release', source: 'synthetic' });
    expect(event.props.installation_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(event.props.journey_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(event.props.event_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(event.props.journey_sequence).toBeGreaterThan(0);
    expect(JSON.stringify(event.props)).not.toMatch(/0x[a-f0-9]{40}|@|bearer|postgres(?:ql)?:\/\//i);
  }
  const sequences = events.map((event) => event.props.journey_sequence);
  expect(new Set(sequences).size).toBe(sequences.length);
  expect(sequences).toEqual([...sequences].sort((left, right) => left - right));
  expect(events.find((event) => event.name === 'second_expedition_start')?.props.return_interval).toBe('d7_plus');
});
