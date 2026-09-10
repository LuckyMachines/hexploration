const ENV = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
const API_URL = String(ENV.VITE_RETURN_API_URL || '').replace(/\/$/, '');
const SESSION_KEY = 'xenovoya:return-service-session:v2';
const LEGACY_SESSION_KEY = 'xenovoya:return-service-session:v1';

export const RETURN_API_CONTRACT_VERSION = '2026-09-10.1';
export const RETURN_API_OPERATIONS = Object.freeze({
  issueNonce: { method: 'post', path: '/v1/auth/nonce' },
  verifyWallet: { method: 'post', path: '/v1/auth/verify' },
  revokeSession: { method: 'delete', path: '/v1/session' },
  getProfile: { method: 'get', path: '/v1/profile' },
  exportProfile: { method: 'get', path: '/v1/profile/export' },
  updateProfile: { method: 'put', path: '/v1/profile' },
  deleteProfile: { method: 'delete', path: '/v1/profile' },
  getReturnState: { method: 'get', path: '/v1/return-state' },
  putReturnState: { method: 'put', path: '/v1/return-state' },
  listParties: { method: 'get', path: '/v1/parties' },
  createParty: { method: 'post', path: '/v1/parties' },
  getParty: { method: 'get', path: '/v1/parties/{partyId}' },
  updateParty: { method: 'patch', path: '/v1/parties/{partyId}' },
  leaveParty: { method: 'delete', path: '/v1/parties/{partyId}/members/me' },
  setPartyReadiness: { method: 'put', path: '/v1/parties/{partyId}/readiness' },
  joinPublicParty: { method: 'post', path: '/v1/parties/{partyId}/join' },
  kickPartyMember: { method: 'post', path: '/v1/parties/{partyId}/members/{wallet}/kick' },
  transferParty: { method: 'post', path: '/v1/parties/{partyId}/transfer' },
  createPartyInvite: { method: 'post', path: '/v1/parties/{partyId}/invites' },
  revokePartyInvite: { method: 'delete', path: '/v1/parties/{partyId}/invites/{inviteId}' },
  previewPartyInvite: { method: 'get', path: '/v1/invites/{token}' },
  acceptPartyInvite: { method: 'post', path: '/v1/invites/{token}/accept' },
  searchPlayers: { method: 'get', path: '/v1/players/search' },
  listRecentPlayers: { method: 'get', path: '/v1/players/recent' },
  listFriends: { method: 'get', path: '/v1/friends' },
  requestFriend: { method: 'post', path: '/v1/friends/requests' },
  respondFriend: { method: 'post', path: '/v1/friends/requests/{wallet}/respond' },
  removeFriend: { method: 'delete', path: '/v1/friends/{wallet}' },
  setFavorite: { method: 'put', path: '/v1/friends/{wallet}/favorite' },
  blockPlayer: { method: 'post', path: '/v1/blocks' },
  unblockPlayer: { method: 'delete', path: '/v1/blocks/{wallet}' },
  reportPlayer: { method: 'post', path: '/v1/reports' },
  updatePresence: { method: 'put', path: '/v1/presence' },
  queryPresence: { method: 'post', path: '/v1/presence/query' },
  streamPresence: { method: 'get', path: '/v1/presence/stream' },
  getExpedition: { method: 'get', path: '/v1/expeditions/{gameId}' },
  updateExpeditionAnnotation: { method: 'put', path: '/v1/expeditions/{gameId}/annotation' },
  getPublicExpedition: { method: 'get', path: '/v1/public/expeditions/{gameId}' },
  recordRetentionEvent: { method: 'post', path: '/v1/events' },
});

export class ReturnServiceError extends Error {
  constructor(message, status, payload = {}) {
    super(message);
    this.name = 'ReturnServiceError';
    this.status = status;
    this.payload = payload;
  }
}

const retryableStatus = new Set([408, 425, 429, 500, 502, 503, 504]);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function request(path, { method = 'GET', body, token, timeoutMs = 10_000, retries = method === 'GET' ? 2 : 0 } = {}) {
  if (!API_URL) throw new ReturnServiceError('Return service is not configured.', 0);
  let response; let finalError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          'X-Request-ID': crypto.randomUUID(),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      clearTimeout(timeout);
      if (!retryableStatus.has(response.status) || attempt === retries) break;
    } catch (error) {
      clearTimeout(timeout);
      finalError = error;
      if (attempt === retries) throw new ReturnServiceError(error?.name === 'AbortError' ? 'Cloud request timed out safely.' : 'Cloud return history is temporarily unreachable.', 0);
    }
    await delay(Math.min(500 * (2 ** attempt), 2_000) + Math.round(Math.random() * 150));
  }
  if (!response) throw new ReturnServiceError(finalError?.message || 'Cloud return history is temporarily unreachable.', 0);
  const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new ReturnServiceError(payload.error || `Return service request failed (${response.status}).`, response.status, payload);
  return payload;
}

