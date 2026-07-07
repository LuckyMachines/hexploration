import { describe, expect, test } from 'vitest';
import { buildPublicRouteIndex, noindexRouteForPath, routeForLocation } from './publicRoutes.js';
import { buildCanonicalUrl, buildSeoMeta, validateSeoMeta } from './seoMeta.js';

const config = {
  siteName: 'Xenovoya',
  siteUrl: 'https://play.xenovoya.test/',
  defaultTitle: 'Xenovoya',
  defaultDescription: 'A Chart & Depart expedition game.',
  defaultImage: '/seo/xenovoya-share-card.svg',
  locale: 'en_US',
  twitterCard: 'summary_large_image',
};

describe('seo metadata', () => {
  test('buildCanonicalUrl normalizes site and path slashes', () => {
    expect(buildCanonicalUrl('//scenarios/solo-artifact-hunt///', config)).toBe('https://play.xenovoya.test/scenarios/solo-artifact-hunt');
    expect(buildCanonicalUrl('/', config)).toBe('https://play.xenovoya.test');
  });

  test('public route metadata validates for generated routes', () => {
    const routes = buildPublicRouteIndex({ generatedAt: '2026-05-18T00:00:00.000Z' });
    expect(routes.length).toBeGreaterThanOrEqual(10);
    for (const route of routes) {
      const meta = buildSeoMeta(route, config);
      const result = validateSeoMeta(meta, { route, config });
      expect(result.ok, `${route.path}: ${result.errors.join(', ')}`).toBe(true);
      expect(meta.title.length).toBeLessThanOrEqual(60);
      expect(meta.description.length).toBeLessThanOrEqual(160);
    }
  });

  test('private route patterns are noindex', () => {
    expect(noindexRouteForPath('/game/123')).toBe(true);
    expect(noindexRouteForPath('/replay/encoded-run')).toBe(true);
    expect(noindexRouteForPath('/scenarios/solo-artifact-hunt')).toBe(false);
  });

  test('play query canonicals point at scenario detail pages', () => {
    const route = routeForLocation({ pathname: '/play', search: '?scenario=solo-artifact-hunt' });
    const meta = buildSeoMeta(route, config);
    expect(route.canonicalPath).toBe('/scenarios/solo-artifact-hunt');
    expect(meta.canonicalUrl).toBe('https://play.xenovoya.test/scenarios/solo-artifact-hunt');
  });

  test('scenario pages include game structured data', () => {
    const route = buildPublicRouteIndex().find((item) => item.path === '/scenarios/escape-pressure-4p');
    const meta = buildSeoMeta(route, config);
    expect(meta.jsonLd.some((item) => item['@type'] === 'Game' && item.gameItem === 'Escape Pressure 4P')).toBe(true);
  });
});
