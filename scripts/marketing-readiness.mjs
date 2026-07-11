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
      id: 'hero-live-client',
      label: 'Homepage points players to the live client',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/Launch live client/i, /LIVE_PLAY_URL/i, /The public promise is simple/i],
    }),
    checkText({
      id: 'visual-proof',
      label: 'Homepage includes board visual and first-turn explanation',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/HeroBoardScene/i, /You can understand the run after one choice/i, /Read what changed/i],
    }),
    checkText({
      id: 'no-preview-funnel',
      label: 'Homepage avoids routing players into preview scenarios',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/Your first expedition belongs in the live client/i, /Open live client/i],
    }),
    checkText({
      id: 'player-safe-copy',
      label: 'Homepage explains the public player path',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/learn the loop here/i, /actual expedition path/i],
    }),
    checkText({
      id: 'wallet-context',
      label: 'Homepage explains wallet-backed live surveys',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/wallet-signed actions/i, /Live expedition access/i],
    }),
    checkText({
      id: 'public-nav',
      label: 'Header exposes live-client navigation without preview links',
      file: 'app/src/components/layout/Header.jsx',
      patterns: [/Play live/i, /LIVE_PLAY_URL/i, /internalToolsEnabled/i],
    }),
    checkText({
      id: 'footer-nav',
      label: 'Footer exposes live-client navigation without preview links',
      file: 'app/src/components/layout/Footer.jsx',
      patterns: [/Play live/i, /LIVE_PLAY_URL/i, /internalToolsEnabled/i],
    }),
    checkText({
      id: 'seo-alignment',
      label: 'SEO metadata keeps only public discovery routes',
      file: 'app/src/lib/publicRoutes.js',
      patterns: [/PRIVATE_ROUTE_PATTERNS/i, /Xenovoya Live Client/i, /buildPublicRouteIndex/i],
    }),
    {
      id: 'route-index',
      label: 'Public route model excludes preview scenarios and topics',
      required: true,
      ok: routes.length === 1 && routes[0]?.path === '/' && !routeTypes.has('scenario') && !routeTypes.has('topic'),
      missing: routes.length === 1 && routes[0]?.path === '/' ? [] : ['home-only public route model'],
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
