import {
  encodeAbiParameters,
  getAddress,
  isAddress,
  keccak256,
  stringToHex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { ActionAuthorizationTypes } from '../config/sessionForwarder';

const relayUrl = () => String(import.meta.env.VITE_SPONSOR_RELAY_URL || '').replace(/\/$/, '');
const STORAGE_PREFIX = 'xenovoya:sponsor-session:v1';

export function sponsorSessionStorageKey({ chainId, player, gameId, boardAddress, forwarderAddress }) {
  return [STORAGE_PREFIX, chainId, player, boardAddress, gameId, forwarderAddress].map((value) => String(value || '').toLowerCase()).join(':');
}

export function createSponsorSession(scope, storage = window.sessionStorage) {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const session = {
    version: 1,
    ...scope,
    player: getAddress(scope.player),
    boardAddress: getAddress(scope.boardAddress),
    forwarderAddress: getAddress(scope.forwarderAddress),
    sessionAddress: account.address,
    privateKey,
    createdAt: new Date().toISOString(),
  };
  storage.setItem(sponsorSessionStorageKey(session), JSON.stringify(session));
  return session;
}

export function loadSponsorSession(scope, storage = typeof window === 'undefined' ? null : window.sessionStorage) {
  if (!storage || !scope.player || !scope.chainId || !scope.gameId || !scope.boardAddress || !scope.forwarderAddress) return null;
  try {
    const value = JSON.parse(storage.getItem(sponsorSessionStorageKey(scope)) || 'null');
    if (value?.version !== 1 || !/^0x[0-9a-fA-F]{64}$/.test(value.privateKey || '') || !isAddress(value.sessionAddress || '')) return null;
    if (privateKeyToAccount(value.privateKey).address !== getAddress(value.sessionAddress)) return null;
    return value;
  } catch { return null; }
}

export function clearSponsorSession(scope, storage = typeof window === 'undefined' ? null : window.sessionStorage) {
  storage?.removeItem(sponsorSessionStorageKey(scope));
}

export function sponsoredActionTypedData(action, { chainId, forwarderAddress }) {
  return {
    domain: { name: 'Xenovoya', version: '1', chainId, verifyingContract: getAddress(forwarderAddress) },
    types: ActionAuthorizationTypes,
    primaryType: 'ActionAuthorization',
    message: {
      player: getAddress(action.player),
      playerID: BigInt(action.playerID),
      actionIndex: Number(action.actionIndex),
      optionsHash: keccak256(encodeAbiParameters([{ type: 'string[]' }], [action.options || []])),
      leftHandHash: keccak256(stringToHex(action.leftHand || '')),
      rightHandHash: keccak256(stringToHex(action.rightHand || '')),
      gameID: BigInt(action.gameID),
      boardAddress: getAddress(action.boardAddress),
      nonce: BigInt(action.nonce),
      deadline: BigInt(action.deadline),
    },
  };
}

export async function signSponsoredAction(session, action) {
  const account = privateKeyToAccount(session.privateKey);
  const normalized = {
    ...action,
    player: getAddress(action.player),
    playerID: BigInt(action.playerID),
    actionIndex: Number(action.actionIndex),
    options: action.options || [],
    leftHand: action.leftHand || '',
    rightHand: action.rightHand || '',
    gameID: BigInt(action.gameID),
    boardAddress: getAddress(action.boardAddress),
    nonce: BigInt(action.nonce),
    deadline: BigInt(action.deadline),
  };
  const signature = await account.signTypedData(sponsoredActionTypedData(normalized, session));
  return { ...normalized, signature };
}

function jsonAction(action) {
  return {
    ...action,
    playerID: action.playerID.toString(),
    gameID: action.gameID.toString(),
    nonce: action.nonce.toString(),
    deadline: action.deadline.toString(),
  };
}

async function relayRequest(path, options = {}) {
  const base = relayUrl();
  if (!base) throw new Error('Gas sponsorship is not configured for this release.');
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Sponsor relay returned HTTP ${response.status}`);
    error.code = payload.error?.code || 'relay_error';
    error.details = payload.error?.details;
    throw error;
  }
  return payload;
}

export function getSponsorRelayConfig() {
  return relayRequest('/v1/sponsor/config', { method: 'GET' });
}

export function relaySponsoredAction(action) {
  return relayRequest('/v1/sponsor/actions', { method: 'POST', body: JSON.stringify({ action: jsonAction(action) }) });
}

export function relaySponsoredActions(actions) {
  return relayRequest('/v1/sponsor/actions/batch', { method: 'POST', body: JSON.stringify({ actions: actions.map(jsonAction) }) });
}

export function getSponsoredTransaction(hash) {
  return relayRequest(`/v1/sponsor/actions/${hash}`, { method: 'GET' });
}

export function sponsorRelayConfigured() {
  return Boolean(relayUrl());
}
