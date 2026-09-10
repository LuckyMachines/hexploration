const DB_NAME = 'xenovoya-session-v1';
const DB_VERSION = 1;
const FALLBACK_PREFIX = 'xenovoya:session:';
const PENDING_TX_KEY = `${FALLBACK_PREFIX}pending-transactions`;

function fallbackStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('snapshots')) database.createObjectStore('snapshots');
      if (!database.objectStoreNames.contains('outbox')) database.createObjectStore('outbox', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function transact(storeName, mode, operation) {
  const database = await openDatabase();
  if (!database) return undefined;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function loadSessionDocument(key) {
  try {
    const stored = await transact('snapshots', 'readonly', (store) => store.get(key));
    if (stored !== undefined) return stored;
  } catch { /* local fallback below */ }
  try { return parse(fallbackStorage()?.getItem(`${FALLBACK_PREFIX}${key}`) || 'null'); }
  catch { return null; }
}

export async function saveSessionDocument(key, value) {
  const envelope = { value, checksum: checksum(value), savedAt: new Date().toISOString() };
  try {
    const stored = await transact('snapshots', 'readwrite', (store) => store.put(envelope, key));
    if (stored === undefined && typeof indexedDB === 'undefined') fallbackStorage()?.setItem(`${FALLBACK_PREFIX}${key}`, stringify(envelope));
  } catch { fallbackStorage()?.setItem(`${FALLBACK_PREFIX}${key}`, stringify(envelope)); }
  broadcastSessionChange({ type: 'snapshot', key, savedAt: envelope.savedAt });
  return envelope;
}

export async function readSessionSnapshot(key) {
  const envelope = await loadSessionDocument(key);
  if (!envelope || envelope.checksum !== checksum(envelope.value)) return null;
  return envelope.value;
}

export async function enqueueSessionMutation(kind, payload, id = crypto.randomUUID()) {
  const mutation = { id, kind, payload, status: 'queued', attempts: 0, createdAt: new Date().toISOString() };
  try {
    const stored = await transact('outbox', 'readwrite', (store) => store.put(mutation));
    if (stored === undefined && typeof indexedDB === 'undefined') throw new Error('indexeddb_unavailable');
  }
  catch {
    const current = JSON.parse(fallbackStorage()?.getItem(`${FALLBACK_PREFIX}outbox`) || '[]');
    fallbackStorage()?.setItem(`${FALLBACK_PREFIX}outbox`, JSON.stringify([...current.filter((item) => item.id !== id), mutation]));
  }
  broadcastSessionChange({ type: 'outbox', id });
  return mutation;
}

export async function listSessionMutations() {
  try {
    const stored = await transact('outbox', 'readonly', (store) => store.getAll());
    if (stored !== undefined || typeof indexedDB !== 'undefined') return stored || [];
    throw new Error('indexeddb_unavailable');
  }
  catch {
    try { return JSON.parse(fallbackStorage()?.getItem(`${FALLBACK_PREFIX}outbox`) || '[]'); }
    catch { return []; }
  }
}

export async function acknowledgeSessionMutation(id) {
  try {
    const removed = await transact('outbox', 'readwrite', (store) => store.delete(id));
    if (removed === undefined && typeof indexedDB === 'undefined') throw new Error('indexeddb_unavailable');
  }
  catch {
    const current = await listSessionMutations();
    fallbackStorage()?.setItem(`${FALLBACK_PREFIX}outbox`, JSON.stringify(current.filter((item) => item.id !== id)));
  }
}

export function loadPendingTransactions(storage = fallbackStorage()) {
  try { return JSON.parse(storage?.getItem(PENDING_TX_KEY) || '[]'); }
  catch { return []; }
}

export function savePendingTransaction(transaction, storage = fallbackStorage()) {
  const current = loadPendingTransactions(storage).filter((item) => item.hash !== transaction.hash);
  const next = [...current, { ...transaction, recordedAt: transaction.recordedAt || new Date().toISOString() }].slice(-20);
  storage?.setItem(PENDING_TX_KEY, JSON.stringify(next));
  return next;
}

export function settlePendingTransaction(hash, status, storage = fallbackStorage()) {
  const next = loadPendingTransactions(storage).map((item) => item.hash === hash ? { ...item, status, settledAt: new Date().toISOString() } : item).filter((item) => !item.settledAt || Date.now() - Date.parse(item.settledAt) < 86_400_000);
  storage?.setItem(PENDING_TX_KEY, JSON.stringify(next));
  return next;
}

export async function withSessionLock(name, operation) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) return navigator.locks.request(`xenovoya:${name}`, operation);
  return operation();
}

let channel;
function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  channel ||= new BroadcastChannel('xenovoya-session');
  return channel;
}
export function broadcastSessionChange(message) { getChannel()?.postMessage(message); }
export function subscribeSessionChanges(listener) {
  const current = getChannel();
  if (!current) return () => {};
  current.addEventListener('message', listener);
  return () => current.removeEventListener('message', listener);
}

export function checksum(value) {
  const input = stringify(value) || '';
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const stringify = (value) => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? { __xenovoyaBigInt: item.toString() } : item);
const parse = (value) => JSON.parse(value, (_key, item) => item && typeof item === 'object' && Object.keys(item).length === 1 && typeof item.__xenovoyaBigInt === 'string'
  ? BigInt(item.__xenovoyaBigInt)
  : item);
