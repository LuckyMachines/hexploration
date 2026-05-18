import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPublicClient, http } from 'viem';
import { foundry } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, '..');

export const LOCAL_STACK_HEALTH_VERSION = 1;

export const DEFAULT_REQUIRED_ENV_KEYS = [
  'VITE_BOARD_ADDRESS',
  'VITE_CONTROLLER_ADDRESS',
  'VITE_GAME_SUMMARY_ADDRESS',
  'VITE_PLAYER_SUMMARY_ADDRESS',
  'VITE_GAME_EVENTS_ADDRESS',
  'VITE_GAME_REGISTRY_ADDRESS',
  'VITE_GAME_QUEUE_ADDRESS',
  'VITE_GAME_SETUP_ADDRESS',
  'VITE_PLAYER_REGISTRY_ADDRESS',
  'VITE_CHARACTER_CARD_ADDRESS',
  'VITE_TOKEN_INVENTORY_ADDRESS',
];

export const DEFAULT_ENV_FILE = path.resolve(repoRoot, 'app', '.env.local');
export const DEFAULT_BROADCAST_FILE = path.resolve(
  repoRoot,
  'broadcast',
  'DeployXenovoya.s.sol',
  '31337',
  'run-latest.json',
);
export const DEFAULT_REPORT_DIR = path.resolve(repoRoot, 'reports', 'local-stack');
export const DEFAULT_PUBLIC_REPORT_DIR = path.resolve(repoRoot, 'app', 'public', 'local-stack');

const gameRegistryAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'latestGame',
    inputs: [{ name: 'gameBoardAddress', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
];

const gameSummaryAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getAvailableGames',
    inputs: [
      { name: 'gameBoardAddress', type: 'address' },
      { name: 'gameRegistryAddress', type: 'address' },
    ],
    outputs: [
      { type: 'uint256[]' },
      { type: 'uint256[]' },
      { type: 'uint256[]' },
    ],
  },
];