export function returnServiceEnabled() { return Boolean(API_URL); }

export function assertReturnApiContract(contract) {
  if (!contract || contract.openapi !== '3.1.0') throw new ReturnServiceError('Return service contract is missing or invalid.', 0);
  if (contract.info?.version !== RETURN_API_CONTRACT_VERSION) {
    throw new ReturnServiceError(`Return service contract ${contract.info?.version || 'missing'} is incompatible with this player release.`, 0);
  }
  for (const [operationId, operation] of Object.entries(RETURN_API_OPERATIONS)) {
    if (contract.paths?.[operation.path]?.[operation.method]?.operationId !== operationId) {
      throw new ReturnServiceError(`Return service operation ${operationId} is incompatible with this player release.`, 0);
    }
  }
  return { version: RETURN_API_CONTRACT_VERSION, operations: Object.keys(RETURN_API_OPERATIONS).length };
}

export async function verifyReturnApiContract() {
  const contract = await request('/openapi.json');
  return assertReturnApiContract(contract);
}

export function loadReturnSession(storage = typeof window === 'undefined' ? null : window.localStorage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session.token || !session.wallet || !session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
      storage.removeItem(SESSION_KEY);
      return null;
    }
    return { ...session, wallet: session.wallet.toLowerCase() };
  } catch {
    storage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveReturnSession(session, storage = typeof window === 'undefined' ? null : window.localStorage) {
  const safe = { token: session.token, wallet: session.wallet.toLowerCase(), expiresAt: session.expiresAt };
  if (storage) {
    storage.setItem(SESSION_KEY, JSON.stringify(safe));
    storage.removeItem(LEGACY_SESSION_KEY);
  }
  return safe;
}

export function clearReturnSession(storage = typeof window === 'undefined' ? null : window.localStorage) {
  storage?.removeItem(SESSION_KEY);
  storage?.removeItem(LEGACY_SESSION_KEY);
}

export async function authenticateReturnService(wallet, chainId) {
  if (typeof window === 'undefined' || !window.ethereum) throw new ReturnServiceError('Connect a wallet before enabling cloud return history.', 0);
  const normalizedWallet = wallet.toLowerCase();
  const nonce = await request('/v1/auth/nonce', { method: 'POST', body: { wallet: normalizedWallet, chainId } });
  const signature = await window.ethereum.request({ method: 'personal_sign', params: [nonce.message, normalizedWallet] });
  const session = await request('/v1/auth/verify', { method: 'POST', body: { wallet: normalizedWallet, signature, message: nonce.message } });
  return saveReturnSession({ ...session, wallet: normalizedWallet });
}

export async function logoutReturnService(session = loadReturnSession()) {
  if (session?.token) await request('/v1/session', { method: 'DELETE', token: session.token }).catch(() => {});
  clearReturnSession();
}

export function getCloudReturnState(token = loadReturnSession()?.token) {
  return request('/v1/return-state', { token });
}

export function putCloudReturnState(state, expectedVersion, token = loadReturnSession()?.token, clientMutationId = crypto.randomUUID()) {
  return request('/v1/return-state', { method: 'PUT', body: { expectedVersion, state, clientMutationId }, token, retries: 2 });
}

export function updateCloudProfile(profile, token = loadReturnSession()?.token) {
  return request('/v1/profile', { method: 'PUT', body: profile, token });
}

export function exportCloudProfile(token = loadReturnSession()?.token) {
  return request('/v1/profile/export', { token });
}

export async function deleteCloudProfile(token = loadReturnSession()?.token) {
  await request('/v1/profile', { method: 'DELETE', token });
  clearReturnSession();
}

export function updateExpeditionAnnotation(gameId, annotation, token = loadReturnSession()?.token) {
  return request(`/v1/expeditions/${encodeURIComponent(gameId)}/annotation`, { method: 'PUT', body: annotation, token });
}

export function recordRetentionEvent(name, properties = {}, { gameId, eventId = crypto.randomUUID(), token = loadReturnSession()?.token } = {}) {
  return request('/v1/events', { method: 'POST', body: { eventId, name, ...(gameId ? { gameId } : {}), properties }, token, retries: 2 });
}

const mutation = () => crypto.randomUUID();
export const listParties = (scope = 'mine', search = '', token = loadReturnSession()?.token) => request(`/v1/parties?scope=${encodeURIComponent(scope)}&search=${encodeURIComponent(search)}`, { token });
export const getParty = (partyId, token = loadReturnSession()?.token) => request(`/v1/parties/${encodeURIComponent(partyId)}`, { token });
export const createParty = (input, token = loadReturnSession()?.token) => request('/v1/parties', { method: 'POST', body: { ...input, clientMutationId: input.clientMutationId || mutation() }, token, retries: 2 });
export const updateParty = (partyId, input, token = loadReturnSession()?.token) => request(`/v1/parties/${encodeURIComponent(partyId)}`, { method: 'PATCH', body: { ...input, clientMutationId: input.clientMutationId || mutation() }, token, retries: 2 });
export const leaveParty = (partyId, token = loadReturnSession()?.token) => request(`/v1/parties/${encodeURIComponent(partyId)}/members/me`, { method: 'DELETE', body: { clientMutationId: mutation() }, token, retries: 2 });
export const setPartyReadiness = (partyId, ready, token = loadReturnSession()?.token) => request(`/v1/parties/${encodeURIComponent(partyId)}/readiness`, { method: 'PUT', body: { ready, clientMutationId: mutation() }, token, retries: 2 });
export const joinPublicParty = (partyId, token = loadReturnSession()?.token) => request(`/v1/parties/${encodeURIComponent(partyId)}/join`, { method: 'POST', body: { clientMutationId: mutation() }, token, retries: 2 });
export const kickPartyMember = (partyId, wallet, token = loadReturnSession()?.token) => request(`/v1/parties/${encodeURIComponent(partyId)}/members/${encodeURIComponent(wallet)}/kick`, { method: 'POST', body: { clientMutationId: mutation() }, token, retries: 2 });
export const transferParty = (partyId, wallet, token = loadReturnSession()?.token) => request(`/v1/parties/${encodeURIComponent(partyId)}/transfer`, { method: 'POST', body: { wallet, clientMutationId: mutation() }, token, retries: 2 });
export const createPartyInvite = (partyId, input = {}, token = loadReturnSession()?.token) => request(`/v1/parties/${encodeURIComponent(partyId)}/invites`, { method: 'POST', body: { expiresInMinutes: 1440, maxUses: 4, ...input, clientMutationId: input.clientMutationId || mutation() }, token, retries: 2 });
export const revokePartyInvite = (partyId, inviteId, token = loadReturnSession()?.token) => request(`/v1/parties/${encodeURIComponent(partyId)}/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE', body: { clientMutationId: mutation() }, token, retries: 2 });
export const previewPartyInvite = (inviteToken) => request(`/v1/invites/${encodeURIComponent(inviteToken)}`);
export const acceptPartyInvite = (inviteToken, token = loadReturnSession()?.token) => request(`/v1/invites/${encodeURIComponent(inviteToken)}/accept`, { method: 'POST', body: { clientMutationId: mutation() }, token, retries: 2 });
export const searchPlayers = (query, token = loadReturnSession()?.token) => request(`/v1/players/search?q=${encodeURIComponent(query)}`, { token });
export const listRecentPlayers = (token = loadReturnSession()?.token) => request('/v1/players/recent', { token });
export const listFriends = (token = loadReturnSession()?.token) => request('/v1/friends', { token });
export const requestFriend = (wallet, token = loadReturnSession()?.token) => request('/v1/friends/requests', { method: 'POST', body: { wallet, clientMutationId: mutation() }, token, retries: 2 });
export const respondFriend = (wallet, action, token = loadReturnSession()?.token) => request(`/v1/friends/requests/${encodeURIComponent(wallet)}/respond`, { method: 'POST', body: { action, clientMutationId: mutation() }, token, retries: 2 });
export const removeFriend = (wallet, token = loadReturnSession()?.token) => request(`/v1/friends/${encodeURIComponent(wallet)}`, { method: 'DELETE', body: { clientMutationId: mutation() }, token, retries: 2 });
export const setFavorite = (wallet, favorite, token = loadReturnSession()?.token) => request(`/v1/friends/${encodeURIComponent(wallet)}/favorite`, { method: 'PUT', body: { favorite, clientMutationId: mutation() }, token, retries: 2 });
export const blockPlayer = (wallet, token = loadReturnSession()?.token) => request('/v1/blocks', { method: 'POST', body: { wallet, clientMutationId: mutation() }, token, retries: 2 });
export const unblockPlayer = (wallet, token = loadReturnSession()?.token) => request(`/v1/blocks/${encodeURIComponent(wallet)}`, { method: 'DELETE', body: { clientMutationId: mutation() }, token, retries: 2 });
export const reportPlayer = (wallet, category = 'other', details = '', token = loadReturnSession()?.token) => request('/v1/reports', { method: 'POST', body: { wallet, category, details, clientMutationId: mutation() }, token, retries: 2 });
export const updatePresence = (presence, token = loadReturnSession()?.token) => request('/v1/presence', { method: 'PUT', body: presence, token });
export const queryPresence = (wallets, token = loadReturnSession()?.token) => request('/v1/presence/query', { method: 'POST', body: { wallets }, token });

export async function streamPresence(onRefresh, token = loadReturnSession()?.token, signal) {
  if (!API_URL || !token) return;
  const response = await fetch(`${API_URL}/v1/presence/stream`, { headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` }, signal });
  if (!response.ok || !response.body) throw new ReturnServiceError('Presence stream unavailable.', response.status);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (!signal?.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split('\n\n');
    buffer = messages.pop() || '';
    messages.forEach((message) => { if (message.includes('event: presence')) onRefresh(); });
  }
}
