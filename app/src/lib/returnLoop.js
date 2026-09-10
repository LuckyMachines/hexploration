import { ROLE_ROSTER, normalizeRoleId, rolePresentation } from './characters';

export const RETURN_LOOP_KEY = 'xenovoya:return-loop:v2';
export const LEGACY_RETURN_LOOP_KEY = 'xenovoya:return-loop:v1';

export const RETURN_ROLES = Object.freeze(Object.fromEntries(ROLE_ROSTER.map((role) => [
  role.id,
  rolePresentation(role.id),
])));

const lifecycles = new Set(['preparing', 'active', 'waiting-on-crew', 'at-risk', 'extraction-window', 'complete', 'recoverable']);
const now = () => new Date().toISOString();
const text = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;

export function emptyReturnLoop() {
  return { version: 2, player: { callsign: 'Voyager', role: '', characterId: '', records: { expeditions: 0, rescues: 0, relics: 0 } }, crew: [], expedition: null, events: [] };
}

export function normalizeReturnLoop(value = {}) {
  const base = emptyReturnLoop();
  const role = normalizeRoleId(value.player?.role);
  const roleDetail = RETURN_ROLES[role];
  const player = {
    ...base.player,
    ...(value.player || {}),
    role: roleDetail ? role : '',
    characterId: roleDetail?.character.id || '',
    records: { ...base.player.records, ...(value.player?.records || {}) },
  };
  const source = value.expedition;
  const expedition = source?.gameId ? {
    gameId: String(source.gameId), name: text(source.name, `Expedition ${source.gameId}`),
    lifecycle: lifecycles.has(source.lifecycle) ? source.lifecycle : 'active', pressure: Math.max(0, Math.min(100, Number(source.pressure) || 0)),
    clue: text(source.clue, 'A signal remains unresolved beyond the fog.'), lastConsequence: text(source.lastConsequence, 'The crew is ready for the next decision.'),
    nextAction: text(source.nextAction, 'Resume the expedition and read the board.'), nextReason: text(source.nextReason, 'Your contribution keeps the shared route readable.'), updatedAt: source.updatedAt || now(),
    fieldUpdatedAt: source.fieldUpdatedAt && typeof source.fieldUpdatedAt === 'object' ? source.fieldUpdatedAt : {},
  } : null;
  return { ...base, ...value, version: 2, player, crew: Array.isArray(value.crew) ? value.crew.slice(0, 4) : [], expedition, events: Array.isArray(value.events) ? value.events.slice(-50) : [] };
}

export function loadReturnLoop(storage = typeof window === 'undefined' ? null : window.localStorage) {
  if (!storage) return emptyReturnLoop();
  try { return normalizeReturnLoop(JSON.parse(storage.getItem(RETURN_LOOP_KEY) || storage.getItem(LEGACY_RETURN_LOOP_KEY) || '{}')); } catch { return emptyReturnLoop(); }
}

export function saveReturnLoop(value, storage = typeof window === 'undefined' ? null : window.localStorage) {
  const next = normalizeReturnLoop(value);
  if (storage) {
    storage.setItem(RETURN_LOOP_KEY, JSON.stringify(next));
    storage.removeItem(LEGACY_RETURN_LOOP_KEY);
  }
  return next;
}

export function clearReturnLoop(storage = typeof window === 'undefined' ? null : window.localStorage) {
  storage?.removeItem(RETURN_LOOP_KEY);
  storage?.removeItem(LEGACY_RETURN_LOOP_KEY);
  return emptyReturnLoop();
}

export function mergeReturnLoops(localValue, cloudValue) {
  const local = normalizeReturnLoop(localValue);
  const cloud = normalizeReturnLoop(cloudValue);
  const localTime = Date.parse(local.expedition?.updatedAt || 0) || 0;
  const cloudTime = Date.parse(cloud.expedition?.updatedAt || 0) || 0;
  const preferLocal = localTime >= cloudTime;
  const primary = preferLocal ? local : cloud;
  const secondary = preferLocal ? cloud : local;
  const events = [...cloud.events, ...local.events]
    .filter((event, index, all) => index === all.findIndex((candidate) => (candidate.id && event.id ? candidate.id === event.id : candidate.name === event.name && candidate.at === event.at)))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    .slice(-50);
  return normalizeReturnLoop({
    ...secondary,
    ...primary,
    player: {
      callsign: local.player.callsign !== 'Voyager' ? local.player.callsign : cloud.player.callsign,
      role: local.player.role || cloud.player.role,
      records: {
        expeditions: Math.max(local.player.records.expeditions, cloud.player.records.expeditions),
        rescues: Math.max(local.player.records.rescues, cloud.player.records.rescues),
        relics: Math.max(local.player.records.relics, cloud.player.records.relics),
      },
    },
    crew: primary.crew.length ? primary.crew : secondary.crew,
    expedition: mergeExpedition(local.expedition, cloud.expedition),
    events,
  });
}

