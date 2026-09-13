import { createPublicClient, http } from 'viem';
import { createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { promises as fs } from 'node:fs';
import { test, expect } from '@playwright/test';

const expectOpenGame = process.env.E2E_EXPECT_OPEN_GAME === 'true';
const seededTest = expectOpenGame ? test : test.skip;
const e2eEnvPath = new URL('../.env.e2e-anvil', import.meta.url);
const seedPk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

function parseEnv(raw) {
  const result = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    result[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return result;
}

async function readGameEnv() {
  const candidates = [e2eEnvPath, new URL('../.env.local', import.meta.url)];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const env = parseEnv(raw);
      if (env.VITE_FOUNDRY_RPC_URL) return env;
    } catch {
      // Try the next env file.
    }
  }
  throw new Error('Unable to read a local game env file');
}

async function openReturnLoop(page) {
  const details = page.getByTestId('return-loop-details');
  if (!(await details.evaluate((element) => element.open))) await details.locator('summary').click();
  return page.getByTestId('return-loop-panel');
}

async function openPlayerSettings(page) {
  await page.getByTestId('player-settings-toggle').click();
}

test('home page renders core surfaces', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: /Choose your expedition/i })).toBeVisible();
  await expect(page.getByText(/You are in the playable client/i)).toBeVisible();
  const liveLaunch = page.getByRole('link', { name: /Observe live/i });
  await expect(liveLaunch).toBeVisible();
  await expect(liveLaunch).toHaveAttribute('href', '#available-expeditions');
  const guestLaunch = page.getByRole('link', { name: /Play solo/i }).first();
  await expect(guestLaunch).toHaveAttribute('href', '/guest');
  await expect(page.getByRole('link', { name: /Join or create/i })).toHaveAttribute('href', '#crew-network');
  await expect(page.getByText(/Available Expeditions/i)).toBeVisible();
  await expect(page.getByText(/Network and contract status/i)).toBeVisible();
  await expect(page.getByTestId('return-loop-details')).toBeVisible();
});

test('cross-domain play intent opens and focuses the requested mode', async ({ page }) => {
  await page.goto('/?mode=observe', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#available-expeditions')).toBeFocused();

  await page.goto('/?mode=join', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('crew-network-details')).toHaveJSProperty('open', true);
  await expect(page.locator('#crew-network')).toBeFocused();

  await page.goto('/?mode=solo', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/guest\?source=marketing$/);
  await expect(page.getByRole('heading', { name: /The Living Survey/i })).toBeVisible();
});

test('offline lobby preserves a playable route and a retry', async ({ page, context }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#available-expeditions')).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByText('You are offline', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Enter practice world/i })).toHaveAttribute('href', '/guest?mode=practice');
  await expect(page.getByRole('button', { name: /Retry live registry/i })).toBeVisible();
  await context.setOffline(false);
});

test('return loop gives a new player a role and a resumable crew thread', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const panel = await openReturnLoop(page);
  await panel.getByRole('button', { name: /Scout/i }).click();
  await expect(panel.getByText('Create your first expedition thread', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: /Create expedition thread/i }).click();
  await expect(panel.getByText(/Sector 0 signal/i)).toBeVisible();
  await panel.getByRole('button', { name: /Mark decision ready/i }).click();
  await expect(panel.getByText('Waiting on crew', { exact: true })).toBeVisible();
});

test('home page keeps internal tooling language out of the player funnel', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/You are in the playable client/i)).toBeVisible();

  const bodyText = (await page.locator('body').innerText()).toLowerCase();
  const internalTerms = [
    'simulator',
    'same-engine',
    'solo-artifact-hunt',
    'gameplay oracle',
    'feeling black box',
    'tuning',
    'generated',
    'current site',
    'local build',
    'visual direction',
    'devlog',
    'design system',
  ];

  for (const term of internalTerms) {
    expect(bodyText, `homepage should not expose "${term}"`).not.toContain(term);
  }
});

