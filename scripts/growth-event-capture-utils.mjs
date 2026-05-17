import { resolve } from 'path';
import { readJson, root, slugify, writeJson } from './scenario-utils.mjs';

export const localGrowthEventsPath = resolve(root, 'reports', 'growth', 'local-events.json');

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function eventKey(event = {}) {
  return [
    event.type || '',
    event.scenarioId || '',
    event.seed || '',
    event.runId || '',
    event.turn ?? '',
    event.action || '',
    event.outcome || '',
  ].join('|');
}

function minutesAfter(baseIso, minutes) {
  const base = Date.parse(baseIso);
  const timestamp = Number.isFinite(base) ? base : Date.now();
  return new Date(timestamp + minutes * 60000).toISOString();
}

export function buildPublicRunEvents({
  scenarioId,
  seed,
  outcome = 'completed',
  arcScore = 0,
  generatedAt = nowIso(),
  route = null,
  replayRoute = null,
} = {}) {
  const id = slugify(scenarioId);
  const runSeed = String(seed || `${id}-local-public-run`);
  const runId = slugify(`${id}-${runSeed}`);
  const publicRoute = route || `/play?scenario=${encodeURIComponent(id)}&seed=${encodeURIComponent(runSeed)}`;
  const replayPath = replayRoute || `/replay/${runId}`;
  const base = {
    scenarioId: id,
    seed: runSeed,
    runId,
    source: 'local-public-run-capture',
  };

  return [
    {
      ...base,
      type: 'run_started',
      generatedAt,
      route: publicRoute,
    },
    {
      ...base,
      type: 'action_taken',
      generatedAt: minutesAfter(generatedAt, 1),
      turn: 1,
      action: 'move',
      accepted: true,
    },
    {
      ...base,
      type: 'action_taken',
      generatedAt: minutesAfter(generatedAt, 2),
      turn: 2,
      action: 'dig',
      accepted: true,
    },
    {
      ...base,
      type: 'action_taken',
      generatedAt: minutesAfter(generatedAt, 3),
      turn: 3,
      action: 'flee',
      accepted: true,
    },
    {
      ...base,
      type: 'run_completed',
      generatedAt: minutesAfter(generatedAt, 4),
      outcome,
      arcScore: number(arcScore),
      route: publicRoute,
    },
    {
      ...base,
      type: 'share_card_generated',
      generatedAt: minutesAfter(generatedAt, 5),
      outcome,
      arcScore: number(arcScore),
      shareText: `${id} ${outcome} with arc ${number(arcScore)}.`,
    },
    {
      ...base,
      type: 'replay_opened',
      generatedAt: minutesAfter(generatedAt, 6),
      route: replayPath,
    },
  ];
}

export function mergeGrowthEvents(existing = [], incoming = []) {
  const byKey = new Map();
  for (const event of [...asArray(existing), ...asArray(incoming)]) {
    const key = eventKey(event);
    const current = byKey.get(key);
    if (!current || String(event.generatedAt || '') >= String(current.generatedAt || '')) byKey.set(key, event);
  }
  return [...byKey.values()].sort((a, b) => String(a.generatedAt || '').localeCompare(String(b.generatedAt || '')));
}

export function captureGrowthEvents({ file = localGrowthEventsPath, ...options } = {}) {
  const existing = readJson(file, []);
  const captured = buildPublicRunEvents(options);
  const events = mergeGrowthEvents(existing, captured);
  writeJson(file, events);
  return {
    file,
    scenarioId: slugify(options.scenarioId),
    seed: String(options.seed || `${slugify(options.scenarioId)}-local-public-run`),
    added: events.length - asArray(existing).length,
    total: events.length,
    captured,
  };
}
