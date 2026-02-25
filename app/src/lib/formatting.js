export function truncateAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatBigInt(value) {
  if (value === undefined || value === null) return '0';
  return Number(value).toString();
}

export function formatStat(value) {
  if (value === undefined || value === null) return '0';
  return Number(value).toString();
}

export function formatZoneAlias(alias) {
  if (!alias) return '??';
  return alias;
}

export function statDelta(value) {
  const n = Number(value);
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '0';
}
