#!/usr/bin/env node
import { existsSync } from 'fs';
import {
  buildScenarioTimeMachine,
  buildTimeMachineIndex,
  compareScenarioTimeMachine,
  loadTimeMachineMemory,
  markdownForTimeMachine,
  timeMachineDoctor,
  timeMachineReportPaths,
  writeScenarioTimeMachine,
  writeTimeMachineIndex,
} from './scenario-time-machine-utils.mjs';
import { readJson } from './scenario-utils.mjs';

const argv = process.argv.slice(2);
const commands = new Set(['build', 'scenario', 'compare', 'latest', 'doctor']);
const command = commands.has(argv[0]) ? argv[0] : argv.length > 0 ? 'scenario' : 'build';
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
  return String(id);
}

function print(value, markdown = false) {
  if (markdown) console.log(typeof value === 'string' ? value : markdownForTimeMachine(value));
  else console.log(JSON.stringify(value, null, 2));
}

function memory() {
  return loadTimeMachineMemory({ refreshMemory: boolArg('refresh-memory', false), includeRaw: true });
}

function buildCommand() {
  const loadedMemory = memory();
  const index = buildTimeMachineIndex({ memory: loadedMemory });
  writeTimeMachineIndex(index);
  for (const scenario of index.scenarios) {
    const report = buildScenarioTimeMachine({ scenarioId: scenario.scenarioId, memory: loadedMemory, includeRaw: boolArg('include-raw', false) });
    writeScenarioTimeMachine(report);
  }
  print(index, boolArg('markdown', false));
}

function scenarioCommand() {
  const report = buildScenarioTimeMachine({
    scenarioId: scenarioId(),
    memory: memory(),
    includeRaw: boolArg('include-raw', false),
  });
  writeScenarioTimeMachine(report);
  writeTimeMachineIndex(buildTimeMachineIndex({ memory: memory() }));
  print(report, boolArg('markdown', false));
}

function compareCommand() {
  const comparison = compareScenarioTimeMachine({
    scenarioId: scenarioId(),
    against: String(arg('against', 'previous')),
    memory: memory(),
  });
  if (boolArg('markdown', false)) {
    console.log(`# Scenario Time Machine Compare

Scenario: ${comparison.scenarioId}

Against: ${comparison.against}

Trend: ${comparison.trend}

${comparison.comparison?.summary || 'No comparison available.'}

Recommendation: ${comparison.recommendation?.title || 'none'}

\`${comparison.recommendation?.command || 'npm run time-machine:doctor'}\`
`);
  } else {
    print(comparison);
  }
}

function latestCommand() {
  const id = scenarioId();
  const paths = timeMachineReportPaths(id);
  if (!existsSync(paths.latest) || boolArg('refresh', false)) {
    const report = buildScenarioTimeMachine({ scenarioId: id, memory: memory(), includeRaw: boolArg('include-raw', false) });
    writeScenarioTimeMachine(report);
    print(report, boolArg('markdown', false));
    return;
  }
  const report = readJson(paths.latest);
  print(report, boolArg('markdown', false));
}

function doctorCommand() {
  const report = timeMachineDoctor({ memory: memory(), staleDays: Number(arg('stale-days', 14)) });
  if (boolArg('markdown', false)) {
    console.log(`# Scenario Time Machine Doctor

Generated: ${report.generatedAt}

Warnings: ${report.warningCount}

${report.findings.map((finding) => `- ${finding.severity}: ${finding.message}${finding.command ? ` - \`${finding.command}\`` : ''}`).join('\n') || '- No findings.'}
`);
  } else {
    print(report);
  }
  if (boolArg('gate', false) && !report.ok) process.exit(1);
}

try {
  if (command === 'build') buildCommand();
  else if (command === 'scenario') scenarioCommand();
  else if (command === 'compare') compareCommand();
  else if (command === 'latest') latestCommand();
  else if (command === 'doctor') doctorCommand();
} catch (error) {
  console.error(`[time-machine] ${error.message || String(error)}`);
  process.exit(1);
}
