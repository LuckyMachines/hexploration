#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const reportPath = resolve(root, 'reports', 'ui-density', 'latest.json');

const TARGETS = [
  {
    id: 'expedition-bench',
    file: 'app/src/components/expedition/ExpeditionBench.jsx',
    budgets: { persistentPanels: 22, buttons: 20, details: 8 },
  },
  {
    id: 'action-panel',
    file: 'app/src/components/actions/ActionPanel.jsx',
    budgets: { persistentPanels: 18, buttons: 22, details: 5 },
  },
  {
    id: 'board-presence',
    file: 'app/src/components/board/BoardPresence.jsx',
    budgets: { svgText: 16, overlayComponents: 16 },
  },
];

function count(pattern, text) {
  return [...text.matchAll(pattern)].length;
}

function gradeMetric(value, budget) {
  if (budget === undefined) return 'info';
  if (value <= budget) return 'pass';
  if (value <= Math.ceil(budget * 1.25)) return 'warn';
  return 'fail';
}

function analyzeTarget(target) {
  const absolute = resolve(root, target.file);
  const text = existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
  const metrics = {
    persistentPanels: count(/className="[^"]*(?:border|game-quiet-panel|game-detail-drawer)[^"]*"/g, text),
    buttons: count(/<button\b/g, text),
    details: count(/<details\b/g, text),
    svgText: count(/<text\b/g, text),
    overlayComponents: count(/<([A-Z][A-Za-z]+)\b/g, text),
  };
  const checks = Object.entries(target.budgets).map(([key, budget]) => ({
    key,
    value: metrics[key],
    budget,
    status: gradeMetric(metrics[key], budget),
  }));

  return {
    id: target.id,
    file: target.file,
    metrics,
    checks,
    ok: checks.every((check) => check.status !== 'fail'),
  };
}

const targets = TARGETS.map(analyzeTarget);
const report = {
  generatedAt: new Date().toISOString(),
  ok: targets.every((target) => target.ok),
  targets,
};

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

for (const target of targets) {
  const summary = target.checks
    .map((check) => `${check.key}=${check.value}/${check.budget}:${check.status}`)
    .join(' ');
  console.log(`${target.ok ? 'PASS' : 'FAIL'} ${target.id} ${summary}`);
}
console.log(`Wrote ${reportPath}`);

if (!report.ok && process.argv.includes('--strict')) process.exit(1);
