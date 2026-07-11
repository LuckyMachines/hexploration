#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPublicRouteIndex } from '../app/src/lib/publicRoutes.js';
import { getSeoConfig, isPlaceholderSiteUrl, SEO_SCHEMA_VERSION } from '../app/src/lib/seoConfig.js';
import { buildCanonicalUrl, buildSeoMeta, validateSeoMeta } from '../app/src/lib/seoMeta.js';
import { root, writeJson } from './scenario-utils.mjs';

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const doctor = argv.includes('--doctor') || argv.includes('--check');
const noWrite = argv.includes('--no-write');

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeText(path, value) {
  ensureDir(resolve(path, '..'));
  writeFileSync(path, value);
}

function xmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function markdownEscape(value = '') {
  return String(value).replace(/\|/g, '\\|');
}

function duplicateValues(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}

function sitemapXml(routes, config) {
  const urls = routes
    .filter((route) => route.discoverable && !route.noindex)
    .map((route) => {
      const loc = buildCanonicalUrl(route.path, config);
      return `  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${xmlEscape(route.lastmod)}</lastmod>
    <changefreq>${xmlEscape(route.changefreq || 'weekly')}</changefreq>
    <priority>${Number(route.priority || 0.5).toFixed(2)}</priority>
  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function robotsTxt(config) {
  const sitemap = buildCanonicalUrl('/sitemap.xml', config);
  return `User-agent: *
Allow: /

Sitemap: ${sitemap}
`;
}

function llmsTxt(routes, config) {
  const featured = routes.filter((route) => ['home'].includes(route.type));
  const scenarios = routes.filter((route) => route.type === 'scenario');
  const topics = routes.filter((route) => route.type === 'topic');
  return `# ${config.siteName}

${config.defaultDescription}

## Core Pages

${featured.map((route) => `- [${route.title}](${buildCanonicalUrl(route.path, config)}): ${route.description}`).join('\n')}
- [Play Xenovoya](https://play.xenovoya.com): Launch the live Xenovoya expedition client.

## Scenario Pages

${scenarios.map((route) => `- [${route.title}](${buildCanonicalUrl(route.path, config)}): ${route.description}`).join('\n') || '- Public scenario pages are not published from this build.'}

## Discovery Topics

${topics.map((route) => `- [${route.title}](${buildCanonicalUrl(route.path, config)}): ${route.description}`).join('\n') || '- Public discovery topic pages are not published from this build.'}
`;
}

function socialPreviewChecks(routes, metas) {
  return routes.map((route) => {
    const meta = metas.get(route.path);
    const missing = [];
    if (!meta.openGraph?.title) missing.push('og:title');
    if (!meta.openGraph?.description) missing.push('og:description');
    if (!meta.openGraph?.image) missing.push('og:image');
    if (!meta.openGraph?.url) missing.push('og:url');
    if (!meta.twitter?.card) missing.push('twitter:card');
    return {
      path: route.path,
      title: meta.openGraph?.title,
      url: meta.openGraph?.url,
      image: meta.openGraph?.image,
      ok: missing.length === 0,
      missing,
    };
  });
}

function nextActionsFor(report) {
  const actions = [];
  if (report.failures.length > 0) {
    actions.push({
      priority: 'critical',
      title: 'Fix SEO validation failures',
      reason: `${report.failures.length} route or artifact checks are failing.`,
      command: 'npm run seo:doctor',
    });
  }
  if (report.warnings.length > 0) {
    actions.push({
      priority: 'high',
      title: 'Tighten weak metadata warnings',
      reason: `${report.warnings.length} route checks produced warnings.`,
      command: 'npm run seo:generate',
    });
  }
  if (actions.length === 0) {
    actions.push({
      priority: 'ready',
      title: 'Keep discovery artifacts fresh',
      reason: 'The public route graph, sitemap, social previews, and metadata exclude internal preview routes.',
      command: 'npm run growth:seo',
    });
  }
  return actions;
}

function markdownReport(report) {
  const routeRows = report.routeSummaries
    .map((route) => `| ${markdownEscape(route.path)} | ${route.type} | ${route.ok ? 'pass' : 'fail'} | ${route.warnings} |`)
    .join('\n');
  const actions = report.nextActions.map((action) => `- ${action.priority}: ${action.title} - ${action.reason} (\`${action.command}\`)`).join('\n');
  return `# SEO Growth Discovery Report

Generated: ${report.generatedAt}

Status: ${report.ok ? 'pass' : 'fail'}

## Routes

- Total: ${report.routes.total}
- Public: ${report.routes.public}
- Scenario: ${report.routes.byType.scenario || 0}
- Topic: ${report.routes.byType.topic || 0}

| Path | Type | Status | Warnings |
| --- | --- | --- | --- |
${routeRows}

## Failures

${report.failures.map((failure) => `- ${failure}`).join('\n') || '- None.'}

## Warnings

${report.warnings.map((warning) => `- ${warning}`).join('\n') || '- None.'}

## Next Actions

${actions}
`;
}

function buildReport({ generatedAt = new Date().toISOString(), config = getSeoConfig() } = {}) {
  const routes = buildPublicRouteIndex({ generatedAt });
  const metas = new Map(routes.map((route) => [route.path, buildSeoMeta(route, config)]));
  const failures = [];
  const warnings = [];
  const routeSummaries = routes.map((route) => {
    const meta = metas.get(route.path);
    const result = validateSeoMeta(meta, { route, config, strict });
    for (const error of result.errors) failures.push(`${route.path}: ${error}`);
    for (const warning of result.warnings) warnings.push(`${route.path}: ${warning}`);
    return {
      path: route.path,
      type: route.type,
      ok: result.ok,
      errors: result.errors.length,
      warnings: result.warnings.length,
      title: meta.title,
      description: meta.description,
      canonicalUrl: meta.canonicalUrl,
    };
  });
  const duplicatePaths = duplicateValues(routes, (route) => route.path);
  const duplicateCanonicals = duplicateValues([...metas.values()], (meta) => meta.canonicalUrl);
  const duplicateTitles = duplicateValues([...metas.values()], (meta) => meta.title);
  for (const path of duplicatePaths) failures.push(`Duplicate route path: ${path}`);
  for (const canonical of duplicateCanonicals) failures.push(`Duplicate canonical URL: ${canonical}`);
  for (const title of duplicateTitles) warnings.push(`Duplicate title: ${title}`);
  if (strict && isPlaceholderSiteUrl(config.siteUrl)) failures.push('Strict mode requires VITE_PUBLIC_SITE_URL or PUBLIC_SITE_URL to be a production URL.');

  const byType = routes.reduce((counts, route) => {
    counts[route.type] = (counts[route.type] || 0) + 1;
    return counts;
  }, {});
  const socialPreview = socialPreviewChecks(routes, metas);
  for (const preview of socialPreview.filter((item) => !item.ok)) {
    failures.push(`${preview.path}: missing social preview fields ${preview.missing.join(', ')}`);
  }

  const report = {
    schemaVersion: SEO_SCHEMA_VERSION,
    generatedAt,
    ok: failures.length === 0,
    strict,
    site: {
      name: config.siteName,
      url: config.siteUrl,
      canonicalHome: buildCanonicalUrl('/', config),
    },
    routes: {
      total: routes.length,
      public: routes.filter((route) => route.discoverable && !route.noindex).length,
      byType,
    },
    routeSummaries,
    socialPreview,
    failures,
    warnings,
  };
  report.nextActions = nextActionsFor(report);
  return { report, routes, metas };
}

function writeArtifacts({ report, routes, metas, config }) {
  const publicRoot = resolve(root, 'app', 'public');
  const publicSeoRoot = resolve(publicRoot, 'seo');
  const reportRoot = resolve(root, 'reports', 'seo');
  ensureDir(publicSeoRoot);
  ensureDir(reportRoot);

  writeText(resolve(publicRoot, 'sitemap.xml'), sitemapXml(routes, config));
  writeText(resolve(publicRoot, 'robots.txt'), robotsTxt(config));
  writeText(resolve(publicRoot, 'llms.txt'), llmsTxt(routes, config));
  writeJson(resolve(publicSeoRoot, 'route-index.json'), routes);
  writeJson(resolve(publicSeoRoot, 'metadata-index.json'), Object.fromEntries(metas.entries()));
  writeJson(resolve(publicSeoRoot, 'latest-summary.json'), {
    schemaVersion: SEO_SCHEMA_VERSION,
    generatedAt: report.generatedAt,
    status: report.ok ? 'pass' : 'fail',
    routes: report.routes,
    nextActions: report.nextActions,
  });
  writeText(resolve(publicSeoRoot, 'latest-summary.md'), markdownReport(report));
  writeJson(resolve(publicSeoRoot, 'latest-report.json'), report);
  writeJson(resolve(publicSeoRoot, 'social-preview-checks.json'), report.socialPreview);
  writeJson(resolve(publicSeoRoot, 'next-actions.json'), report.nextActions);
  writeJson(resolve(reportRoot, 'latest-report.json'), report);
  writeText(resolve(reportRoot, 'latest-report.md'), markdownReport(report));
}

const config = getSeoConfig();
const built = buildReport({ config });

if (!noWrite) writeArtifacts({ ...built, config });

const summary = {
  ok: built.report.ok,
  generatedAt: built.report.generatedAt,
  routes: built.report.routes,
  failures: built.report.failures,
  warnings: built.report.warnings,
  nextActions: built.report.nextActions,
};

console.log(JSON.stringify(summary, null, 2));

if ((doctor || strict) && !built.report.ok) {
  process.exit(1);
}
