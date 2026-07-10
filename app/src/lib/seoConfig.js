export const SEO_SCHEMA_VERSION = 1;

const ENV = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
const PROCESS_ENV = typeof process !== 'undefined' ? process.env || {} : {};

export const DEFAULT_SEO_CONFIG = {
  siteName: 'Xenovoya',
  siteUrl: 'https://xenovoya.luckymachines.com',
  defaultTitle: 'Xenovoya',
  defaultDescription: 'A cooperative on-chain hex exploration game about voyaging into fog, sharing discoveries, and escaping together.',
  defaultImage: '/seo/xenovoya-share-card.svg',
  locale: 'en_US',
  twitterCard: 'summary_large_image',
};

export function getSeoConfig(overrides = {}) {
  return {
    ...DEFAULT_SEO_CONFIG,
    siteName: ENV.VITE_PUBLIC_SITE_NAME || PROCESS_ENV.VITE_PUBLIC_SITE_NAME || DEFAULT_SEO_CONFIG.siteName,
    siteUrl: ENV.VITE_PUBLIC_SITE_URL || PROCESS_ENV.VITE_PUBLIC_SITE_URL || PROCESS_ENV.PUBLIC_SITE_URL || DEFAULT_SEO_CONFIG.siteUrl,
    defaultImage: ENV.VITE_PUBLIC_SHARE_IMAGE || PROCESS_ENV.VITE_PUBLIC_SHARE_IMAGE || DEFAULT_SEO_CONFIG.defaultImage,
    ...overrides,
  };
}

export function isPlaceholderSiteUrl(siteUrl = '') {
  const value = String(siteUrl).toLowerCase();
  return !value
    || value.includes('localhost')
    || value.includes('127.0.0.1')
    || value.includes('0.0.0.0')
    || value.includes('.local')
    || value.includes('example.com');
}
