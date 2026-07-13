import { expect, test } from '@playwright/test';

const RETURN_API = 'https://return-api.xenovoya.com';
const WALLET = '0x1111111111111111111111111111111111111111';

function createReturnCloud() {
  let state = null;
  let version = 0;
  let sessionSequence = 0;
  let conflictNextWrite = false;
  let unavailable = false;
  const sessions = new Set();
  const events = new Set();

  const respond = (route, status, payload = {}) => route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'GET,PUT,POST,DELETE,OPTIONS',
    },
    body: status === 204 ? '' : JSON.stringify(payload),
  });

  return {
    get state() { return state; },
    get version() { return version; },
    injectConflict() { conflictNextWrite = true; },
    expireSessions() { sessions.clear(); },
    setUnavailable(value) { unavailable = value; },
    async handle(route) {
      const request = route.request();
      const { pathname } = new URL(request.url());
      if (request.method() === 'OPTIONS') return respond(route, 204);
      if (unavailable) return route.abort('internetdisconnected');

      const authorization = request.headers().authorization || '';
      const session = authorization.replace(/^Bearer\s+/i, '');
      const authenticated = sessions.has(session);
      const body = request.postDataJSON?.() || {};

      if (pathname === '/v1/auth/nonce' && request.method() === 'POST') {
        return respond(route, 200, { message: `Sign in to Xenovoya\nWallet: ${body.wallet}\nNonce: proof`, expiresAt: new Date(Date.now() + 600_000).toISOString() });
      }
      if (pathname === '/v1/auth/verify' && request.method() === 'POST') {
        const token = `proof-session-${++sessionSequence}`;
        sessions.add(token);
        return respond(route, 200, { token, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
      }
      if (!authenticated) return respond(route, 401, { error: 'session_expired' });

      if (pathname === '/v1/session' && request.method() === 'DELETE') {
        sessions.delete(session);
        return respond(route, 204);
      }
      if (pathname === '/v1/profile' && request.method() === 'PUT') return respond(route, 200, { wallet: WALLET, ...body });
      if (pathname === '/v1/return-state' && request.method() === 'GET') {
        return state ? respond(route, 200, { version, state, updatedAt: new Date().toISOString() }) : respond(route, 404, { error: 'return_state_not_found' });
      }
      if (pathname === '/v1/return-state' && request.method() === 'PUT') {
        if (conflictNextWrite) {
          conflictNextWrite = false;
          version += 1;
          return respond(route, 409, { error: 'version_conflict', current: { version, state, updatedAt: new Date().toISOString() } });
        }
        if (Number(body.expectedVersion) !== version) {
          return respond(route, 409, { error: 'version_conflict', current: { version, state, updatedAt: new Date().toISOString() } });
        }
        state = body.state;
        version += 1;
        return respond(route, 200, { version, state, updatedAt: new Date().toISOString() });
      }
      if (pathname === '/v1/events' && request.method() === 'POST') {
        const duplicate = events.has(body.eventId);
        events.add(body.eventId);
        return respond(route, duplicate ? 200 : 202, { accepted: true, duplicate });
      }
      return respond(route, 404, { error: 'not_found' });
    },
  };
}

async function configureDevice(context, cloud) {
  await context.addInitScript(({ wallet }) => {
    const listeners = new Map();
    window.ethereum = {
      request: async ({ method }) => {
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [wallet];
        if (method === 'eth_chainId') return '0x2105';
        if (method === 'personal_sign') return `0x${'12'.repeat(65)}`;
        if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
        throw new Error(`Unsupported wallet method: ${method}`);
      },
      on: (name, callback) => listeners.set(name, callback),
      removeListener: (name) => listeners.delete(name),
    };
  }, { wallet: WALLET });
  await context.route(`${RETURN_API}/**`, (route) => cloud.handle(route));
}

async function chooseRoleAndCreateThread(page) {
  const panel = page.getByTestId('return-loop-panel');
  await panel.getByRole('button', { name: /^Scout/i }).click();
  await panel.getByRole('button', { name: /Create expedition thread/i }).click();
  await expect(panel.getByText(/Sector 0 signal/i)).toBeVisible();
  return panel;
}

test('two devices reconcile, survive conflict and offline work, recover expiry, and revoke sessions', async ({ browser }) => {
  test.slow();
  const cloud = createReturnCloud();
  const deviceA = await browser.newContext();
  const deviceB = await browser.newContext();
  await configureDevice(deviceA, cloud);
  await configureDevice(deviceB, cloud);

  try {
    const pageA = await deviceA.newPage();
    await pageA.goto('/', { waitUntil: 'domcontentloaded' });
    const panelA = await chooseRoleAndCreateThread(pageA);
    await panelA.getByRole('button', { name: /Save across devices/i }).click();
    await expect(panelA.getByText(/Synced securely.*cloud version 1/i)).toBeVisible();
    expect(cloud.version).toBe(1);

    const pageB = await deviceB.newPage();
    await pageB.goto('/', { waitUntil: 'domcontentloaded' });
    const panelB = pageB.getByTestId('return-loop-panel');
    await panelB.getByRole('button', { name: /^Scout/i }).click();
    await panelB.getByRole('button', { name: /Save across devices/i }).click();
    await expect(panelB.getByText(/Sector 0 signal/i)).toBeVisible();
    await expect(panelB.getByText(/Synced securely.*cloud version 2/i)).toBeVisible();

    await panelA.getByRole('button', { name: /Mark decision ready/i }).click();
    await expect(panelA.getByText(/Waiting on crew/i)).toBeVisible();
    cloud.injectConflict();
    await panelA.getByRole('button', { name: /Sync changes/i }).click();
    await expect(panelA.getByText(/Conflict resolved safely.*cloud version 4/i)).toBeVisible();
    expect(cloud.state.expedition.lifecycle).toBe('waiting-on-crew');

    await pageA.evaluate(() => {
      const key = 'xenovoya:return-loop:v1';
      const local = JSON.parse(localStorage.getItem(key));
      local.expedition.pressure = 73;
      local.expedition.updatedAt = new Date(Date.now() + 60_000).toISOString();
      local.events.push({ name: 'offline_pressure_reviewed', at: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(local));
    });
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await expect(pageA.getByTestId('return-loop-panel')).toBeVisible();
    cloud.setUnavailable(true);
    await deviceA.setOffline(true);
    await pageA.getByTestId('return-loop-panel').getByRole('button', { name: /Save across devices/i }).click();
    await expect(pageA.getByTestId('return-loop-panel').getByText(/Offline.*remains safe on this device/i)).toBeVisible();
    await deviceA.setOffline(false);
    cloud.setUnavailable(false);
    await pageA.getByTestId('return-loop-panel').getByRole('button', { name: /Save across devices/i }).click();
    await expect(pageA.getByTestId('return-loop-panel').getByText(/Synced securely.*cloud version 5/i)).toBeVisible();
    expect(cloud.state.expedition.pressure).toBe(73);

    cloud.expireSessions();
    await pageA.getByTestId('return-loop-panel').getByRole('button', { name: /Sync changes/i }).click();
    await expect(pageA.getByTestId('return-loop-panel').getByText(/Session expired.*Sign again/i)).toBeVisible();
    await pageA.getByTestId('return-loop-panel').getByRole('button', { name: /Save across devices/i }).click();
    await expect(pageA.getByTestId('return-loop-panel').getByText(/Synced securely.*cloud version 6/i)).toBeVisible();

    await pageA.getByTestId('return-loop-panel').getByRole('button', { name: /Remove cloud session/i }).click();
    await expect(pageA.getByTestId('return-loop-panel').getByText(/Cloud session removed.*Local history is unchanged/i)).toBeVisible();
    await expect(pageA.getByTestId('return-loop-panel').getByText(/Sector 0 signal/i)).toBeVisible();
  } finally {
    await deviceA.close();
    await deviceB.close();
  }
});
