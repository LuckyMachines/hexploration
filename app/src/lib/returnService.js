const ENV = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
const API_URL = String(ENV.VITE_RETURN_API_URL || '').replace(/\/$/, '');
const SESSION_KEY = 'xenovoya:return-service-session:v1';

function request(path, { method = 'GET', body, token } = {}) {
  if (!API_URL) return Promise.reject(new Error('Return service is not configured.'));
  return fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Return service request failed (${response.status}).`);
    return payload;
  });
}

export function returnServiceEnabled() { return Boolean(API_URL); }
export function loadReturnSession(storage = typeof window === 'undefined' ? null : window.localStorage) { return storage?.getItem(SESSION_KEY) || ''; }
export function saveReturnSession(token, storage = typeof window === 'undefined' ? null : window.localStorage) { if (storage && token) storage.setItem(SESSION_KEY, token); return token; }
export function clearReturnSession(storage = typeof window === 'undefined' ? null : window.localStorage) { storage?.removeItem(SESSION_KEY); }

export async function authenticateReturnService(address) {
  if (!window.ethereum) throw new Error('Connect a wallet before enabling cloud return history.');
  const nonce = await request('/v1/auth/nonce', { method: 'POST', body: { address } });
  const signature = await window.ethereum.request({ method: 'personal_sign', params: [nonce.message, address] });
  const session = await request('/v1/auth/verify', { method: 'POST', body: { address, signature, message: nonce.message } });
  return saveReturnSession(session.token);
}

export function syncReturnSummary(summary, token = loadReturnSession()) {
  return request('/v1/expedition-summary', { method: 'PUT', body: summary, token });
}

export function recordRetentionEvent(name, properties = {}, token = loadReturnSession()) {
  return request('/v1/retention-events', { method: 'POST', body: { name, properties }, token });
}
