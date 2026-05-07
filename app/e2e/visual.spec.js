import { createPublicClient, createWalletClient, http } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const expectOpenGame = process.env.E2E_EXPECT_OPEN_GAME === 'true';
const captureDir = path.resolve(process.cwd(), '..', 'captures', 'game');
const e2eEnvPath = path.resolve(process.cwd(), '.env.e2e-anvil');
const localEnvPath = path.resolve(process.cwd(), '.env.local');
const joinerPk = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const creatorPk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const captureProjects = new Set(['chromium-desktop']);

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

async function rpcIsReachable(rpcUrl) {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function readGameEnv() {
  const candidates = [e2eEnvPath, localEnvPath];
  for (const envPath of candidates) {
    try {
      const raw = await fs.readFile(envPath, 'utf8');
      const env = parseEnv(raw);
      if (env.VITE_FOUNDRY_RPC_URL && await rpcIsReachable(env.VITE_FOUNDRY_RPC_URL)) {
        return env;
      }
    } catch {
      // Try the next env file.
    }
  }
  throw new Error('Unable to find a reachable local game env file');
}

async function ensureCaptureDir() {
  await fs.mkdir(captureDir, { recursive: true });
}

async function installRpcWallet(page, rpcUrl, accountAddress) {
  await page.addInitScript(
    ({ rpcUrl: injectedRpcUrl, account: injectedAccount }) => {
      const listeners = new Map();
      const emit = (event, value) => {
        for (const handler of listeners.get(event) || []) handler(value);
      };

      window.ethereum = {
        isMetaMask: true,
        request: async ({ method, params = [] }) => {
          if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
            return [injectedAccount];
          }
          if (method === 'eth_chainId') {
            return '0x7a69';
          }
          if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') {
            return null;
          }
          if (method === 'eth_sendTransaction') {
            const tx = params[0] || {};
            const response = await fetch(injectedRpcUrl, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_sendTransaction',
                params: [{
                  from: injectedAccount,
                  ...tx,
                }],
              }),
            });
            const json = await response.json();
            if (json.error) throw new Error(json.error.message || 'eth_sendTransaction failed');
            return json.result;
          }
          throw new Error(`Unsupported wallet method: ${method}`);
        },
        on: (event, handler) => {
          const current = listeners.get(event) || [];
          current.push(handler);
          listeners.set(event, current);
        },
        removeListener: (event, handler) => {
          const current = listeners.get(event) || [];
          listeners.set(event, current.filter((item) => item !== handler));
        },
        emit,
      };
    },
    { rpcUrl, account: accountAddress },
  );
}

async function waitForGameStarted(publicClient, env, gameId, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const started = await publicClient.readContract({
      address: env.VITE_GAME_SUMMARY_ADDRESS,
      abi: [{
        type: 'function',
        stateMutability: 'view',
        name: 'gameStarted',
        inputs: [
          { name: 'boardAddress', type: 'address' },
          { name: 'gameId', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
      }],
      functionName: 'gameStarted',
      args: [env.VITE_BOARD_ADDRESS, BigInt(gameId)],
    });

    if (started) return true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return false;
}

async function registerLocalPlayers(env) {
  const rpcUrl = env.VITE_FOUNDRY_RPC_URL;
  const controller = env.VITE_CONTROLLER_ADDRESS;
  const board = env.VITE_BOARD_ADDRESS;
  const registry = env.VITE_GAME_REGISTRY_ADDRESS;
  const summary = env.VITE_GAME_SUMMARY_ADDRESS;

  if (!rpcUrl || !controller || !board || !registry || !summary) {
    throw new Error('Missing local Anvil env for capture');
  }

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: foundry, transport });
  const joinerAccount = privateKeyToAccount(joinerPk);
  const creatorAccount = privateKeyToAccount(creatorPk);
  const joinerClient = createWalletClient({ account: joinerAccount, chain: foundry, transport });
  const creatorClient = createWalletClient({ account: creatorAccount, chain: foundry, transport });

  const [gameIDs, maxPlayers, currentRegs] = await publicClient.readContract({
    address: summary,
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
    args: [board, registry],
  });

  const gameIndex = currentRegs.findIndex((registered, index) => registered < maxPlayers[index]);
  if (gameIndex === -1) {
    const fallbackGameId = 1;
    const isStarted = await waitForGameStarted(publicClient, env, fallbackGameId, 10_000);
    if (!isStarted) {
      throw new Error('No open local games were found and fallback game 1 was not started');
    }

    return { rpcUrl, gameId: fallbackGameId };
  }

  const gameId = gameIDs[gameIndex];
  await joinerClient.writeContract({
    address: controller,
    abi: [{
      type: 'function',
      stateMutability: 'nonpayable',
      name: 'registerForGame',
      inputs: [
        { name: 'gameId', type: 'uint256' },
        { name: 'boardAddress', type: 'address' },
      ],
      outputs: [],
    }],
    functionName: 'registerForGame',
    args: [gameId, board],
  });

  await creatorClient.writeContract({
    address: controller,
    abi: [{
      type: 'function',
      stateMutability: 'nonpayable',
      name: 'registerForGame',
      inputs: [
        { name: 'gameId', type: 'uint256' },
        { name: 'boardAddress', type: 'address' },
      ],
      outputs: [],
    }],
    functionName: 'registerForGame',
    args: [gameId, board],
  });

  const isStarted = await waitForGameStarted(publicClient, env, Number(gameId));
  if (!isStarted) {
    throw new Error(`Game ${gameId.toString()} never transitioned to started state`);
  }

  return { rpcUrl, gameId: Number(gameId) };
}

test('home surface renders cleanly on the game app', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Xenovoya/i })).toBeVisible();

  await ensureCaptureDir();
  await page.screenshot({
    path: path.join(captureDir, `${testInfo.project.name}-home.png`),
    fullPage: true,
  });
});

test('invalid game id remains readable', async ({ page }) => {
  await page.goto('/game/not-a-number', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Invalid survey id/i)).toBeVisible();
});

test('seeded gameplay can be captured from a real local board', async ({ page }, testInfo) => {
  test.skip(!expectOpenGame, 'Only runs when seeded Anvil data is available.');
  test.skip(!captureProjects.has(testInfo.project.name), 'Capture run only uses the primary desktop browser.');

  const env = await readGameEnv();
  const { rpcUrl, gameId } = await registerLocalPlayers(env);
  await installRpcWallet(page, rpcUrl, privateKeyToAccount(joinerPk).address);

  await page.goto(`/game/${gameId}`, { waitUntil: 'commit' });
  await page.waitForLoadState('domcontentloaded');
  const joinButton = page.getByRole('button', { name: /Join Survey/i });
  if (await joinButton.count()) {
    await joinButton.first().click();
  }

  await expect(page.getByText(/Expedition Crew|Action Console/i)).toBeVisible({ timeout: 45_000 });
  await ensureCaptureDir();
  await page.screenshot({
    path: path.join(captureDir, `${testInfo.project.name}-gameplay.png`),
    fullPage: true,
  });
});
