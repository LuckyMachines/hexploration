#!/usr/bin/env node
import { existsSync } from 'fs';
import {
  answerMemoryQuery,
  buildMemory,
  latestMemoryPath,
  markdownForMemory,
  markdownForQuery,
  memoryDoctor,
  memoryForScenario,
  readLatestMemory,
  writeMemory,
} from './playable-design-memory-utils.mjs';

const argv = process.argv.slice(2);
const commands = new Set(['build', 'query', 'latest', 'doctor']);
const command = commands.has(argv[0]) ? argv[0] : argv.length > 0 ? 'query' : 'build';
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

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printMemory(memory) {
  if (boolArg('markdown', false)) console.log(markdownForMemory(memory));
  else printJson(memory);
}

function loadOrBuild({ includeRaw = false, writeFresh = true } = {}) {
  const noBuild = boolArg('no-build', false);
  const latest = existsSync(latestMemoryPath) ? readLatestMemory({ includeRaw }) : null;
  if (latest && (noBuild || !boolArg('refresh', false))) return latest;
  const memory = buildMemory({
    includeRaw,
    staleDays: Number(arg('stale-days', 14)),
  });
  if (writeFresh) writeMemory(memory, { markdown: true });
  return memory;
}

function buildCommand() {
  const memory = buildMemory({
    includeRaw: boolArg('include-raw', false),
    staleDays: Number(arg('stale-days', 14)),
  });
  const paths = writeMemory(memory, { markdown: true });
  if (boolArg('paths', false)) printJson(paths);
  else printMemory(memory);
}

function queryCommand() {
  const query = positional() || String(arg('q', ''));
  if (!query) throw new Error('Provide a memory query string.');
  const memory = loadOrBuild({ includeRaw: true, writeFresh: false });
  const result = answerMemoryQuery(memory, query, { limit: Number(arg('limit', 8)) });
  if (boolArg('markdown', false)) console.log(markdownForQuery(result));
  else printJson(result);
}

function latestCommand() {
  const memory = loadOrBuild({ includeRaw: boolArg('include-raw', false) });
  const scenarioId = arg('scenario', arg('id', null));
  if (scenarioId) {
    const scenario = memoryForScenario(memory, String(scenarioId));
    if (!scenario) throw new Error(`No memory rollup found for scenario ${scenarioId}.`);
    printJson(scenario);
    return;
  }
  printMemory(memory);
}

function doctorCommand() {
  const memory = loadOrBuild({ includeRaw: true, writeFresh: false });
  const report = memoryDoctor(memory, { staleDays: Number(arg('stale-days', 14)) });
  if (boolArg('markdown', false)) {
    console.log(`# Playable Design Memory Doctor

Generated: ${report.generatedAt}

Warnings: ${report.warningCount}

${report.findings.map((finding) => `- ${finding.severity}: ${finding.message}${finding.command ? ` - \`${finding.command}\`` : ''}`).join('\n') || '- No findings.'}
`);
  } else {
    printJson(report);
  }
  if (boolArg('gate', false) && !report.ok) process.exit(1);
}

try {
  if (command === 'build') buildCommand();
  else if (command === 'query') queryCommand();
  else if (command === 'latest') latestCommand();
  else if (command === 'doctor') doctorCommand();
} catch (error) {
  console.error(`[memory] ${error.message || String(error)}`);
  process.exit(1);
}
