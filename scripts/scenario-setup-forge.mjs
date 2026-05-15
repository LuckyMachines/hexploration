#!/usr/bin/env node
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  SETUP_SUPPORT_MATRIX,
  loadScenarioForSetup,
  markdownForSetupReport,
  normalizeSetupForge,
  parseSetupForgeIntent,
  setupBacklog,
  setupDoctor,
  setupReportPaths,
  validateSetupForge,
  writeSetupReport,
} from './setup-forge-utils.mjs';
import {
  loadScenarioStore,
  readJson,
  root,
  saveScenarioStore,
  upsertScenario,
  writeJson,
} from './scenario-utils.mjs';

const args = process.argv.slice(2);
const command = args[0] || 'validate';
const rest = args.slice(1);

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

function print(value) {
  if (boolArg('markdown', false)) console.log(markdownForSetupReport(value));
  else if (typeof value === 'string') console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

function scenarioFromArgs(required = true) {
  const id = arg('id', positional());
  if (!id && !required) return null;
  if (!id) throw new Error('Provide --id=<scenario-id>.');
  return loadScenarioForSetup(id);
}

function validateCommand() {
  const scenario = scenarioFromArgs();
  const mode = String(arg('mode', 'best-effort'));
  const setupForge = normalizeSetupForge(scenario.setupForge || {}, scenario);
  const report = {
    generatedAt: new Date().toISOString(),
    scenarioId: scenario.id,
    mode,
    setupForge,
    validation: validateSetupForge(setupForge, scenario, mode),
  };
  print(report);
  if (boolArg('gate', false) && !report.validation.ok) process.exit(1);
}

function forgeCommand() {
  const scenario = scenarioFromArgs();
  const mode = String(arg('mode', arg('setup-mode', 'best-effort')));
  const dryRun = boolArg('dry-run', true);
  const setupForge = normalizeSetupForge(scenario.setupForge || {}, scenario);
  const validation = validateSetupForge(setupForge, scenario, mode);
  const setupApplication = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    setupId: setupForge.setupId,
    mode,
    requiredSetupLevel: setupForge.requiredSetupLevel,
    support: validation.support,
    applied: [],
    skipped: validation.support.map((field) => ({
      field: field.key,
      status: 'skipped',
      reason: dryRun ? 'dry-run CLI validation only; simulator applies live setup' : 'no RPC adapter in standalone CLI',
      label: field.label,
    })),
    failed: [],
    warnings: validation.warnings,
    errors: validation.errors,
    dryRun,
    coverage: setupForge.coverage,
  };
  const report = {
    generatedAt: new Date().toISOString(),
    scenarioId: scenario.id,
    setupForge,
    setupApplication,
    setupLevel: setupApplication.applied.length > 0 ? 'partial' : 'metadata',
  };
  const paths = writeSetupReport(report, scenario.id);
  report.paths = paths;
  print(report);
  if (mode === 'strict' && !validation.ok) process.exit(1);
}

function doctorCommand() {
  const report = setupDoctor();
  print(report);
  if (boolArg('gate', false) && report.strictBlockers.length > 0) process.exit(1);
}

function matrixCommand() {
  print({
    generatedAt: new Date().toISOString(),
    support: SETUP_SUPPORT_MATRIX,
  });
}

function explainCommand() {
  const scenario = scenarioFromArgs();
  const mode = String(arg('mode', 'best-effort'));
  const setupForge = normalizeSetupForge(scenario.setupForge || {}, scenario);
  const validation = validateSetupForge(setupForge, scenario, mode);
  const exact = validation.support.filter((field) => field.exact).map((field) => field.label);
  const partial = validation.support.filter((field) => !field.exact && !['contractBlocked', 'notYetSupported'].includes(field.status)).map((field) => field.label);
  const blocked = validation.support.filter((field) => ['contractBlocked', 'notYetSupported'].includes(field.status)).map((field) => `${field.label}: ${field.hook}`);
  print({
    generatedAt: new Date().toISOString(),
    scenarioId: scenario.id,
    mode,
    exact,
    partial,
    blocked,
    warnings: validation.warnings,
    coverage: validation.coverage,
  });
}

function authorCommand() {
  const text = positional() || String(arg('text', ''));
  if (!text) throw new Error('Provide setup text.');
  const id = arg('id', null);
  const scenario = id ? loadScenarioForSetup(id) : { id: 'authored-setup', players: 1, initialState: { assumptions: [] } };
  const setupForge = parseSetupForgeIntent(text, scenario);
  if (boolArg('save', false)) {
    const store = loadScenarioStore();
    const nextScenario = { ...scenario, setupForge };
    saveScenarioStore(upsertScenario(store, nextScenario));
  }
  print({ scenarioId: scenario.id, setupForge });
}

function variantCommand() {
  const scenario = scenarioFromArgs();
  const kind = String(arg('kind', 'easier'));
  const setupForge = normalizeSetupForge(scenario.setupForge || {}, scenario);
  const variant = JSON.parse(JSON.stringify(setupForge));
  if (kind === 'harder') {
    for (const player of variant.players || []) {
      if (player.stats) {
        player.stats.movement = Math.max(0, player.stats.movement - 1);
        player.stats.agility = Math.max(0, player.stats.agility - 1);
      }
    }
    variant.scriptedPrelude.turns += 1;
    variant.pressure.escapePressure = true;
  } else {
    for (const player of variant.players || []) {
      if (player.stats) {
        player.stats.movement = Math.min(4, player.stats.movement + 1);
        player.stats.agility = Math.min(4, player.stats.agility + 1);
      }
    }
    variant.scriptedPrelude.turns = Math.max(0, variant.scriptedPrelude.turns - 1);
  }
  variant.setupId = undefined;
  print({ scenarioId: scenario.id, kind, setupForge: normalizeSetupForge(variant, scenario) });
}

function backlogCommand() {
  print({
    generatedAt: new Date().toISOString(),
    backlog: setupBacklog(),
  });
}

function exportCommand() {
  const scenario = scenarioFromArgs();
  const file = String(arg('file', `${scenario.id}-setup-forge.json`));
  writeJson(resolve(root, file), normalizeSetupForge(scenario.setupForge || {}, scenario));
  print({ exported: scenario.id, file });
}

function importCommand() {
  const id = arg('id', null);
  const file = String(arg('file', positional()));
  if (!file) throw new Error('Provide --file=<path>.');
  const setupForge = readJson(resolve(root, file));
  const scenario = id ? loadScenarioForSetup(id) : null;
  if (!scenario) {
    print({ setupForge });
    return;
  }
  const store = loadScenarioStore();
  saveScenarioStore(upsertScenario(store, { ...scenario, setupForge: normalizeSetupForge(setupForge, scenario) }));
  print({ imported: file, scenarioId: scenario.id });
}

try {
  if (command === 'validate') validateCommand();
  else if (command === 'forge') forgeCommand();
  else if (command === 'doctor') doctorCommand();
  else if (command === 'matrix') matrixCommand();
  else if (command === 'explain') explainCommand();
  else if (command === 'author') authorCommand();
  else if (command === 'variant') variantCommand();
  else if (command === 'backlog') backlogCommand();
  else if (command === 'export') exportCommand();
  else if (command === 'import') importCommand();
  else throw new Error(`Unknown setup command: ${command}`);
} catch (error) {
  console.error(`[setup-forge] ${error.message || String(error)}`);
  process.exit(1);
}
