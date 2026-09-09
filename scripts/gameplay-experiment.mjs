#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { comparePairedReports } from './gameplay-experiment-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback = null) => {
  const match = args.find((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!match) return fallback;
  return match.includes('=') ? match.slice(match.indexOf('=') + 1) : true;
};
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const experimentStorePath = resolve(root, 'gameplay.experiments.json');
const experimentId = arg('id', null);
const experimentStore = existsSync(experimentStorePath) ? readJson(experimentStorePath) : { experiments: [] };
const experiment = experimentId ? experimentStore.experiments?.find((item) => item.id === experimentId) : null;
if (experimentId && !experiment) {
  console.error(`Unknown pre-registered experiment: ${experimentId}`);
  process.exit(2);
}
const baselinePath = resolve(root, String(arg('baseline', 'reports/simulator/baseline-report.json')));
const candidatePath = resolve(root, String(arg('candidate', 'reports/simulator/latest-report.json')));
if (!existsSync(baselinePath) || !existsSync(candidatePath)) {
  console.error('Both --baseline and --candidate simulator reports are required.');
  process.exit(2);
}
const report = comparePairedReports(readJson(baselinePath), readJson(candidatePath), {
  minimumReplicates: Number(arg('minimum-replicates', experiment?.minimumReplicates || 10)),
  primaryMetric: arg('primary-metric', experiment?.primaryMetric || null),
  primaryDirection: arg('primary-direction', experiment?.primaryDirection || null),
  minimumEffect: Number(arg('minimum-effect', experiment?.minimumEffect || 0)),
});
report.sources = { baselinePath, candidatePath };
report.experiment = experiment || null;
const outputPath = resolve(root, String(arg('out', 'reports/simulator/experiments/latest-paired-report.json')));
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
if (arg('record', false) && experiment) {
  const index = experimentStore.experiments.findIndex((item) => item.id === experiment.id);
  experimentStore.experiments[index] = {
    ...experiment,
    status: report.decision,
    decision: report.decision,
    resolvedAt: report.generatedAt,
    resultPath: outputPath,
    falsePositive: false,
  };
  writeFileSync(experimentStorePath, `${JSON.stringify(experimentStore, null, 2)}\n`);
}
console.log(JSON.stringify({ outputPath, passed: report.passed, decision: report.decision, primaryMetric: report.primaryMetric, pairs: report.pairs, failures: report.failures }, null, 2));
if (arg('strict', false) && !report.passed) process.exitCode = 1;
