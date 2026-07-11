import { describe, expect, test } from 'vitest';
import { buildPublicRouteIndex, noindexRouteForPath, routeForLocation } from './publicRoutes.js';
import { buildCanonicalUrl, buildSeoMeta, validateSeoMeta } from './seoMeta.js';

const config = {
  siteName: 'Xenovoya',
  siteUrl: 'https://play.xenovoya.test/',
  defaultTitle: 'Xenovoya',
  defaultDescription: 'A cooperative on-chain hex exploration game.',
  defaultImage: '/seo/xenovoya-share-card.svg',
  locale: 'en_US',
  twitterCard: 'summary_large_image',
};

describe('seo metadata', () => {
  test('buildCanonicalUrl normalizes site and path slashes', () => {
    expect(buildCanonicalUrl('//game/123///', config)).toBe('https://play.xenovoya.test/game/123');
    expect(buildCanonicalUrl('/', config)).toBe('https://play.xenovoya.test');
  });

  test('public route metadata validates for generated routes', () => {
    const routes = buildPublicRouteIndex({ generatedAt: '2026-05-18T00:00:00.000Z' });
    expect(routes.map((route) => route.path)).toEqual(['/']);
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
    expect(noindexRouteForPath('/simulator')).toBe(true);
    expect(noindexRouteForPath('/play')).toBe(true);
    expect(noindexRouteForPath('/scenarios/solo-artifact-hunt')).toBe(true);
  });

  test('internal play query stays noindex and canonicalizes home', () => {
    const route = routeForLocation({ pathname: '/play', search: '?scenario=solo-artifact-hunt' });
    const meta = buildSeoMeta(route, config);
    expect(route.noindex).toBe(true);
    expect(route.canonicalPath).toBe('/');
    expect(meta.canonicalUrl).toBe('https://play.xenovoya.test');
    expect(meta.robots).toContain('noindex');
  });

  test('public route graph excludes internal tooling and raw scenario ids', () => {
    const serialized = JSON.stringify(buildPublicRouteIndex());
    for (const forbidden of ['simulator', 'same-engine', 'solo-artifact-hunt', '/play?', '/scenarios/']) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
