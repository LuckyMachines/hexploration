#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateReleaseMetadata,
  evaluateSecurityHeaders,
  markdownForReleaseAudit,
  stableObjectHash,
  summarizeReleaseAudit,
  validateRollbackPlan,
} from './release-audit-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const timeoutMs = Number(process.env.XENOVOYA_RELEASE_TIMEOUT_MS || 20_000);
const origins = {
  player: process.env.XENOVOYA_PLAY_URL || 'https://play.xenovoya.com',
  marketing: process.env.XENOVOYA_MARKETING_URL || 'https://xenovoya.com',
  returnApi: process.env.XENOVOYA_RETURN_API_URL || 'https://return-api.xenovoya.com',
  sponsorRelay: process.env.XENOVOYA_SPONSOR_RELAY_URL || '',
};
const expectedRelease = process.env.XENOVOYA_EXPECTED_RELEASE_SHA || '';
const expectedMarketingRelease = process.env.XENOVOYA_EXPECTED_MARKETING_RELEASE_SHA || '';
const reportJsonPath = resolve(root, 'reports', 'release', 'latest-live.json');
const reportMarkdownPath = resolve(root, 'reports', 'release', 'latest-live.md');
const rollbackPath = resolve(root, 'release', 'rollback-plan.json');
const checks = [];
let homepageHtml = '';
let homepageHeaders = {};
let marketingHeaders = {};
let observedRelease = '';
let observedMarketingRelease = '';
let releaseMetadata = {};

function headerObject(headers) {
  return Object.fromEntries([...headers.entries()]);
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: 'follow', ...options, signal: controller.signal });
    const body = await response.text();
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

async function check(id, label, task, { required = true } = {}) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const detail = await task();
    checks.push({ id, label, required, status: 'pass', detail: detail || 'OK', startedAt, durationMs: Date.now() - started });
    process.stdout.write(`PASS ${label}: ${detail || 'OK'}\n`);
  } catch (error) {
    checks.push({ id, label, required, status: 'fail', detail: error.message, startedAt, durationMs: Date.now() - started });
    process.stdout.write(`FAIL ${label}: ${error.message}\n`);
  }
}

function skip(id, label, detail) {
  checks.push({ id, label, required: false, status: 'skipped', detail, startedAt: new Date().toISOString(), durationMs: 0 });
  process.stdout.write(`SKIP ${label}: ${detail}\n`);
}

await check('player.homepage', 'Player homepage', async () => {
  const { response, body } = await request(origins.player);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!body.includes('<!doctype html') && !body.includes('<!DOCTYPE html')) throw new Error('response is not HTML');
  homepageHtml = body;
  homepageHeaders = headerObject(response.headers);
  return `HTTP ${response.status}`;
});

await check('player.bundle', 'Current player bundle', async () => {
  const sources = [...homepageHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
  if (!sources.length) throw new Error('no JavaScript entry bundle found');
  const bundles = await Promise.all(sources.map(async (source) => {
    const { response, body } = await request(new URL(source, origins.player));
    if (!response.ok) throw new Error(`${source} returned HTTP ${response.status}`);
    return body;
  }));
  const joined = bundles.join('\n');
  const lazyAssets = [...new Set([...joined.matchAll(/assets\/[A-Za-z0-9._-]+\.js/g)].map((match) => match[0]))];
  const requiredChunks = ['GuestExpeditionPage', 'LiveClientStack'];
  for (const chunkName of requiredChunks) {
    const asset = lazyAssets.find((path) => path.includes(chunkName));
    if (!asset) throw new Error(`${chunkName} route chunk is absent`);
    const { response, body } = await request(new URL(`/${asset}`, origins.player));
    if (!response.ok || body.length < 1000) throw new Error(`${asset} is unavailable or empty`);
  }
  return `${sources.length} entry bundle(s), ${requiredChunks.length} required route chunk(s)`;
});

await check('player.deep-link', 'Player deep-link fallback', async () => {
  const { response, body } = await request(new URL('/guest', origins.player));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!body.includes('<div id="root"')) throw new Error('SPA root is absent');
  return `HTTP ${response.status}`;
});

await check('player.security', 'Player security headers', async () => {
  const result = evaluateSecurityHeaders(homepageHeaders);
  if (!result.pass) throw new Error(result.failures.join('; '));
  return 'complete header contract';
});

await check('player.release', 'Release metadata', async () => {
  const { response, body } = await request(new URL('/release.json', origins.player));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  let payload;
  try { payload = JSON.parse(body); } catch { throw new Error('invalid JSON'); }
  const result = evaluateReleaseMetadata(payload, expectedRelease);
  if (!result.pass) throw new Error(result.failures.join('; '));
  observedRelease = payload.release;
  releaseMetadata = payload;
  return payload.release;
});

if (expectedRelease) {
  await check('player.release-match', 'Expected release match', async () => {
    if (observedRelease !== expectedRelease) throw new Error(`expected ${expectedRelease}, received ${observedRelease || 'unavailable'}`);
    return expectedRelease;
  });
} else if (strict) {
  await check('player.release-match', 'Expected release match', async () => {
    throw new Error('set XENOVOYA_EXPECTED_RELEASE_SHA to the full player commit during promotion');
  });
} else skip('player.release-match', 'Expected release match', 'set XENOVOYA_EXPECTED_RELEASE_SHA during promotion');

await check('player.robots', 'Robots policy', async () => {
  const { response, body } = await request(new URL('/robots.txt', origins.player));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!body.includes(`Sitemap: ${new URL('/sitemap.xml', origins.player)}`)) throw new Error('canonical sitemap URL is absent');
  return 'canonical sitemap declared';
});

