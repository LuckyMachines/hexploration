#!/usr/bin/env node
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  compileScenarioArgs,
  evaluateScenarioReport,
  findScenario,
  loadScenarioStore,
  normalizeScenario,
  parseScenarioIntent,
  readJson,
  root,
  runSimulatorForScenario,
  saveScenarioStore,
  scenarioStorePath,
  upsertScenario,
  validateStore,
  writeJson,
} from './scenario-utils.mjs';

const args = process.argv.slice(2);
const command = args[0] || 'list';
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

function positionalText() {
  return rest.filter((value) => !value.startsWith('--')).join(' ').trim();
}

function print(value) {
  if (typeof value === 'string') console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

function requireScenario(store, id) {
  const scenario = findScenario(store, id);
  if (!scenario) throw new Error(`Unknown scenario id: ${id}`);
  return scenario;
}

function listScenarios(store) {
  const rows = (store.scenarios || [])
    .filter((scenario) => scenario.archived !== true || boolArg('all', false))
    .map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      tags: scenario.tags,
      players: scenario.players,
      turns: scenario.turns,
      strategies: scenario.strategies,
      updatedAt: scenario.updatedAt,
      question: scenario.designQuestion,
      archived: Boolean(scenario.archived),
    }));
  print(rows);
}

function createScenario(store) {
  const text = positionalText() || arg('text', '');
  if (!text) throw new Error('Provide plain-English scenario text.');
  const scenario = parseScenarioIntent(text, {
    id: arg('id', undefined),
    name: arg('name', undefined),
    players: arg('players', undefined),
    turns: arg('turns', undefined),
    batch: arg('batch', undefined),
    seed: arg('seed', undefined),
    note: arg('note', undefined),
  });
  const next = upsertScenario(store, scenario);
  saveScenarioStore(next);
  print({
    created: scenario.id,
    scenario,
    command: `npm run scenario:run -- --id=${scenario.id}`,
  });
}

function showScenario(store) {
  const id = arg('id', positionalText());
  const scenario = requireScenario(store, id);
  print({
    scenario,
    simulatorArgs: compileScenarioArgs(scenario),
    command: `npm run sim -- ${compileScenarioArgs(scenario).join(' ')}`,
  });
}

function validateScenarios(store) {
  const result = validateStore(store);
  print(result);
  if (!result.ok) process.exitCode = 1;
}

function duplicateScenario(store) {
  const id = arg('id', null);
  const source = requireScenario(store, id);
  const newId = arg('new-id', `${source.id}-copy`);
  const duplicate = normalizeScenario({
    ...source,
    id: newId,
    name: arg('name', `${source.name} Copy`),
    version: Number(source.version || 1) + 1,
    parentScenarioId: source.id,
    createdFrom: source.id,
    archived: false,
    revisionNotes: arg('notes', 'Duplicated scenario variant.'),
  });
  const next = upsertScenario(store, duplicate);
  saveScenarioStore(next);
  print({ duplicated: duplicate.id, scenario: duplicate });
}

function archiveScenario(store) {
  const id = arg('id', positionalText());
  const next = { ...store, scenarios: [...(store.scenarios || [])] };
  const index = next.scenarios.findIndex((scenario) => scenario.id === id);
  if (index === -1) throw new Error(`Unknown scenario id: ${id}`);
  next.scenarios[index] = { ...next.scenarios[index], archived: true, updatedAt: new Date().toISOString() };
  saveScenarioStore(next);
  print({ archived: id });
}

