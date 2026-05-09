import { createPublicClient, http } from 'viem';
import { createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { promises as fs } from 'node:fs';
import { test, expect } from '@playwright/test';

const expectOpenGame = process.env.E2E_EXPECT_OPEN_GAME === 'true';
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
  const candidates = [new URL('../.env.local', import.meta.url), e2eEnvPath];
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

test('home page renders core surfaces', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: /Xenovoya/i })).toBeVisible();
  await expect(page.getByText(/System Health/i)).toBeVisible();
  await expect(page.getByText(/Available Surveys/i)).toBeVisible();
});

test('seeded anvil mode shows at least one expedition', async ({ page }) => {
  test.skip(!expectOpenGame, 'Only required for anvil-seeded runs.');

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
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Available Surveys/i)).toBeVisible();
});

test('field manual modal opens and closes with Escape', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /Open Field Manual/i }).click();
  await expect(page.getByRole('dialog', { name: /Field Manual/i })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /Field Manual/i })).toBeHidden();
});
