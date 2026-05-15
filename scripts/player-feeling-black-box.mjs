#!/usr/bin/env node
import {
  buildFeelingIndex,
  buildFeelingReport,
  feelingDoctor,
  loadFeelingSourceReport,
  markdownForFeelingReport,
  writeFeelingIndex,
  writeFeelingReport,
} from './player-feeling-black-box-utils.mjs';
import { slugify } from './scenario-utils.mjs';

const argv = process.argv.slice(2);
const commands = new Set(['latest', 'scenario', 'index', 'doctor']);
const command = commands.has(argv[0]) ? argv[0] : argv.length > 0 ? 'latest' : 'latest';
const rest = commands.has(argv[0]) ? argv.slice(1) : argv;

function arg(name, fallback) {
  const found = rest.find((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!found) return fallback;
  const eq = found.indexOf('=');
  return eq >= 0 ? found.slice(eq + 1) : true;
}

function boolArg(name, fallback = false) {
  const value = arg(name, fallback);
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'no'].includes(String(value).toLowerCase());
}

function positional() {
  return rest.filter((value) => !value.startsWith('--')).join(' ').trim();
}

function scenarioId() {
  const id = arg('id', arg('scenario', positional()));
  if (!id) throw new Error('Provide --id=<scenario-id>.');
  return slugify(String(id));
}

function print(value, markdown = false) {
  if (markdown) console.log(markdownForFeelingReport(value));
  else console.log(JSON.stringify(value, null, 2));
}

function buildFromSource({ scenario = null } = {}) {
  const loaded = loadFeelingSourceReport({
    file: arg('file', null),
    scenarioId: scenario,
  });
  if (!loaded.report) throw new Error('No simulator report found to analyze.');
  return buildFeelingReport(loaded.report, { sourcePath: loaded.sourcePath });
}

function latestCommand() {
  const report = buildFromSource();
  if (!boolArg('no-write', false)) {
    writeFeelingReport(report);
    writeFeelingIndex(buildFeelingIndex());
  }
  print(report, boolArg('markdown', false));
}

function scenarioCommand() {
  const report = buildFromSource({ scenario: scenarioId() });
  if (!boolArg('no-write', false)) {
    writeFeelingReport(report);
    writeFeelingIndex(buildFeelingIndex());
  }
  print(report, boolArg('markdown', false));
}

function indexCommand() {
  const index = buildFeelingIndex();
  if (!boolArg('no-write', false)) writeFeelingIndex(index);
  console.log(JSON.stringify(index, null, 2));
}

function doctorCommand() {
  const report = feelingDoctor({
    scenarioId: arg('id', arg('scenario', null)),
    file: arg('file', null),
    staleDays: Number(arg('stale-days', 14)),
  });
  if (boolArg('markdown', false)) {
    console.log(`# Player Feeling Black Box Doctor

Generated: ${report.generatedAt}

Warnings: ${report.warningCount}

${report.findings.map((finding) => `- ${finding.severity}: ${finding.message}${finding.command ? ` - \`${finding.command}\`` : ''}`).join('\n') || '- No findings.'}
`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

try {
  if (command === 'latest') latestCommand();
  else if (command === 'scenario') scenarioCommand();
  else if (command === 'index') indexCommand();
  else if (command === 'doctor') doctorCommand();
} catch (error) {
  console.error(`[feel] ${error.message || String(error)}`);
  process.exit(1);
}