function runScenario(store) {
  const id = arg('id', positionalText());
  const scenario = requireScenario(store, id);
  const result = runSimulatorForScenario(scenario, {
    scenarioFile: scenarioStorePath,
    quiet: boolArg('quiet', false),
    balance: arg('balance', undefined),
    setupForge: !boolArg('no-setup-forge', false),
    setupMode: arg('setup-mode', 'best-effort'),
  });
  if (result.status !== 0) {
    if (result.error) console.error(result.error.message);
    console.error(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  print({ ran: id, stdout: result.stdout?.trim() });
}

function runPack(store) {
  const id = arg('pack', arg('id', positionalText()));
  const pack = (store.packs || []).find((item) => item.id === id);
  if (!pack) throw new Error(`Unknown pack id: ${id}`);
  const results = [];
  for (const scenarioId of pack.scenarioIds || []) {
    const scenario = findScenario(store, scenarioId);
    if (!scenario) continue;
    const result = runSimulatorForScenario(scenario, { scenarioFile: scenarioStorePath, quiet: true, setupForge: true, setupMode: arg('setup-mode', 'best-effort') });
    results.push({
      scenarioId,
      ok: result.status === 0,
      stdout: result.stdout?.trim(),
      stderr: result.error?.message || result.stderr?.trim(),
    });
    if (result.status !== 0 && !boolArg('continue', false)) break;
  }
  const report = {
    generatedAt: new Date().toISOString(),
    pack: id,
    results,
    passRate: results.length > 0 ? results.filter((result) => result.ok).length / results.length : 0,
    weakestScenario: results.find((result) => !result.ok)?.scenarioId || null,
  };
  writeJson(resolve(root, 'reports', 'simulator', 'scenario-packs', `${id}-latest.json`), report);
  print(report);
}

function importScenarios(store) {
  const file = arg('file', positionalText());
  if (!file) throw new Error('Provide --file=path.');
  const incoming = readJson(resolve(root, file));
  const scenarios = Array.isArray(incoming) ? incoming : incoming.scenarios || [];
  let next = store;
  for (const scenario of scenarios) next = upsertScenario(next, normalizeScenario(scenario));
  saveScenarioStore(next);
  print({ imported: scenarios.length });
}

function exportScenarios(store) {
  const file = arg('file', 'scenario-export.json');
  const ids = String(arg('ids', '')).split(',').map((value) => value.trim()).filter(Boolean);
  const scenarios = ids.length > 0 ? (store.scenarios || []).filter((scenario) => ids.includes(scenario.id)) : store.scenarios || [];
  writeJson(resolve(root, file), { schemaVersion: 1, scenarios });
  print({ exported: scenarios.length, file });
}

function decideScenario(store) {
  const id = arg('id', null);
  const decision = arg('decision', positionalText());
  if (!id || !decision) throw new Error('Provide --id and --decision.');
  const next = { ...store, scenarios: [...(store.scenarios || [])] };
  const index = next.scenarios.findIndex((scenario) => scenario.id === id);
  if (index === -1) throw new Error(`Unknown scenario id: ${id}`);
  next.scenarios[index] = {
    ...next.scenarios[index],
    notes: {
      ...(next.scenarios[index].notes || {}),
      decision,
      playtestNotes: arg('notes', next.scenarios[index].notes?.playtestNotes || ''),
    },
    updatedAt: new Date().toISOString(),
  };
  saveScenarioStore(next);
  print({ updated: id, decision });
}

function evaluateLatest(store) {
  const id = arg('id', positionalText());
  const scenario = requireScenario(store, id);
  const reportPath = resolve(root, 'reports', 'simulator', 'scenarios', id, 'latest-report.json');
  if (!existsSync(reportPath)) throw new Error(`No latest scenario report at ${reportPath}`);
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  print(evaluateScenarioReport(report, scenario));
}

function main() {
  const store = loadScenarioStore();
  if (command === 'create') return createScenario(store);
  if (command === 'list') return listScenarios(store);
  if (command === 'show') return showScenario(store);
  if (command === 'validate') return validateScenarios(store);
  if (command === 'run') return runScenario(store);
  if (command === 'duplicate') return duplicateScenario(store);
  if (command === 'archive') return archiveScenario(store);
  if (command === 'run-pack') return runPack(store);
  if (command === 'import') return importScenarios(store);
  if (command === 'export') return exportScenarios(store);
  if (command === 'decide') return decideScenario(store);
  if (command === 'evaluate') return evaluateLatest(store);
  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(`[scenario] ${error.message || String(error)}`);
  process.exit(1);
}
