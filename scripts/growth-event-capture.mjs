#!/usr/bin/env node
import { resolve } from 'path';
import {
  captureGrowthEvents,
  localGrowthEventsPath,
} from './growth-event-capture-utils.mjs';
import { readJson, root } from './scenario-utils.mjs';

const argv = process.argv.slice(2);

function arg(name, fallback = null) {
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

function scenarioArcScore(scenarioId) {
  const index = readJson(resolve(root, 'reports', 'simulator', 'feeling-black-box', 'index.json'), null);
  const scenario = (index?.scenarios || []).find((item) => item.scenarioId === scenarioId);
  return scenario?.arcScore ?? 0;
}

function relativePath(path) {
  return path.replace(`${root}\\`, '').replace(`${root}/`, '');
}

try {
  const scenarioId = String(arg('scenario', arg('id', 'escape-pressure-4p')));
  const seed = String(arg('seed', `${scenarioId}-local-public-run`));
  const file = resolve(root, String(arg('file', 'reports/growth/local-events.json')));
  const arcScore = arg('arc-score', scenarioArcScore(scenarioId));
  const result = captureGrowthEvents({
    file,
    scenarioId,
    seed,
    outcome: String(arg('outcome', 'completed')),
    arcScore,
    route: arg('route', null),
    replayRoute: arg('replay-route', null),
  });

  if (boolArg('markdown', false)) {
    const reportEventsPath = result.file === localGrowthEventsPath ? 'reports/growth/local-events.json' : relativePath(result.file);
    console.log(`# Growth Event Capture

Scenario: ${result.scenarioId}

Seed: ${result.seed}

File: ${relativePath(result.file)}

Added events: ${result.added}

Total events: ${result.total}

Next: \`npm run growth:report -- --events=${reportEventsPath} --markdown\`
`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(`[growth:capture] ${error.message || String(error)}`);
  process.exit(1);
}