test('pseudo-localization loads when explicitly requested', async ({ page }) => {
  await page.goto('/?pseudo=1', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveClass(/xv-pseudo-locale/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Choose your expedition.');
});

test('solo prologue enters the production 3D expedition and reaches an authored relic arc', async ({ page }, testInfo) => {
  await page.goto('/guest', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /The Living Survey/i })).toBeVisible();
  const board = page.getByTestId('three-board-world');
  await expect(board).toBeVisible();
  await expect.poll(() => board.getAttribute('data-renderer-state'), { timeout: 20_000 }).toMatch(/ready|unavailable/);
  if (testInfo.project.name !== 'firefox-desktop') {
    await expect(board).toHaveAttribute('data-renderer-state', 'ready');
  }
  await expect(page.getByText(/Progress remembered/i)).toBeVisible();

  await page.getByRole('group', { name: /Reachable routes/i }).getByRole('button', { name: /Echo Fork/i }).click();
  await page.getByTestId('commit-guest-route').click();
  await expect(page.getByRole('heading', { name: /Echo Fork Answers Three Times/i })).toBeVisible();
  await page.getByRole('button', { name: /Mark only the sure route/i }).click();
  await page.getByRole('group', { name: /Reachable routes/i }).getByRole('button', { name: /Hushgrass Shelf/i }).click();
  await page.getByTestId('commit-guest-route').click();
  await page.getByRole('group', { name: /Reachable routes/i }).getByRole('button', { name: /Tideglass Cradle/i }).click();
  await page.getByTestId('commit-guest-route').click();
  await expect(page.getByRole('heading', { name: /Tideglass Cradle Answered/i })).toBeVisible();
  await expect(page.getByText(/Follow the highlighted route back/i)).toBeVisible();
  await expect(page.getByText('1', { exact: true }).first()).toBeVisible();

  for (const [location, alias] of [[/Hushgrass Shelf/i, '0,1'], [/Echo Fork/i, '1,1'], [/Beaconfall Basin/i, '2,2']]) {
    await page.getByRole('group', { name: /Reachable routes/i }).getByRole('button', { name: location }).click();
    await page.getByTestId('commit-guest-route').click();
    await expect(page.getByTestId('guest-expedition')).toHaveAttribute('data-current-location', alias);
    await expect(page.getByTestId('guest-expedition')).toHaveAttribute('data-resolving', 'false');
  }
  await page.getByRole('button', { name: /Depart with 1 relic/i }).click();
  await expect(page.getByTestId('guest-outcome')).toContainText('Relic Homecoming');
  await expect(page.getByTestId('guest-memory-reward')).toBeVisible();
  await expect(page.getByText(/Share the expedition as a relic/i)).toBeVisible();
});

test('guest route has a persistent tactical fallback with the same choices', async ({ page }) => {
  await page.goto('/guest?mode=practice', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Replayable training voyage/i)).toBeVisible();
  await page.getByRole('button', { name: /Use tactical map/i }).click();
  await expect(page.getByTestId('guest-tactical-board')).toBeVisible();
  await expect(page.getByRole('button', { name: /recommended route/i }).first()).toBeEnabled();
  await page.reload();
  await expect(page.getByTestId('guest-tactical-board')).toBeVisible();
});

test('internal preview routes are blocked in the public funnel', async ({ page }) => {
  await page.goto('/simulator', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Launch the expedition client/i })).toBeVisible();
  await expect(page.getByText(/Gameplay Simulator/i)).toHaveCount(0);

  await page.goto('/play?scenario=solo-artifact-hunt&seed=public-check', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Launch the expedition client/i })).toBeVisible();
  await expect(page.getByText(/Solo Artifact Hunt/i)).toHaveCount(0);
});

