#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildPublicRouteIndex } from '../app/src/lib/publicRoutes.js';
import { root, writeJson } from './scenario-utils.mjs';

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const noWrite = argv.includes('--no-write');

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeText(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, value);
}

function checkText({ id, label, file, patterns, required = true }) {
  const text = read(file);
  const missing = patterns.filter((pattern) => !pattern.test(text));
  return {
    id,
    label,
    file,
    required,
    ok: missing.length === 0,
    missing: missing.map((pattern) => String(pattern)),
  };
}

function checkAbsentText({ id, label, file, patterns, required = true }) {
  const text = read(file);
  const unexpected = patterns.filter((pattern) => pattern.test(text));
  return {
    id,
    label,
    file,
    required,
    ok: unexpected.length === 0,
    missing: unexpected.map((pattern) => `remove ${String(pattern)}`),
  };
}

function checkFile({ id, label, path, required = true }) {
  return {
    id,
    label,
    file: path,
    required,
    ok: existsSync(resolve(root, path)),
    missing: existsSync(resolve(root, path)) ? [] : [path],
  };
}

function markdownForReport(report) {
  const rows = report.checks.map((check) => `| ${check.id} | ${check.ok ? 'pass' : 'fail'} | ${check.file || 'generated'} |`).join('\n');
  const failures = report.failures.map((failure) => `- ${failure.id}: ${failure.label} (${failure.missing.join(', ')})`).join('\n') || '- None.';
  return `# Marketing Readiness Report

Generated: ${report.generatedAt}

Status: ${report.ok ? 'pass' : 'fail'}
Grade: ${report.grade}

## Checks

| Check | Status | File |
| --- | --- | --- |
${rows}

## Failures

${failures}

## Next Action

${report.nextAction.title}

\`${report.nextAction.command}\`
`;
}

function buildReport() {
  const routes = buildPublicRouteIndex();
  const routeTypes = new Set(routes.map((route) => route.type));
  const checks = [
    checkFile({
      id: 'plan',
      label: 'Marketing improvement plan exists',
      path: 'docs/marketing-site-improvement-plan.md',
    }),
    checkText({
      id: 'player-entry-hierarchy',
      label: 'Player homepage identifies the playable client and asks for one mode choice',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/Choose your expedition/i, /You are in the playable client/i, /function PlayOptions/i],
    }),
    checkAbsentText({
      id: 'distinct-site-role',
      label: 'Player entry does not duplicate the long-form marketing narrative',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/The first turn/i, /Why it feels alive/i, /Featured scenarios/i, /Same-engine simulator/i],
    }),
    checkText({
      id: 'play-mode-funnel',
      label: 'Player entry exposes solo, spectate, and crew modes without a preview detour',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/title="Play solo"/i, /title="Observe live"/i, /title="Join or create"/i, /to="\/guest"/i],
    }),
    checkText({
      id: 'player-safe-copy',
      label: 'Entry copy promises play before connection and avoids wallet-first framing',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/Start solo, observe a live route/i, /connect when you are ready to join a crew/i, /Connect only when you choose a crew action/i],
    }),
    checkText({
      id: 'wallet-context',
      label: 'Wallet language explains when and why a signature is requested',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/wallet signature/i, /Wallet only when needed/i, /Expedition console \/ Sepolia/i],
    }),
    checkText({
      id: 'public-nav',
      label: 'Public navigation prioritizes play and hides internal preview routes',
      file: 'app/src/components/layout/Header.jsx',
      patterns: [/Player navigation/i, /\['\/#play-options', 'Play'\]/i, /\['\/guest', 'Solo'\]/i, /internalToolsEnabled/i],
    }),
    checkText({
      id: 'footer-nav',
      label: 'Footer exposes live-client navigation without preview links',
      file: 'app/src/components/layout/Footer.jsx',
      patterns: [/Live lobby/i, /#live-expedition/i, /internalToolsEnabled/i],
    }),
    checkText({
      id: 'seo-alignment',
      label: 'SEO metadata keeps only public discovery routes',
      file: 'app/src/lib/publicRoutes.js',
      patterns: [/PRIVATE_ROUTE_PATTERNS/i, /Xenovoya Live Client/i, /buildPublicRouteIndex/i],
    }),
    {
      id: 'route-index',
      label: 'Public route model exposes only the player journey and privacy',
      required: true,
      ok: routes.length === 3
        && routes.some((route) => route.path === '/' && route.type === 'home')
        && routes.some((route) => route.path === '/guest' && route.type === 'guest-expedition')
        && routes.some((route) => route.path === '/privacy' && route.type === 'privacy')
        && !routeTypes.has('scenario')
        && !routeTypes.has('topic'),
      missing: routes.length === 3 && routes.some((route) => route.path === '/') && routes.some((route) => route.path === '/guest') && routes.some((route) => route.path === '/privacy')
        ? []
        : ['home, 3D guest expedition, and privacy public route model'],
    },
  ];
  const failures = checks.filter((check) => check.required && !check.ok);
  const warnings = checks.filter((check) => !check.required && !check.ok);
  const score = Math.round(((checks.length - failures.length - warnings.length * 0.5) / checks.length) * 100);
  const grade = score >= 95 ? 'A' : score >= 88 ? 'B+' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D';
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    ok: failures.length === 0,
    score,
    grade,
    checks,
    failures,
    warnings,
    nextAction: failures.length > 0
      ? {
        title: 'Fix failing marketing readiness checks',
        command: 'npm run marketing:doctor',
      }
      : {
        title: 'Keep public discovery artifacts clean of preview routes',
        command: 'npm run marketing:doctor',
      },
  };
}

const report = buildReport();

if (!noWrite) {
  const reportRoot = resolve(root, 'reports', 'marketing');
  const publicRoot = resolve(root, 'app', 'public', 'marketing');
  writeJson(resolve(reportRoot, 'latest-report.json'), report);
  writeText(resolve(reportRoot, 'latest-report.md'), markdownForReport(report));
  writeJson(resolve(publicRoot, 'latest-report.json'), {
    schemaVersion: report.schemaVersion,
    generatedAt: report.generatedAt,
    ok: report.ok,
    score: report.score,
    grade: report.grade,
    nextAction: report.nextAction,
  });
}

console.log(JSON.stringify({
  ok: report.ok,
  generatedAt: report.generatedAt,
  score: report.score,
  grade: report.grade,
  failures: report.failures.map((failure) => failure.id),
  nextAction: report.nextAction,
}, null, 2));

if (strict && !report.ok) process.exit(1);