function jsonReplacer(_, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

function serializable(value) {
  return JSON.parse(JSON.stringify(value, jsonReplacer));
}

export function isAddress(value) {
  return /^0x[0-9a-fA-F]{40}$/.test(String(value || ''));
}

export function parseEnvText(text) {
  const values = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const clean = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const equalsIndex = clean.indexOf('=');
    if (equalsIndex <= 0) continue;
    const key = clean.slice(0, equalsIndex).trim();
    let value = clean.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function normalizeAddressMap(input = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (value === undefined || value === null || value === '') continue;
    normalized[key] = String(value);
  }
  return normalized;
}

export function bytecodeStatus(bytecode) {
  const text = typeof bytecode === 'string' ? bytecode : '';
  const hasBytecode = text.startsWith('0x') && text.length > 2;
  return {
    hasBytecode,
    sizeBytes: hasBytecode ? Math.floor((text.length - 2) / 2) : 0,
  };
}

export function scoreChecks(checks) {
  const passed = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warnings = checks.filter((check) => check.status === 'warn').length;
  return {
    ok: failed === 0,
    passed,
    failed,
    warnings,
    total: checks.length,
  };
}

export function buildHealthReport({
  generatedAt = new Date().toISOString(),
  rpcUrl,
  mode = 'unknown',
  players = null,
  addresses = {},
  checks = [],
  evidence = {},
  bootSteps = [],
  childProcesses = [],
  flags = {},
  paths = {},
} = {}) {
  const scored = scoreChecks(checks);
  return serializable({
    schemaVersion: LOCAL_STACK_HEALTH_VERSION,
    generatedAt,
    ok: scored.ok,
    score: scored,
    runtime: {
      rpcUrl,
      mode,
      players,
      flags,
    },
    paths,
    addresses: normalizeAddressMap(addresses),
    evidence,
    checks,
    bootSteps,
    childProcesses,
  });
}

export function markdownForLocalStackHealth(report) {
  const status = report.ok ? 'ready' : 'not ready';
  const lines = [
    `# Local Stack Health: ${status}`,
    '',
    `Generated: ${report.generatedAt}`,
    `RPC: ${report.runtime?.rpcUrl || 'unknown'}`,
    `Mode: ${report.runtime?.mode || 'unknown'}`,
    `Players: ${report.runtime?.players ?? 'unknown'}`,
    '',
    `Checks: ${report.score?.passed || 0} passed, ${report.score?.failed || 0} failed, ${report.score?.warnings || 0} warnings`,
    '',
    '## Checks',
    '',
  ];

  for (const check of report.checks || []) {
    const marker = check.status === 'pass' ? 'PASS' : check.status === 'warn' ? 'WARN' : 'FAIL';
    lines.push(`- ${marker} ${check.label || check.id}`);
    if (check.message) lines.push(`  ${check.message}`);
  }

  const latestGame = report.evidence?.latestGameId;
  const openGameCount = report.evidence?.openGameCount;
  if (latestGame !== undefined || openGameCount !== undefined) {
    lines.push('', '## Chain Evidence', '');
    if (latestGame !== undefined) lines.push(`- Latest game ID: ${latestGame}`);
    if (openGameCount !== undefined) lines.push(`- Open games: ${openGameCount}`);
  }

  if ((report.bootSteps || []).length > 0) {
    lines.push('', '## Boot Steps', '');
    for (const step of report.bootSteps) {
      lines.push(`- ${step.status || 'unknown'} ${step.label || step.id} (${step.durationMs ?? 0}ms)`);
    }
  }

  return `${lines.join('\n')}\n`;
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readEnvIfExists(file) {
  try {
    return parseEnvText(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

export function addressesFromBroadcastJson(json) {
  const byName = {};
  const cardDecks = [];
  const gameTokens = [];

  for (const tx of json?.transactions || []) {
    if (!tx.contractName || !tx.contractAddress) continue;
    if (tx.contractName === 'CardDeck') {
      cardDecks.push(tx.contractAddress);
    } else if (tx.contractName === 'GameToken') {
      gameTokens.push(tx.contractAddress);
    } else {
      byName[tx.contractName] = tx.contractAddress;
    }
  }

  const tokenKeys = [
    'DAY_NIGHT_TOKEN',
    'DISASTER_TOKEN',
    'ENEMY_TOKEN',
    'ITEM_TOKEN',
    'PLAYER_STATUS_TOKEN',
    'RELIC_TOKEN',
  ];
  for (let index = 0; index < tokenKeys.length; index += 1) {
    if (gameTokens[index]) byName[tokenKeys[index]] = gameTokens[index];
  }

  return {
    byName,
    cardDecks,
    appAddrs: normalizeAddressMap({
      VITE_BOARD_ADDRESS: byName.XenovoyaBoard,
      VITE_CONTROLLER_ADDRESS: byName.XenovoyaController,
      VITE_GAME_SUMMARY_ADDRESS: byName.GameSummary,
      VITE_PLAYER_SUMMARY_ADDRESS: byName.PlayerSummary,
      VITE_GAME_EVENTS_ADDRESS: byName.GameEvents,
      VITE_GAME_REGISTRY_ADDRESS: byName.GameRegistry,
      VITE_GAME_QUEUE_ADDRESS: byName.XenovoyaQueue,
      VITE_GAME_SETUP_ADDRESS: byName.GameSetup,
      VITE_PLAYER_REGISTRY_ADDRESS: byName.PlayerRegistry,
      VITE_CHARACTER_CARD_ADDRESS: byName.CharacterCard,
      VITE_TOKEN_INVENTORY_ADDRESS: byName.TokenInventory,
    }),
  };
}

function check(status, id, label, message, details = {}) {
  return {
    id,
    label,
    status,
    message,
    details,
  };
}

async function withTimeout(label, timeoutMs, fn) {
  let timer;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function buildLocalStackHealth({
  rpcUrl = 'http://127.0.0.1:9955',
  envFile = DEFAULT_ENV_FILE,
  broadcastFile = DEFAULT_BROADCAST_FILE,
  appAddrs = {},
  byName = {},
  mode = 'unknown',
  players = null,
  flags = {},
  bootSteps = [],
  childProcesses = [],
  requiredKeys = DEFAULT_REQUIRED_ENV_KEYS,
  timeoutMs = 15_000,
  publicClient = null,
} = {}) {
  const checks = [];
  const evidence = {};
  const paths = { envFile, broadcastFile };

  const envAddresses = await readEnvIfExists(envFile);
  const broadcastJson = await readJsonIfExists(broadcastFile);
  const broadcastAddresses = broadcastJson ? addressesFromBroadcastJson(broadcastJson) : { appAddrs: {}, byName: {} };
  const addresses = normalizeAddressMap({
    ...broadcastAddresses.appAddrs,
    ...envAddresses,
    ...appAddrs,
  });
  const mergedByName = normalizeAddressMap({
    ...broadcastAddresses.byName,
    ...byName,
  });

  checks.push(
    check(
      Object.keys(envAddresses).length > 0 ? 'pass' : 'warn',
      'env.file',
      'App environment file',
      Object.keys(envAddresses).length > 0 ? `Loaded ${envFile}` : `No app environment file found at ${envFile}`,
    ),
  );
  checks.push(
    check(
      broadcastJson ? 'pass' : 'warn',
      'broadcast.file',
      'Forge broadcast file',
      broadcastJson ? `Loaded ${broadcastFile}` : `No broadcast file found at ${broadcastFile}`,
    ),
  );

  for (const key of requiredKeys) {
    const value = addresses[key];
    if (!value) {
      checks.push(check('fail', `address.${key}`, `${key} configured`, 'Required address is missing.'));
    } else if (!isAddress(value)) {
      checks.push(check('fail', `address.${key}`, `${key} format`, `Address is malformed: ${value}`));
    } else {
      checks.push(check('pass', `address.${key}`, `${key} format`, `Address is configured: ${value}`));
    }
  }

  for (const key of requiredKeys) {
    if (!appAddrs[key] || !envAddresses[key]) continue;
    const runtimeValue = String(appAddrs[key]).toLowerCase();
    const envValue = String(envAddresses[key]).toLowerCase();
    checks.push(
      check(
        runtimeValue === envValue ? 'pass' : 'fail',
        `env.match.${key}`,
        `${key} env matches runtime`,
        runtimeValue === envValue ? 'Runtime and app env agree.' : `Runtime ${appAddrs[key]} differs from env ${envAddresses[key]}.`,
      ),
    );
  }

  const client = publicClient || createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  let rpcAvailable = false;

  try {
    const [chainId, blockNumber] = await withTimeout('RPC health check', timeoutMs, async () => Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
    ]));
    rpcAvailable = true;
    evidence.chainId = Number(chainId);
    evidence.blockNumber = blockNumber;
    checks.push(
      check(
        Number(chainId) === 31337 ? 'pass' : 'fail',
        'rpc.chainId',
        'RPC chain ID',
        `Chain ID is ${chainId}.`,
      ),
    );
    checks.push(check('pass', 'rpc.blockNumber', 'RPC block number', `Latest block is ${blockNumber}.`));
  } catch (error) {
    checks.push(check('fail', 'rpc.reachable', 'RPC reachable', error.message));
  }

  if (rpcAvailable) {
    for (const key of requiredKeys) {
      const address = addresses[key];
      if (!isAddress(address)) continue;
      try {
        const code = await withTimeout(`bytecode ${key}`, timeoutMs, () => client.getBytecode({ address }));
        const status = bytecodeStatus(code);
        evidence.bytecodeSizes = {
          ...(evidence.bytecodeSizes || {}),
          [key]: status.sizeBytes,
        };
        checks.push(
          check(
            status.hasBytecode ? 'pass' : 'fail',
            `bytecode.${key}`,
            `${key} bytecode`,
            status.hasBytecode ? `${status.sizeBytes} bytes deployed.` : 'No bytecode found at address.',
          ),
        );
      } catch (error) {
        checks.push(check('fail', `bytecode.${key}`, `${key} bytecode`, error.message));
      }
    }

    const boardAddress = addresses.VITE_BOARD_ADDRESS;
    const registryAddress = addresses.VITE_GAME_REGISTRY_ADDRESS;
    const summaryAddress = addresses.VITE_GAME_SUMMARY_ADDRESS;
    if (isAddress(boardAddress) && isAddress(registryAddress)) {
      try {
        const latestGameId = await withTimeout('latest game read', timeoutMs, () => client.readContract({
          address: registryAddress,
          abi: gameRegistryAbi,
          functionName: 'latestGame',
          args: [boardAddress],
        }));
        evidence.latestGameId = latestGameId;
        checks.push(
          check(
            latestGameId > 0n ? 'pass' : 'fail',
            'contract.latestGame',
            'Latest seeded game',
            latestGameId > 0n ? `Latest game ID is ${latestGameId}.` : 'No seeded game was found.',
          ),
        );
      } catch (error) {
        checks.push(check('fail', 'contract.latestGame', 'Latest seeded game', error.message));
      }
    }

    if (isAddress(boardAddress) && isAddress(registryAddress) && isAddress(summaryAddress)) {
      try {
        const [gameIds, maxPlayers, currentRegistrations] = await withTimeout('available games read', timeoutMs, () => client.readContract({
          address: summaryAddress,
          abi: gameSummaryAbi,
          functionName: 'getAvailableGames',
          args: [boardAddress, registryAddress],
        }));
        evidence.openGameCount = gameIds.length;
        evidence.openGames = gameIds.map((gameId, index) => ({
          gameId,
          maxPlayers: maxPlayers[index],
          currentRegistrations: currentRegistrations[index],
        }));
        checks.push(
          check(
            gameIds.length > 0 ? 'pass' : 'warn',
            'contract.availableGames',
            'Open game discovery',
            gameIds.length > 0 ? `${gameIds.length} open game(s) found.` : 'No open games were found.',
          ),
        );
      } catch (error) {
        checks.push(check('fail', 'contract.availableGames', 'Open game discovery', error.message));
      }
    }
  }

  return buildHealthReport({
    rpcUrl,
    mode,
    players,
    addresses,
    checks,
    evidence: {
      ...evidence,
      namedContracts: mergedByName,
    },
    bootSteps,
    childProcesses,
    flags,
    paths,
  });
}

export async function writeLocalStackHealthReports(report, {
  reportDir = DEFAULT_REPORT_DIR,
  publicReportDir = DEFAULT_PUBLIC_REPORT_DIR,
} = {}) {
  await fs.mkdir(reportDir, { recursive: true });
  await fs.mkdir(publicReportDir, { recursive: true });

  const jsonText = `${JSON.stringify(report, jsonReplacer, 2)}\n`;
  const markdownText = markdownForLocalStackHealth(report);
  const reportJsonPath = path.resolve(reportDir, 'latest-health.json');
  const reportMarkdownPath = path.resolve(reportDir, 'latest-health.md');
  const publicJsonPath = path.resolve(publicReportDir, 'latest-health.json');

  await Promise.all([
    fs.writeFile(reportJsonPath, jsonText, 'utf8'),
    fs.writeFile(reportMarkdownPath, markdownText, 'utf8'),
    fs.writeFile(publicJsonPath, jsonText, 'utf8'),
  ]);

  return {
    reportJsonPath,
    reportMarkdownPath,
    publicJsonPath,
  };
}

