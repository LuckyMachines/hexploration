const ENV = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
const API_URL = String(ENV.VITE_RETURN_API_URL || '').replace(/\/$/, '');
const SESSION_KEY = 'xenovoya:return-service-session:v2';
const LEGACY_SESSION_KEY = 'xenovoya:return-service-session:v1';

export const RETURN_API_CONTRACT_VERSION = '2026-07-14.1';
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

async function request(path, { method = 'GET', body, token } = {}) {
  if (!API_URL) throw new ReturnServiceError('Return service is not configured.', 0);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ReturnServiceError('Cloud return history is temporarily unreachable.', 0);
  }
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

export function putCloudReturnState(state, expectedVersion, token = loadReturnSession()?.token) {
  return request('/v1/return-state', { method: 'PUT', body: { expectedVersion, state }, token });
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
  return request('/v1/events', { method: 'POST', body: { eventId, name, ...(gameId ? { gameId } : {}), properties }, token });
}