seededTest('seeded anvil mode shows at least one expedition', async ({ page }) => {
  const env = await readGameEnv();
  const transport = http(env.VITE_FOUNDRY_RPC_URL);
  const client = createPublicClient({ chain: foundry, transport });
  const account = privateKeyToAccount(seedPk);
  const wallet = createWalletClient({ account, chain: foundry, transport });

  const roleAbi = [{
    type: 'function',
    stateMutability: 'view',
    name: 'VERIFIED_CONTROLLER_ROLE',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  }, {
    type: 'function',
    stateMutability: 'view',
    name: 'hasRole',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  }, {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'addVerifiedController',
    inputs: [{ name: 'vcAddress', type: 'address' }],
    outputs: [],
  }];

  const ensureRole = async () => {
    const role = await client.readContract({
      address: env.VITE_BOARD_ADDRESS,
      abi: roleAbi,
      functionName: 'VERIFIED_CONTROLLER_ROLE',
      args: [],
    });
    const hasRole = await client.readContract({
      address: env.VITE_BOARD_ADDRESS,
      abi: roleAbi,
      functionName: 'hasRole',
      args: [role, account.address],
    });
    if (!hasRole) {
      const hash = await wallet.writeContract({
        address: env.VITE_BOARD_ADDRESS,
        abi: roleAbi,
        functionName: 'addVerifiedController',
        args: [account.address],
      });
      await client.waitForTransactionReceipt({ hash });
    }
  };

  await ensureRole();

  const readOpenGames = async () => client.readContract({
    address: env.VITE_GAME_SUMMARY_ADDRESS,
    abi: [{
      type: 'function',
      stateMutability: 'view',
      name: 'getAvailableGames',
      inputs: [
        { name: 'boardAddress', type: 'address' },
        { name: 'gameRegistryAddress', type: 'address' },
      ],
      outputs: [
        { name: 'gameIDs', type: 'uint256[]' },
        { name: 'maxPlayers', type: 'uint256[]' },
        { name: 'currentRegistrations', type: 'uint256[]' },
      ],
    }],
    functionName: 'getAvailableGames',
    args: [env.VITE_BOARD_ADDRESS, env.VITE_GAME_REGISTRY_ADDRESS],
  });
  let result = await readOpenGames();
  if (result[0].length === 0) {
    const requestHash = await wallet.writeContract({
      address: env.VITE_BOARD_ADDRESS,
      abi: [{
        type: 'function',
        stateMutability: 'nonpayable',
        name: 'requestNewGame',
        inputs: [
          { name: 'gameRegistryAddress', type: 'address' },
          { name: 'maxPlayers', type: 'uint256' },
        ],
        outputs: [],
      }],
      functionName: 'requestNewGame',
      args: [env.VITE_GAME_REGISTRY_ADDRESS, 2n],
    });
    await client.waitForTransactionReceipt({ hash: requestHash });
    result = await readOpenGames();
  }

  expect(result[0].length).toBeGreaterThan(0);
  await page.goto('/#live-expedition', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Available Expeditions/i })).toBeVisible();
});

test('field manual modal opens and closes with Escape', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await openPlayerSettings(page);
  const helpButton = page.getByRole('button', { name: /Open Field Manual/i });
  await expect(helpButton).toBeVisible();
  await helpButton.focus();
  await page.keyboard.press('Enter');
  const manual = page.getByRole('dialog', { name: /Field Manual/i });
  await expect(manual).toBeVisible();
  await expect(page.getByText(/Depart Pressure measures how hard it is becoming to leave cleanly/i)).toBeVisible();
  await expect(page.getByText(/Escape Cost Preview turns pressure into a forecast/i)).toBeVisible();
  await expect(page.getByText(/Cost Reduction Actions/i)).toBeVisible();
  await expect(page.getByText(/Tile Traits/i)).toBeVisible();
  await expect(page.getByText(/Turn Aftermath/i)).toBeVisible();
  await expect(page.getByText(/Expedition Arc/i)).toBeVisible();
  await expect(manual.getByRole('heading', { name: /^Expedition Memory$/i })).toBeVisible();
  await expect(manual.getByRole('heading', { name: /^Run Relic Cards$/i })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(manual).toBeHidden();
});