await check('player.sitemap', 'Sitemap', async () => {
  const { response, body } = await request(new URL('/sitemap.xml', origins.player));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!body.includes('<urlset') || !body.includes(new URL('/guest', origins.player).href)) throw new Error('required sitemap routes are absent');
  return 'home and guest routes declared';
});

await check('marketing.homepage', 'Marketing homepage', async () => {
  const { response, body } = await request(origins.marketing);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!body.toLowerCase().includes('xenovoya')) throw new Error('brand identity is absent');
  marketingHeaders = headerObject(response.headers);
  return `HTTP ${response.status}`;
});

await check('marketing.security', 'Marketing security headers', async () => {
  const result = evaluateSecurityHeaders(marketingHeaders);
  if (!result.pass) throw new Error(result.failures.join('; '));
  return 'complete header contract';
});

await check('marketing.release', 'Marketing release metadata', async () => {
  const { response, body } = await request(new URL('/release.json', origins.marketing));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  let payload;
  try { payload = JSON.parse(body); } catch { throw new Error('invalid JSON'); }
  const result = evaluateReleaseMetadata(payload, '', { service: 'xenovoya-site' });
  if (!result.pass) throw new Error(result.failures.join('; '));
  observedMarketingRelease = payload.release;
  return payload.release;
});

if (expectedMarketingRelease) {
  await check('marketing.release-match', 'Expected marketing release match', async () => {
    if (observedMarketingRelease !== expectedMarketingRelease) throw new Error(`expected ${expectedMarketingRelease}, received ${observedMarketingRelease || 'unavailable'}`);
    return expectedMarketingRelease;
  });
} else if (strict) {
  await check('marketing.release-match', 'Expected marketing release match', async () => {
    throw new Error('set XENOVOYA_EXPECTED_MARKETING_RELEASE_SHA to the full marketing commit during promotion');
  });
} else skip('marketing.release-match', 'Expected marketing release match', 'set XENOVOYA_EXPECTED_MARKETING_RELEASE_SHA during promotion');

await check('return-api.readiness', 'Return API readiness', async () => {
  const { response, body } = await request(new URL('/ready', origins.returnApi));
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body.trim().slice(0, 160) || 'empty response'}`);
  if (!body.trim()) throw new Error('empty readiness response');
  return body.trim().slice(0, 160);
});

if (origins.sponsorRelay) {
  await check('game-authority.readiness', 'Game authority readiness', async () => {
    const { response, body } = await request(new URL('/v1/game/status', origins.sponsorRelay));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = JSON.parse(body);
    if (!payload.available || payload.maintenance) throw new Error('game authority is unavailable');
    return 'available';
  });
} else if (releaseMetadata.capabilities?.managedPlay === true) {
  await check('game-authority.readiness', 'Game authority readiness', async () => {
    throw new Error('deployed release enables managed play but XENOVOYA_SPONSOR_RELAY_URL was not supplied');
  });
} else if (releaseMetadata.capabilities?.managedPlay === false) {
  await check('game-authority.readiness', 'Game authority readiness', async () => 'not applicable; deployed release does not enable managed play', { required: false });
} else skip('game-authority.readiness', 'Game authority readiness', 'deployed release predates managed-play metadata; supply XENOVOYA_SPONSOR_RELAY_URL when enabled');

let rollbackPlan = {};
await check('rollback.contract', 'Rollback contract', async () => {
  rollbackPlan = JSON.parse(readFileSync(rollbackPath, 'utf8'));
  const result = validateRollbackPlan(rollbackPlan);
  if (!result.pass) throw new Error(result.failures.join('; '));
  return `${rollbackPlan.platform}/${rollbackPlan.application}`;
});

function gitOutput(commandArgs) {
  return spawnSync('git', commandArgs, { cwd: root, encoding: 'utf8', windowsHide: true });
}

const localHead = gitOutput(['rev-parse', 'HEAD']).stdout.trim();
let checkoutRelationship = 'unknown';
if (observedRelease && localHead) {
  if (observedRelease === localHead) checkoutRelationship = 'matches-deployed';
  else if (gitOutput(['merge-base', '--is-ancestor', observedRelease, localHead]).status === 0) checkoutRelationship = 'local-ahead-of-deployed';
  else if (gitOutput(['merge-base', '--is-ancestor', localHead, observedRelease]).status === 0) checkoutRelationship = 'local-behind-deployed';
  else if (gitOutput(['cat-file', '-e', `${observedRelease}^{commit}`]).status === 0) checkoutRelationship = 'diverged-from-deployed';
  else checkoutRelationship = 'deployed-commit-not-in-local-object-store';
}

const summary = summarizeReleaseAudit(checks);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  environment: 'production',
  origins,
  expectedRelease: expectedRelease || null,
  expectedMarketingRelease: expectedMarketingRelease || null,
  observedRelease: observedRelease || null,
  observedMarketingRelease: observedMarketingRelease || null,
  localHead: localHead || null,
  checkoutRelationship,
  summary,
  checks,
  rollbackPlan: {
    path: 'release/rollback-plan.json',
    sha256: stableObjectHash(rollbackPlan),
  },
};
mkdirSync(dirname(reportJsonPath), { recursive: true });
writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(reportMarkdownPath, markdownForReleaseAudit(report), 'utf8');

process.stdout.write(`\nRelease audit ${summary.grade}: ${summary.passed}/${summary.total} passed, ${summary.failed} failed, ${summary.skipped} skipped.\n`);
process.stdout.write(`Report: ${reportJsonPath}\n`);
if (strict && summary.requiredFailures.length) process.exitCode = 1;
