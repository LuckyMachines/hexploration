import { experiments } from '../config/experiments';
import { trackJourneyEvent } from './analytics';

const ASSIGNMENTS_KEY = 'xenovoya:experiment-assignments:v1';
const SEED_KEY = 'xenovoya:experiment-seed:v1';
const ENV = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function safeRead(storage, key, fallback) {
  try {
    const value = storage?.getItem(key);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function safeWrite(storage, key, value) {
  try { storage?.setItem(key, value); } catch { /* Experiments must never block play. */ }
}

function seedFor(storage) {
  const existing = safeRead(storage, SEED_KEY, '');
  if (existing) return existing;
  const seed = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `seed-${Math.random()}`;
  safeWrite(storage, SEED_KEY, seed);
  return seed;
}

export function validateExperiment(experiment) {
  const errors = [];
  if (!experiment?.id || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(experiment.id)) errors.push('invalid id');
  if (!['planned', 'running', 'paused', 'complete'].includes(experiment?.status)) errors.push('invalid status');
  if (!Array.isArray(experiment?.variants) || experiment.variants.length < 2) errors.push('at least two variants are required');
  if ((experiment?.variants || []).reduce((sum, variant) => sum + Number(variant.weight || 0), 0) !== 100) errors.push('variant weights must total 100');
  if (!Number.isFinite(experiment?.allocationPercent) || experiment.allocationPercent < 0 || experiment.allocationPercent > 100) errors.push('allocationPercent must be 0-100');
  return { ok: errors.length === 0, errors };
}

export function assignExperiment(experiment, { storage = typeof window === 'undefined' ? null : window.localStorage, seed = null, environment = 'production' } = {}) {
  const validation = validateExperiment(experiment);
  const fallback = experiment?.variants?.[0]?.id || 'control';
  if (!validation.ok || experiment.status !== 'running' || !experiment.environments.includes(environment) || experiment.allocationPercent <= 0) return { variant: fallback, enrolled: false, reason: validation.ok ? 'inactive' : validation.errors.join(', ') };
  let assignments = {};
  try { assignments = JSON.parse(safeRead(storage, ASSIGNMENTS_KEY, '{}')) || {}; } catch { assignments = {}; }
  if (assignments[experiment.id]) return { variant: assignments[experiment.id], enrolled: true, reason: 'stored' };
  const identity = seed || seedFor(storage);
  if (hash(`${identity}:${experiment.id}:allocation`) % 100 >= experiment.allocationPercent) return { variant: fallback, enrolled: false, reason: 'holdout' };
  const bucket = hash(`${identity}:${experiment.id}:variant`) % 100;
  let boundary = 0;
  const variant = experiment.variants.find((candidate) => {
    boundary += candidate.weight;
    return bucket < boundary;
  })?.id || fallback;
  assignments[experiment.id] = variant;
  safeWrite(storage, ASSIGNMENTS_KEY, JSON.stringify(assignments));
  return { variant, enrolled: true, reason: 'assigned' };
}

export function getExperimentVariant(id) {
  const experiment = experiments[id];
  if (!experiment) return 'control';
  const environment = String(ENV.VITE_APP_ENV || 'development');
  const assignment = assignExperiment(experiment, { environment });
  if (assignment.enrolled) trackJourneyEvent('experiment_exposure', { experiment_id: id, variant: assignment.variant }, { dedupeKey: `${id}:${assignment.variant}` });
  return assignment.variant;
}
