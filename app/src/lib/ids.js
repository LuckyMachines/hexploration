export function parseUintId(value) {
  if (value === undefined || value === null || value === '') return null;
  try {
    const parsed = typeof value === 'bigint' ? value : BigInt(value);
    return parsed >= 0n ? parsed : null;
  } catch {
    return null;
  }
}

export function safeUintId(value, fallback = 0n) {
  const parsed = parseUintId(value);
  return parsed === null ? fallback : parsed;
}
