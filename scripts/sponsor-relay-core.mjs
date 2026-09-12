import path from 'node:path';
import {
  encodeAbiParameters,
  getAddress,
  hashTypedData,
  isAddress,
  keccak256,
  recoverTypedDataAddress,
  stringToHex,
} from 'viem';

export const SPONSOR_RELAY_VERSION = 1;
export const ACTION_AUTHORIZATION_TYPES = {
  ActionAuthorization: [
    { name: 'player', type: 'address' },
    { name: 'playerID', type: 'uint256' },
    { name: 'actionIndex', type: 'uint8' },
    { name: 'optionsHash', type: 'bytes32' },
    { name: 'leftHandHash', type: 'bytes32' },
    { name: 'rightHandHash', type: 'bytes32' },
    { name: 'gameID', type: 'uint256' },
    { name: 'boardAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

export const SESSION_FORWARDER_ABI = [
  {
    type: 'function', name: 'CONTROLLER', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }],
  },
  {
    type: 'function', name: 'actionNonces', stateMutability: 'view', inputs: [{ name: 'signer', type: 'address' }], outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function', name: 'isSessionKeyAuthorized', stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }, { name: 'sessionKey', type: 'address' }, { name: 'gameID', type: 'uint256' }, { name: 'boardAddress', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function', name: 'submitActionWithSignature', stateMutability: 'nonpayable',
    inputs: [{
      name: 'action', type: 'tuple', components: [
        { name: 'player', type: 'address' },
        { name: 'playerID', type: 'uint256' },
        { name: 'actionIndex', type: 'uint8' },
        { name: 'options', type: 'string[]' },
        { name: 'leftHand', type: 'string' },
        { name: 'rightHand', type: 'string' },
        { name: 'gameID', type: 'uint256' },
        { name: 'boardAddress', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'signature', type: 'bytes' },
      ],
    }],
    outputs: [],
  },
  {
    type: 'function', name: 'submitActionsWithSignatures', stateMutability: 'nonpayable',
    inputs: [{
      name: 'actions', type: 'tuple[]', components: [
        { name: 'player', type: 'address' },
        { name: 'playerID', type: 'uint256' },
        { name: 'actionIndex', type: 'uint8' },
        { name: 'options', type: 'string[]' },
        { name: 'leftHand', type: 'string' },
        { name: 'rightHand', type: 'string' },
        { name: 'gameID', type: 'uint256' },
        { name: 'boardAddress', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
        { name: 'signature', type: 'bytes' },
      ],
    }],
    outputs: [],
  },
];

export const CONTROLLER_FORWARDER_ABI = [
  {
    type: 'function', name: 'ACTION_FORWARDER_ROLE', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function', name: 'hasRole', stateMutability: 'view',
    inputs: [{ name: 'role', type: 'bytes32' }, { name: 'account', type: 'address' }], outputs: [{ type: 'bool' }],
  },
];

export class RelayError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'RelayError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function asPositiveInteger(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function asBigInt(value, fallback, name) {
  try {
    const parsed = BigInt(value ?? fallback);
    if (parsed <= 0n) throw new Error();
    return parsed;
  } catch {
    throw new Error(`${name} must be a positive integer`);
  }
}

function requiredAddress(value, name) {
  if (!isAddress(value || '')) throw new Error(`${name} must be an Ethereum address`);
  return getAddress(value);
}

function requiredUrl(value, name, allowHttp) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${name} must be an absolute URL`); }
  const localHttp = allowHttp && parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !localHttp) throw new Error(`${name} must use HTTPS (or loopback HTTP when explicitly allowed)`);
  return parsed.toString().replace(/\/$/, '');
}

function requiredOrigins(value, allowHttp) {
  const entries = String(value || '').split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean);
  if (!entries.length) throw new Error('SPONSOR_RELAY_ALLOWED_ORIGINS must contain at least one exact browser origin');
  for (const origin of entries) {
    let parsed;
    try { parsed = new URL(origin); } catch { throw new Error('SPONSOR_RELAY_ALLOWED_ORIGINS contains an invalid URL'); }
    const localHttp = allowHttp && parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !localHttp) || parsed.origin !== origin) {
      throw new Error('SPONSOR_RELAY_ALLOWED_ORIGINS entries must be exact HTTPS origins (or loopback HTTP when explicitly allowed)');
    }
  }
  return new Set(entries);
}

export function parseRelayConfig(env = process.env, cwd = process.cwd()) {
  const allowHttp = env.SPONSOR_RELAY_ALLOW_LOCAL_HTTP === 'true';
  const privateKey = String(env.SPONSOR_RELAYER_PRIVATE_KEY || '');
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('SPONSOR_RELAYER_PRIVATE_KEY must be a 32-byte hex private key');
  const adminToken = String(env.SPONSOR_RELAY_ADMIN_TOKEN || '');
  if (adminToken.length < 32) throw new Error('SPONSOR_RELAY_ADMIN_TOKEN must contain at least 32 characters');

  return {
    chainId: asPositiveInteger(env.SPONSOR_RELAY_CHAIN_ID, 11155111, 'SPONSOR_RELAY_CHAIN_ID'),
    rpcUrl: requiredUrl(env.SPONSOR_RELAY_RPC_URL, 'SPONSOR_RELAY_RPC_URL', allowHttp),
    forwarderAddress: requiredAddress(env.SPONSOR_RELAY_FORWARDER_ADDRESS, 'SPONSOR_RELAY_FORWARDER_ADDRESS'),
    controllerAddress: requiredAddress(env.SPONSOR_RELAY_CONTROLLER_ADDRESS, 'SPONSOR_RELAY_CONTROLLER_ADDRESS'),
    boardAddress: requiredAddress(env.SPONSOR_RELAY_BOARD_ADDRESS, 'SPONSOR_RELAY_BOARD_ADDRESS'),
    privateKey,
    adminToken,
    allowedOrigins: requiredOrigins(env.SPONSOR_RELAY_ALLOWED_ORIGINS, allowHttp),
    port: asPositiveInteger(env.PORT || env.SPONSOR_RELAY_PORT, 8787, 'PORT'),
    host: String(env.SPONSOR_RELAY_HOST || '0.0.0.0'),
    trustProxy: env.SPONSOR_RELAY_TRUST_PROXY === 'true',
    stateFile: path.resolve(cwd, env.SPONSOR_RELAY_STATE_FILE || 'data/sponsor-relay-state.json'),
    confirmations: asPositiveInteger(env.SPONSOR_RELAY_CONFIRMATIONS, 2, 'SPONSOR_RELAY_CONFIRMATIONS'),
    maxBodyBytes: asPositiveInteger(env.SPONSOR_RELAY_MAX_BODY_BYTES, 65_536, 'SPONSOR_RELAY_MAX_BODY_BYTES'),
    maxInFlight: asPositiveInteger(env.SPONSOR_RELAY_MAX_IN_FLIGHT, 16, 'SPONSOR_RELAY_MAX_IN_FLIGHT'),
    maxDeadlineSeconds: asPositiveInteger(env.SPONSOR_RELAY_MAX_DEADLINE_SECONDS, 900, 'SPONSOR_RELAY_MAX_DEADLINE_SECONDS'),
    perIpHourlyRequests: asPositiveInteger(env.SPONSOR_RELAY_PER_IP_HOURLY_REQUESTS, 120, 'SPONSOR_RELAY_PER_IP_HOURLY_REQUESTS'),
    perSignerHourlyActions: asPositiveInteger(env.SPONSOR_RELAY_PER_SIGNER_HOURLY_ACTIONS, 30, 'SPONSOR_RELAY_PER_SIGNER_HOURLY_ACTIONS'),
    perPlayerDailyActions: asPositiveInteger(env.SPONSOR_RELAY_PER_PLAYER_DAILY_ACTIONS, 100, 'SPONSOR_RELAY_PER_PLAYER_DAILY_ACTIONS'),
    globalDailyActions: asPositiveInteger(env.SPONSOR_RELAY_GLOBAL_DAILY_ACTIONS, 500, 'SPONSOR_RELAY_GLOBAL_DAILY_ACTIONS'),
    maxGasPerAction: asBigInt(env.SPONSOR_RELAY_MAX_GAS_PER_ACTION, 8_000_000n, 'SPONSOR_RELAY_MAX_GAS_PER_ACTION'),
    globalDailyGas: asBigInt(env.SPONSOR_RELAY_GLOBAL_DAILY_GAS, 500_000_000n, 'SPONSOR_RELAY_GLOBAL_DAILY_GAS'),
    maxSponsoredCostWei: asBigInt(env.SPONSOR_RELAY_MAX_COST_WEI, 20_000_000_000_000_000n, 'SPONSOR_RELAY_MAX_COST_WEI'),
    globalDailyCostWei: asBigInt(env.SPONSOR_RELAY_GLOBAL_DAILY_COST_WEI, 500_000_000_000_000_000n, 'SPONSOR_RELAY_GLOBAL_DAILY_COST_WEI'),
    minRelayerBalanceWei: asBigInt(env.SPONSOR_RELAY_MIN_BALANCE_WEI, 20_000_000_000_000_000n, 'SPONSOR_RELAY_MIN_BALANCE_WEI'),
    forcedPaused: env.SPONSOR_RELAY_PAUSED === 'true',
    explorerUrl: String(env.SPONSOR_RELAY_EXPLORER_URL || (Number(env.SPONSOR_RELAY_CHAIN_ID || 11155111) === 11155111 ? 'https://sepolia.etherscan.io' : '')).replace(/\/$/, ''),
  };
}

function parseUint(value, field, { min = 0n, max = (2n ** 256n) - 1n } = {}) {
  let parsed;
  try { parsed = BigInt(value); } catch { throw new RelayError(400, 'invalid_action', `${field} must be an unsigned integer`); }
  if (parsed < min || parsed > max) throw new RelayError(400, 'invalid_action', `${field} is outside its permitted range`);
  return parsed;
}

export function normalizeSignedAction(input, config, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RelayError(400, 'invalid_action', 'action must be an object');
  const player = requiredAddressForAction(input.player, 'player');
  const boardAddress = requiredAddressForAction(input.boardAddress, 'boardAddress');
  if (boardAddress !== config.boardAddress) throw new RelayError(403, 'board_not_sponsored', 'This relay does not sponsor that board');
  const playerID = parseUint(input.playerID, 'playerID', { min: 1n });
  const gameID = parseUint(input.gameID, 'gameID', { min: 1n });
  const nonce = parseUint(input.nonce, 'nonce');
  const deadline = parseUint(input.deadline, 'deadline');
  if (deadline < BigInt(nowSeconds)) throw new RelayError(409, 'signature_expired', 'The sponsored action signature has expired');
  if (deadline > BigInt(nowSeconds + config.maxDeadlineSeconds)) throw new RelayError(400, 'deadline_too_far', 'The signature deadline exceeds the relay maximum');
  const actionIndex = Number(parseUint(input.actionIndex, 'actionIndex', { min: 1n, max: 7n }));
  if (!Array.isArray(input.options) || input.options.length > 12) throw new RelayError(400, 'invalid_action', 'options must contain at most 12 values');
  const options = input.options.map((value) => boundedText(value, 'option', 128));
  if (options.reduce((total, value) => total + value.length, 0) > 1024) throw new RelayError(400, 'invalid_action', 'options exceed the total text limit');
  const signature = String(input.signature || '');
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new RelayError(400, 'invalid_signature', 'signature must be a 65-byte hex value');

  return {
    player,
    playerID,
    actionIndex,
    options,
    leftHand: boundedText(input.leftHand || '', 'leftHand', 128),
    rightHand: boundedText(input.rightHand || '', 'rightHand', 128),
    gameID,
    boardAddress,
    nonce,
    deadline,
    signature,
  };
}

function requiredAddressForAction(value, field) {
  if (!isAddress(value || '')) throw new RelayError(400, 'invalid_action', `${field} must be an Ethereum address`);
  return getAddress(value);
}

function boundedText(value, field, maxLength) {
  if (typeof value !== 'string' || value.length > maxLength) throw new RelayError(400, 'invalid_action', `${field} exceeds ${maxLength} characters`);
  return value;
}

export function actionTypedData(action, config) {
  return {
    domain: {
      name: 'Xenovoya',
      version: '1',
      chainId: config.chainId,
      verifyingContract: config.forwarderAddress,
    },
    types: ACTION_AUTHORIZATION_TYPES,
    primaryType: 'ActionAuthorization',
    message: {
      player: action.player,
      playerID: action.playerID,
      actionIndex: action.actionIndex,
      optionsHash: keccak256(encodeAbiParameters([{ type: 'string[]' }], [action.options])),
      leftHandHash: keccak256(stringToHex(action.leftHand)),
      rightHandHash: keccak256(stringToHex(action.rightHand)),
      gameID: action.gameID,
      boardAddress: action.boardAddress,
      nonce: action.nonce,
      deadline: action.deadline,
    },
  };
}

export function actionDigest(action, config) {
  return hashTypedData(actionTypedData(action, config));
}

export async function recoverActionSigner(action, config) {
  try {
    return getAddress(await recoverTypedDataAddress({ ...actionTypedData(action, config), signature: action.signature }));
  } catch {
    throw new RelayError(401, 'invalid_signature', 'Unable to recover the action signer');
  }
}

export function jsonSafeAction(action) {
  return {
    ...action,
    playerID: action.playerID.toString(),
    gameID: action.gameID.toString(),
    nonce: action.nonce.toString(),
    deadline: action.deadline.toString(),
  };
}

export class KeyedMutex {
  constructor() { this.queues = new Map(); }

  async run(key, task) {
    const prior = this.queues.get(key) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    const queued = prior.then(() => current);
    this.queues.set(key, queued);
    await prior;
    try { return await task(); } finally {
      release();
      if (this.queues.get(key) === queued) this.queues.delete(key);
    }
  }
}
