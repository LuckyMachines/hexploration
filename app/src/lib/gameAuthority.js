const STORAGE_KEY = 'xenovoya:play-session:v1';

const authorityUrl = () => String(import.meta.env.VITE_GAME_AUTHORITY_URL || '').replace(/\/$/, '');

function readSession() {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    if (!value?.token || !value?.playerIdentity || Date.parse(value.expiresAt) <= Date.now()) return null;
    return value;
  } catch { return null; }
}

function saveSession(session) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

async function request(path, { session, ...options } = {}) {
  const base = authorityUrl();
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(session?.token ? { authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'Live play could not process that request.');
    error.code = payload.error?.code || 'game_service_error';
    throw error;
  }
  return payload;
}

export async function ensureGameSession({ force = false } = {}) {
  if (!force) {
    const current = readSession();
    if (current) return current;
  }
  return saveSession(await request('/v1/game/session', { method: 'POST' }));
}

export function clearGameSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function submitGameCommand(kind, body) {
  let session = await ensureGameSession();
  try {
    return await request(`/v1/game/commands/${kind}`, { method: 'POST', session, body: JSON.stringify(body) });
  } catch (error) {
    if (!['invalid_session', 'session_expired', 'session_required'].includes(error.code)) throw error;
    session = await ensureGameSession({ force: true });
    return request(`/v1/game/commands/${kind}`, { method: 'POST', session, body: JSON.stringify(body) });
  }
}

export async function getGameOperation(operationId) {
  const session = await ensureGameSession();
  return request(`/v1/game/operations/${encodeURIComponent(operationId)}`, { method: 'GET', session });
}

export async function requestGameState(method, params = []) {
  let session = await ensureGameSession();
  const perform = () => request('/v1/game/state', {
    method: 'POST',
    session,
    body: JSON.stringify({ method, params }),
  });
  try {
    return (await perform()).result;
  } catch (error) {
    if (!['invalid_session', 'session_expired', 'session_required'].includes(error.code)) throw error;
    session = await ensureGameSession({ force: true });
    return (await perform()).result;
  }
}

export function gameAuthorityConfigured() {
  return Boolean(authorityUrl());
}
