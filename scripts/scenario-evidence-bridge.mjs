#!/usr/bin/env node
import { existsSync } from 'fs';
import {
  bridgeDoctor,
  bridgePaths,
  bridgeScenarioPaths,
  buildBridgeReport,
  buildScenarioReadiness,
  loadBridgeEvidence,
  markdownForBridgeReport,
  markdownForScenarioReadiness,
  writeBridgeReport,
} from './scenario-evidence-bridge-utils.mjs';
import { readJson, slugify } from './scenario-utils.mjs';

const argv = process.argv.slice(2);
const commands = new Set(['build', 'latest', 'scenario', 'doctor']);
const command = commands.has(argv[0]) ? argv[0] : argv.length > 0 ? 'scenario' : 'build';
const rest = commands.has(argv[0]) ? argv.slice(1) : argv;

function arg(name, fallback = null) {
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

function scenarioId() {
  const positional = rest.filter((value) => !value.startsWith('--')).join(' ').trim();
  const id = arg('id', arg('scenario', positional));
  if (!id) throw new Error('Provide --id=<scenario-id>.');
  return slugify(id);
}

function print(value, markdown = false) {
  if (markdown) console.log(typeof value === 'string' ? value : markdownForBridgeReport(value));
  else console.log(JSON.stringify(value, null, 2));
}

function buildCommand() {
  const report = buildBridgeReport({ evidence: loadBridgeEvidence() });
  if (!boolArg('no-write', false)) writeBridgeReport(report, { markdown: boolArg('markdown', false) });
  print(report, boolArg('markdown', false));
}

function latestCommand() {
  const paths = bridgePaths();
  if (!existsSync(paths.latest) || boolArg('refresh', false)) {
    buildCommand();
    return;
  }
  const report = readJson(paths.latest);
  print(report, boolArg('markdown', false));
}

function scenarioCommand() {
  const id = scenarioId();
  const evidence = loadBridgeEvidence();
  const scenario = (evidence.scenarioStore?.scenarios || []).find((item) => slugify(item.id) === id);
  if (!scenario) throw new Error(`Unknown scenario id: ${id}`);
  const readiness = buildScenarioReadiness({ scenario, evidence });
  if (!boolArg('no-write', false)) {
    const report = buildBridgeReport({ evidence });
    writeBridgeReport(report, { markdown: boolArg('markdown', false) });
  }
  if (boolArg('markdown', false)) console.log(markdownForScenarioReadiness(readiness));
  else print(readiness);
}

function doctorCommand() {
  const report = existsSync(bridgePaths().latest) && !boolArg('refresh', false)
    ? readJson(bridgePaths().latest)
    : buildBridgeReport({ evidence: loadBridgeEvidence() });
  const doctor = bridgeDoctor({ scenarios: report.scenarios });
  if (boolArg('markdown', false)) {
    console.log(`# Scenario Evidence Bridge Doctor

Featured ready: ${doctor.featuredReadyCount}

Playable: ${doctor.playableCount}

${doctor.findings.map((finding) => `- ${finding.severity}: ${finding.message}${finding.command ? ` - \`${finding.command}\`` : ''}`).join('\n') || '- No findings.'}
`);
  } else {
    print(doctor);
  }
  if (boolArg('gate', false) && !doctor.ok) process.exit(1);
}

try {
  if (command === 'build') buildCommand();
  else if (command === 'latest') latestCommand();
  else if (command === 'scenario') scenarioCommand();
  else if (command === 'doctor') doctorCommand();
} catch (error) {
  console.error(`[bridge] ${error.message || String(error)}`);
  process.exit(1);
}
