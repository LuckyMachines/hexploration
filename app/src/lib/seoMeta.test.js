import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicRouteIndex, noindexRouteForPath, routeForLocation } from './publicRoutes.js';
import { buildCanonicalUrl, buildSeoMeta, validateSeoMeta } from './seoMeta.js';

const config = {
  siteName: 'Xenovoya',
  siteUrl: 'https://play.xenovoya.test/',
  defaultTitle: 'Xenovoya',
  defaultDescription: 'A turn-based expedition board game.',
  defaultImage: '/seo/xenovoya-share-card.svg',
  locale: 'en_US',
  twitterCard: 'summary_large_image',
};

test('buildCanonicalUrl normalizes site and path slashes', () => {
  assert.equal(buildCanonicalUrl('//scenarios/solo-artifact-hunt///', config), 'https://play.xenovoya.test/scenarios/solo-artifact-hunt');
  assert.equal(buildCanonicalUrl('/', config), 'https://play.xenovoya.test');
});

test('public route metadata validates for generated routes', () => {
  const routes = buildPublicRouteIndex({ generatedAt: '2026-05-18T00:00:00.000Z' });
  assert.ok(routes.length >= 10);
  for (const route of routes) {
    const meta = buildSeoMeta(route, config);
    const result = validateSeoMeta(meta, { route, config });
    assert.equal(result.ok, true, `${route.path}: ${result.errors.join(', ')}`);
    assert.ok(meta.title.length <= 60);
    assert.ok(meta.description.length <= 160);
  }
});

test('private route patterns are noindex', () => {
  assert.equal(noindexRouteForPath('/game/123'), true);
  assert.equal(noindexRouteForPath('/replay/encoded-run'), true);
  assert.equal(noindexRouteForPath('/scenarios/solo-artifact-hunt'), false);
});

test('play query canonicals point at scenario detail pages', () => {
  const route = routeForLocation({ pathname: '/play', search: '?scenario=solo-artifact-hunt' });
  const meta = buildSeoMeta(route, config);
  assert.equal(route.canonicalPath, '/scenarios/solo-artifact-hunt');
  assert.equal(meta.canonicalUrl, 'https://play.xenovoya.test/scenarios/solo-artifact-hunt');
});

test('scenario pages include game structured data', () => {
  const route = buildPublicRouteIndex().find((item) => item.path === '/scenarios/escape-pressure-4p');
  const meta = buildSeoMeta(route, config);
  assert.ok(meta.jsonLd.some((item) => item['@type'] === 'Game' && item.gameItem === 'Escape Pressure 4P'));
});