function mergeExpedition(local, cloud) {
  if (!local) return cloud;
  if (!cloud) return local;
  if (local.gameId !== cloud.gameId) return (Date.parse(local.updatedAt) || 0) >= (Date.parse(cloud.updatedAt) || 0) ? local : cloud;
  const fields = ['name', 'lifecycle', 'pressure', 'clue', 'lastConsequence', 'nextAction', 'nextReason'];
  const merged = { ...cloud, fieldUpdatedAt: { ...(cloud.fieldUpdatedAt || {}), ...(local.fieldUpdatedAt || {}) } };
  for (const field of fields) {
    const localAt = Date.parse(local.fieldUpdatedAt?.[field] || local.updatedAt || 0) || 0;
    const cloudAt = Date.parse(cloud.fieldUpdatedAt?.[field] || cloud.updatedAt || 0) || 0;
    if (localAt >= cloudAt) merged[field] = local[field];
  }
  merged.updatedAt = new Date(Math.max(Date.parse(local.updatedAt) || 0, Date.parse(cloud.updatedAt) || 0)).toISOString();
  return merged;
}

export function recordReturnEvent(state, name, detail = {}) { return normalizeReturnLoop({ ...state, events: [...(state.events || []), { id: crypto.randomUUID(), name, at: now(), ...detail }] }); }
export function selectRole(state, role) {
  const roleId = normalizeRoleId(role);
  if (!RETURN_ROLES[roleId]) return normalizeReturnLoop(state);
  const current = normalizeReturnLoop(state);
  return recordReturnEvent({ ...current, player: { ...current.player, role: roleId, characterId: RETURN_ROLES[roleId].character.id } }, 'role_selected', { role: roleId });
}

export function startReturnableExpedition(state, { gameId, name, crew = [], pressure = 18 } = {}) {
  const current = normalizeReturnLoop(state); const id = text(String(gameId || ''), `local-${Date.now()}`);
  const playerRole = current.player.role || 'scout';
  const playerCharacter = RETURN_ROLES[playerRole].character.id;
  return recordReturnEvent({ ...current, crew: crew.length ? crew : current.crew.length ? current.crew : [{ callsign: current.player.callsign, role: playerRole, characterId: playerCharacter, status: 'ready' }, { callsign: 'Vex', role: 'guard', characterId: RETURN_ROLES.guard.character.id, status: 'waiting' }], expedition: { gameId: id, name: text(name, `Survey ${id}`), lifecycle: 'active', pressure, clue: 'A relic-frequency is still pointing beyond the first ridge.', lastConsequence: 'The crew has charted a possible route home.', nextAction: 'Read the signal and commit the next crew decision.', nextReason: `${RETURN_ROLES[playerRole].label} contribution: ${RETURN_ROLES[playerRole].contribution}.`, updatedAt: now() }, player: { ...current.player, characterId: playerCharacter, records: { ...current.player.records, expeditions: current.player.records.expeditions + 1 } } }, 'expedition_started', { gameId: id });
}

export function updateExpeditionReturn(state, patch = {}) { const current = normalizeReturnLoop(state); if (!current.expedition) return current; const updatedAt = now(); const fieldUpdatedAt = { ...current.expedition.fieldUpdatedAt, ...Object.fromEntries(Object.keys(patch).map((key) => [key, updatedAt])) }; return recordReturnEvent({ ...current, expedition: { ...current.expedition, ...patch, updatedAt, fieldUpdatedAt } }, 'expedition_updated', { lifecycle: patch.lifecycle }); }

export function returnRecommendation(state) {
  const current = normalizeReturnLoop(state); const expedition = current.expedition;
  if (!current.player.role) return { action: 'Choose your expedition role', reason: 'A crew needs a distinct contribution before it can depend on you.', href: '#return-loop' };
  if (!expedition) return { action: 'Create your first expedition thread', reason: `${RETURN_ROLES[current.player.role].label}s ${RETURN_ROLES[current.player.role].contribution}; create a thread now or join a live crew below.`, href: '#return-loop' };
  const isChainExpedition = /^\d+$/.test(expedition.gameId);
  if (!isChainExpedition && expedition.lifecycle === 'waiting-on-crew') return { action: 'Find a live expedition', reason: 'Your starter decision is ready. Join a live crew to make the next consequence authoritative on-chain.', href: '#live-expedition' };
  if (!isChainExpedition && !['complete', 'recoverable'].includes(expedition.lifecycle)) return { action: 'Mark your starter decision ready', reason: expedition.nextReason, href: '#return-loop' };
  if (expedition.lifecycle === 'waiting-on-crew') return { action: 'Make your crew decision', reason: expedition.nextReason, href: `/game/${expedition.gameId}` };
  if (expedition.lifecycle === 'at-risk' || expedition.lifecycle === 'extraction-window') return { action: 'Protect the extraction route', reason: `Pressure is ${expedition.pressure}%. ${expedition.nextReason}`, href: `/game/${expedition.gameId}` };
  if (expedition.lifecycle === 'complete' || expedition.lifecycle === 'recoverable') return { action: 'Follow the unresolved clue', reason: expedition.clue, href: '#live-expedition' };
  return { action: 'Resume expedition', reason: expedition.nextReason, href: `/game/${expedition.gameId}` };
}
