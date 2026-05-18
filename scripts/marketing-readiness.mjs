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
      id: 'hero-copy',
      label: 'Homepage states product category and living-board promise',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/Turn-based expedition board game/i, /feel alive/i, /Play a scenario/i, /Browse scenarios/i],
    }),
    checkText({
      id: 'visual-proof',
      label: 'Homepage includes board visual and one-turn proof',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/MiniBoard/i, /One turn proof/i, /Before input/i, /After dig/i],
    }),
    checkText({
      id: 'scenario-funnel',
      label: 'Homepage links to scenario play and detail paths',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/featured playable scenarios/i, /scenario\.playPath/i, /scenario\.canonicalPath/i],
    }),
    checkText({
      id: 'discovery-topics',
      label: 'Homepage exposes discovery topics',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/DISCOVERY_TOPICS/i, /Find a run by feeling/i, /\/topics\//i],
    }),
    checkText({
      id: 'wallet-context',
      label: 'Homepage explains public play before wallet-backed live surveys',
      file: 'app/src/pages/HomePage.jsx',
      patterns: [/Public scenarios/i, /wallet-signed actions/i, /Live game access/i],
    }),
    checkText({
      id: 'public-nav',
      label: 'Header exposes marketing navigation before wallet chrome',
      file: 'app/src/components/layout/Header.jsx',
      patterns: [/Scenarios/i, /Challenge/i, /Devlog/i, /Simulator/i, /isConnected && <NetworkBadge/i],
    }),
    checkText({
      id: 'footer-nav',
      label: 'Footer has public discovery links',
      file: 'app/src/components/layout/Footer.jsx',
      patterns: [/Public discovery mode/i, /Scenarios/i, /Simulator/i, /Devlog/i],
    }),
    checkText({
      id: 'seo-alignment',
      label: 'SEO metadata includes the same homepage positioning',
      file: 'app/src/lib/publicRoutes.js',
      patterns: [/turn-based expedition board game/i, /living board-state decisions/i],
    }),
    {
      id: 'route-index',
      label: 'Public route model includes scenarios and topics',
      required: true,
      ok: routeTypes.has('scenario') && routeTypes.has('topic') && routes.length >= 16,
      missing: routeTypes.has('scenario') && routeTypes.has('topic') ? [] : ['scenario/topic route types'],
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
        title: 'Keep homepage proof fresh with latest scenarios and generated SEO artifacts',
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
