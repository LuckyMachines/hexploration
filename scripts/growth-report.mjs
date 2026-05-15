#!/usr/bin/env node
import {
  buildGrowthReport,
  loadGrowthEvidence,
  markdownForGrowthReport,
  writeGrowthReport,
} from './growth-report-utils.mjs';

const argv = process.argv.slice(2);

function arg(name, fallback) {
  const found = argv.find((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!found) return fallback;
  const eq = found.indexOf('=');
  return eq >= 0 ? found.slice(eq + 1) : true;
}

function boolArg(name, fallback = false) {
  const value = arg(name, fallback);
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'no'].includes(String(value).toLowerCase());
}

try {
  const evidence = loadGrowthEvidence({ eventsFile: arg('events', null) });
  const report = buildGrowthReport(evidence);
  if (!boolArg('no-write', false)) writeGrowthReport(report);
  if (boolArg('markdown', false)) console.log(markdownForGrowthReport(report));
  else console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(`[growth] ${error.message || String(error)}`);
  process.exit(1);
}
