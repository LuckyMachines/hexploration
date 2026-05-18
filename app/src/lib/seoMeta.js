import { getSeoConfig, isPlaceholderSiteUrl } from './seoConfig.js';
import { normalizeRoutePath } from './publicRoutes.js';

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

function compactWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function normalizeSiteUrl(siteUrl = '') {
  const clean = String(siteUrl || '').trim().replace(/\/+$/, '');
  if (!clean) return '';
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

export function buildCanonicalUrl(path = '/', config = getSeoConfig()) {
  const siteUrl = normalizeSiteUrl(config.siteUrl);
  const [pathname, query = ''] = String(path || '/').split('?');
  const normalizedPath = normalizeRoutePath(pathname);
  const suffix = query ? `${normalizedPath}?${query}` : normalizedPath;
  return `${siteUrl}${suffix === '/' ? '' : suffix}`;
}

export function truncateText(value = '', limit = DESCRIPTION_LIMIT) {
  const clean = compactWhitespace(value);
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 1)).replace(/\s+\S*$/, '')}.`;
}

export function buildTitle(title, config = getSeoConfig()) {
  const clean = compactWhitespace(title || config.defaultTitle);
  const suffix = config.siteName && clean !== config.siteName ? ` | ${config.siteName}` : '';
  return truncateText(`${clean}${suffix}`, TITLE_LIMIT);
}

export function buildDescription(description, config = getSeoConfig()) {
  return truncateText(description || config.defaultDescription, DESCRIPTION_LIMIT);
}

function absoluteAssetUrl(assetPath = '', config = getSeoConfig()) {
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  return buildCanonicalUrl(assetPath || config.defaultImage, config);
}

function breadcrumbFor(route = {}, config = getSeoConfig()) {
  const parts = normalizeRoutePath(route.path).split('/').filter(Boolean);
  const items = [{ name: config.siteName, item: buildCanonicalUrl('/', config) }];
  let current = '';
  for (const part of parts) {
    current += `/${part}`;
    items.push({
      name: part.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      item: buildCanonicalUrl(current, config),
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

export function buildJsonLd(route = {}, meta = {}, config = getSeoConfig()) {
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.siteName,
    url: buildCanonicalUrl('/', config),
    description: config.defaultDescription,
  };
  const game = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: config.siteName,
    url: buildCanonicalUrl('/', config),
    description: config.defaultDescription,
    genre: ['Turn-based strategy', 'Board game', 'Exploration'],
    gamePlatform: 'Web browser',
    applicationCategory: 'Game',
  };
  const page = {
    '@context': 'https://schema.org',
    '@type': route.type === 'devlog' ? 'Blog' : 'WebPage',
    name: meta.title,
    url: meta.canonicalUrl,
    description: meta.description,
    isPartOf: { '@type': 'WebSite', name: config.siteName, url: buildCanonicalUrl('/', config) },
  };
  if (route.type === 'scenario') {
    page['@type'] = 'Game';
    page.gameItem = route.title;
    page.numberOfPlayers = route.players;
    page.keywords = (route.tags || []).join(', ');
  }
  return [website, game, page, breadcrumbFor(route, config)];
}

export function buildSeoMeta(route = {}, config = getSeoConfig()) {
  const canonicalPath = route.canonicalPath || route.path || '/';
  const title = buildTitle(route.title, config);
  const description = buildDescription(route.description, config);
  const canonicalUrl = buildCanonicalUrl(canonicalPath, config);
  const image = absoluteAssetUrl(route.image || config.defaultImage, config);
  const robots = route.noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large';
  const meta = {
    schemaVersion: 1,
    routePath: route.path || '/',
    routeType: route.type || 'page',
    title,
    description,
    canonicalUrl,
    robots,
    openGraph: {
      type: route.type === 'scenario' ? 'article' : 'website',
      siteName: config.siteName,
      title,
      description,
      url: canonicalUrl,
      image,
      locale: config.locale,
    },
    twitter: {
      card: config.twitterCard,
      title,
      description,
      image,
    },
  };
  return {
    ...meta,
    jsonLd: buildJsonLd(route, meta, config),
  };
}

export function validateSeoMeta(meta = {}, { route = {}, config = getSeoConfig(), strict = false } = {}) {
  const errors = [];
  const warnings = [];
  if (!meta.title) errors.push('Missing title.');
  if (!meta.description) errors.push('Missing description.');
  if (!meta.canonicalUrl || !/^https?:\/\//i.test(meta.canonicalUrl)) errors.push('Canonical URL must be absolute.');
  if (!meta.openGraph?.image) errors.push('Open Graph image is missing.');
  if (!Array.isArray(meta.jsonLd) || meta.jsonLd.length === 0) errors.push('JSON-LD is missing.');
  if (meta.title && meta.title.length > TITLE_LIMIT) warnings.push(`Title is longer than ${TITLE_LIMIT} characters.`);
  if (meta.description && meta.description.length > DESCRIPTION_LIMIT) warnings.push(`Description is longer than ${DESCRIPTION_LIMIT} characters.`);
  if (route.noindex && !String(meta.robots || '').includes('noindex')) errors.push('Private route must be noindex.');
  if (!route.noindex && String(meta.robots || '').includes('noindex')) errors.push('Public route is accidentally noindex.');
  if (strict && isPlaceholderSiteUrl(config.siteUrl)) errors.push('Strict mode requires a production public site URL.');
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
