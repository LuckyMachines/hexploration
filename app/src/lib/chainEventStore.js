export function chainEventKey(log, fallbackName = 'Event') {
  const name = log.eventName || log.name || fallbackName;
  return `${log.transactionHash || 'unknown'}-${log.logIndex !== undefined ? String(log.logIndex) : '0'}-${name}`;
}

function serializable(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serializable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializable(item)]));
  }
  return value;
}

export function mapChainLog(log, fallbackName, observedAt = Date.now()) {
  const name = log.eventName || fallbackName;
  return {
    key: chainEventKey(log, name),
    name,
    args: serializable(log.args || {}),
    blockNumber: Number(log.blockNumber ?? 0n),
    blockHash: log.blockHash || null,
    logIndex: Number(log.logIndex ?? 0),
    transactionHash: log.transactionHash,
    removed: Boolean(log.removed),
    timestamp: observedAt,
  };
}

export function sortChainEvents(left, right) {
  return left.blockNumber - right.blockNumber || left.logIndex - right.logIndex;
}

export function reconcileChainEvents(previous = [], incoming = [], { max = 250, canonicalFromBlock = null, canonicalToBlock = null } = {}) {
  const byKey = new Map();
  previous.forEach((event) => {
    if (
      canonicalFromBlock !== null
      && event.blockNumber >= canonicalFromBlock
      && (canonicalToBlock === null || event.blockNumber <= canonicalToBlock)
    ) return;
    byKey.set(event.key, event);
  });
  incoming.forEach((event) => {
    if (event.removed) byKey.delete(event.key);
    else byKey.set(event.key, { ...byKey.get(event.key), ...event, removed: false });
  });
  return [...byKey.values()].sort(sortChainEvents).slice(-max);
}

export function parseEventCache(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return { version: 2, events: parsed, confirmedBlock: 0 };
    if (parsed && Array.isArray(parsed.events)) return parsed;
  } catch { /* invalid cache */ }
  return { version: 3, events: [], confirmedBlock: 0 };
}

export function serializeEventCache(events, confirmedBlock = 0) {
  return JSON.stringify({ version: 3, confirmedBlock, savedAt: new Date().toISOString(), events });
}
