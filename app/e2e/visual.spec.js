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
const broadcastLatest = path.resolve(
  process.cwd(),
  '..',
  'broadcast',
  'DeployXenovoya.s.sol',
  '31337',
  'run-latest.json',
);
const seedPk = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
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
  const candidates = [localEnvPath, e2eEnvPath];
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

async function readDeployments() {
  const raw = await fs.readFile(broadcastLatest, 'utf8');
  const json = JSON.parse(raw);
  const byName = {};
  for (const tx of json.transactions || []) {
    if (tx.contractName && tx.contractAddress) {
      byName[tx.contractName] = tx.contractAddress;
    }
  }
  return byName;
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
  const board = env.VITE_BOARD_ADDRESS;
  const registry = env.VITE_GAME_REGISTRY_ADDRESS;
  const summary = env.VITE_GAME_SUMMARY_ADDRESS;

  if (!rpcUrl || !board || !registry || !summary) {
    throw new Error('Missing local Anvil env for capture');
  }

  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain: foundry, transport });
  const joinerAccount = privateKeyToAccount(joinerPk);
  const joinerClient = createWalletClient({ account: joinerAccount, chain: foundry, transport });
  const seedAccount = privateKeyToAccount(seedPk);
  const seedClient = createWalletClient({ account: seedAccount, chain: foundry, transport });
  const deployments = await readDeployments();
  const gameSetup = deployments.GameSetup;
  const characterCard = deployments.CharacterCard;

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

  const ensureRole = async (contractAddress, accountAddress) => {
    const role = await publicClient.readContract({
      address: contractAddress,
      abi: roleAbi,
      functionName: 'VERIFIED_CONTROLLER_ROLE',
      args: [],
    });
    const hasRole = await publicClient.readContract({
      address: contractAddress,
      abi: roleAbi,
      functionName: 'hasRole',
      args: [role, accountAddress],
    });
    if (!hasRole) {
      const hash = await seedClient.writeContract({
        address: contractAddress,
        abi: roleAbi,
        functionName: 'addVerifiedController',
        args: [accountAddress],
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
  };

  await ensureRole(board, seedAccount.address);
  await ensureRole(characterCard, seedAccount.address);
  await ensureRole(gameSetup, seedAccount.address);

  const boardWriteAbi = [{
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'registerPlayer',
    inputs: [
      { name: 'playerAddress', type: 'address' },
      { name: 'gameID', type: 'uint256' },
    ],
    outputs: [],
  }, {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'createGrid',
    inputs: [],
    outputs: [],
  }];
  const statsAbi = [{
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'setStats',
    inputs: [
      { name: 'stats', type: 'uint8[3]' },
      { name: 'gameID', type: 'uint256' },
      { name: 'playerID', type: 'uint256' },
    ],
    outputs: [],
  }];
  const zoneAliases = await publicClient.readContract({
    address: board,
    abi: [{
      type: 'function',
      stateMutability: 'view',
      name: 'getZoneAliases',
      inputs: [],
      outputs: [{ name: '', type: 'string[]' }],
    }],
    functionName: 'getZoneAliases',
    args: [],
  });
  if (zoneAliases.length === 0) {
    const gridHash = await seedClient.writeContract({
      address: board,
      abi: boardWriteAbi,
      functionName: 'createGrid',
      args: [],
    });
    await publicClient.waitForTransactionReceipt({ hash: gridHash });
  }

  const refreshedZoneAliases = await publicClient.readContract({
    address: board,
    abi: [{
      type: 'function',
      stateMutability: 'view',
      name: 'getZoneAliases',
      inputs: [],
      outputs: [{ name: '', type: 'string[]' }],
    }],
    functionName: 'getZoneAliases',
    args: [],
  });
  const landingZone = refreshedZoneAliases[0];
  if (!landingZone) {
    throw new Error('Board grid did not expose any zone aliases');
  }

  for (const [playerAddress, playerID] of [
    [joinerAccount.address, 1n],
    [privateKeyToAccount(creatorPk).address, 2n],
  ]) {
    const hash = await seedClient.writeContract({
      address: board,
      abi: boardWriteAbi,
      functionName: 'registerPlayer',
      args: [playerAddress, gameId],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const statsHash = await seedClient.writeContract({
      address: characterCard,
      abi: statsAbi,
      functionName: 'setStats',
      args: [[4, 4, 4], gameId, playerID],
    });
    await publicClient.waitForTransactionReceipt({ hash: statsHash });

    const enterHash = await seedClient.writeContract({
      address: board,
      abi: [{
        type: 'function',
        stateMutability: 'nonpayable',
        name: 'enterPlayer',
        inputs: [
          { name: 'playerAddress', type: 'address' },
          { name: 'gameID', type: 'uint256' },
          { name: 'zone', type: 'string' },
        ],
        outputs: [],
      }],
      functionName: 'enterPlayer',
      args: [playerAddress, gameId, landingZone],
    });
    await publicClient.waitForTransactionReceipt({ hash: enterHash });
  }

  const setInitialZoneHash = await seedClient.writeContract({
    address: board,
    abi: [{
      type: 'function',
      stateMutability: 'nonpayable',
      name: 'setInitialPlayZone',
      inputs: [
        { name: 'initialZone', type: 'string' },
        { name: 'gameID', type: 'uint256' },
      ],
      outputs: [],
    }],
    functionName: 'setInitialPlayZone',
    args: [landingZone, gameId],
  });
  await publicClient.waitForTransactionReceipt({ hash: setInitialZoneHash });

  const setGameStateHash = await seedClient.writeContract({
    address: board,
    abi: [{
      type: 'function',
      stateMutability: 'nonpayable',
      name: 'setGameState',
      inputs: [
        { name: 'gs', type: 'uint256' },
        { name: 'gameID', type: 'uint256' },
      ],
      outputs: [],
    }],
    functionName: 'setGameState',
    args: [2n, gameId],
  });
  await publicClient.waitForTransactionReceipt({ hash: setGameStateHash });

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
