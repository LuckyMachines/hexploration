export const PRIVATE_ROUTE_PATTERNS = [
  '/game/:gameId',
];

const STATIC_ROUTES = [
  {
    path: '/',
    type: 'home',
    title: 'Xenovoya',
    description: 'Play Xenovoya, a cooperative on-chain hex exploration game about voyaging into fog, sharing discoveries, and escaping together.',
    priority: 1,
    changefreq: 'weekly',
  },
  {
    path: '/privacy',
    type: 'privacy',
    title: 'Xenovoya data and privacy',
    description: 'Understand local storage, optional wallet-linked return history, privacy-safe analytics, export, deletion, and public on-chain records.',
    priority: 0.4,
    changefreq: 'monthly',
  },
];

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function buildPublicRouteIndex({ generatedAt = new Date().toISOString() } = {}) {
  return uniqueBy(STATIC_ROUTES.map((route) => ({
    discoverable: true,
    noindex: false,
    lastmod: generatedAt,
    image: '/seo/xenovoya-share-card.svg',
    ...route,
  })), (route) => route.path);
}

export function noindexRouteForPath(pathname = '') {
  const normalized = normalizeRoutePath(pathname);
  if (normalized !== '/') return true;
  return PRIVATE_ROUTE_PATTERNS.some((pattern) => {
    if (!pattern.includes(':')) return normalizeRoutePath(pattern) === normalized;
    const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`);
    return regex.test(normalized);
  });
}

export function normalizeRoutePath(pathname = '/') {
  const clean = `/${String(pathname || '/').split('?')[0].replace(/^\/+/, '')}`;
  return clean === '/index.html' ? '/' : clean.replace(/\/+$/, '') || '/';
}

export function routeForLocation({ pathname = '/', search = '' } = {}) {
  const normalized = normalizeRoutePath(pathname);
  const routes = buildPublicRouteIndex();
  const exact = routes.find((route) => route.path === normalized);
  if (exact) return exact;
  if (noindexRouteForPath(normalized)) {
    return {
      path: normalized,
      title: 'Xenovoya Live Client',
      description: 'Start from the live Xenovoya client.',
      type: 'private',
      discoverable: false,
      noindex: true,
      canonicalPath: '/',
      priority: 0,
      changefreq: 'never',
    };
  }
  return {
    path: normalized,
    title: 'Xenovoya',
    description: 'A Xenovoya page.',
    type: 'unknown',
    discoverable: false,
    noindex: true,
    canonicalPath: '/',
    priority: 0,
    changefreq: 'never',
  };
}
