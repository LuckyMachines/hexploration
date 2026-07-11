export const RETURN_LOOP_KEY = 'xenovoya:return-loop:v1';

export const RETURN_ROLES = {
  scout: { label: 'Scout', contribution: 'reveals safe routes and reads signals' },
  warden: { label: 'Warden', contribution: 'stabilizes crossings and protects the crew' },
  salvager: { label: 'Salvager', contribution: 'recovers relics and interprets wrecks' },
};

const lifecycles = new Set(['preparing', 'active', 'waiting-on-crew', 'at-risk', 'extraction-window', 'complete', 'recoverable']);
const now = () => new Date().toISOString();
const text = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;

export function emptyReturnLoop() {
  return { version: 1, player: { callsign: 'Voyager', role: '', records: { expeditions: 0, rescues: 0, relics: 0 } }, crew: [], expedition: null, events: [] };
}

export function normalizeReturnLoop(value = {}) {
  const base = emptyReturnLoop();
  const player = { ...base.player, ...(value.player || {}), records: { ...base.player.records, ...(value.player?.records || {}) } };
  const source = value.expedition;
  const expedition = source?.gameId ? {
    gameId: String(source.gameId), name: text(source.name, `Expedition ${source.gameId}`),
    lifecycle: lifecycles.has(source.lifecycle) ? source.lifecycle : 'active', pressure: Math.max(0, Math.min(100, Number(source.pressure) || 0)),
    clue: text(source.clue, 'A signal remains unresolved beyond the fog.'), lastConsequence: text(source.lastConsequence, 'The crew is ready for the next decision.'),
    nextAction: text(source.nextAction, 'Resume the expedition and read the board.'), nextReason: text(source.nextReason, 'Your contribution keeps the shared route readable.'), updatedAt: source.updatedAt || now(),
  } : null;
  return { ...base, ...value, player, crew: Array.isArray(value.crew) ? value.crew.slice(0, 4) : [], expedition, events: Array.isArray(value.events) ? value.events.slice(-50) : [] };
}

export function loadReturnLoop(storage = typeof window === 'undefined' ? null : window.localStorage) {
  if (!storage) return emptyReturnLoop();
  try { return normalizeReturnLoop(JSON.parse(storage.getItem(RETURN_LOOP_KEY) || '{}')); } catch { return emptyReturnLoop(); }
}

export function saveReturnLoop(value, storage = typeof window === 'undefined' ? null : window.localStorage) {
  const next = normalizeReturnLoop(value); if (storage) storage.setItem(RETURN_LOOP_KEY, JSON.stringify(next)); return next;
}

export function recordReturnEvent(state, name, detail = {}) { return normalizeReturnLoop({ ...state, events: [...(state.events || []), { name, at: now(), ...detail }] }); }
export function selectRole(state, role) { if (!RETURN_ROLES[role]) return normalizeReturnLoop(state); const current = normalizeReturnLoop(state); return recordReturnEvent({ ...current, player: { ...current.player, role } }, 'role_selected', { role }); }

export function startReturnableExpedition(state, { gameId, name, crew = [], pressure = 18 } = {}) {
  const current = normalizeReturnLoop(state); const id = text(String(gameId || ''), `local-${Date.now()}`);
  return recordReturnEvent({ ...current, crew: crew.length ? crew : current.crew.length ? current.crew : [{ callsign: current.player.callsign, role: current.player.role || 'scout', status: 'ready' }, { callsign: 'Vex', role: 'warden', status: 'waiting' }], expedition: { gameId: id, name: text(name, `Survey ${id}`), lifecycle: 'active', pressure, clue: 'A relic-frequency is still pointing beyond the first ridge.', lastConsequence: 'The crew has charted a possible route home.', nextAction: 'Read the signal and commit the next crew decision.', nextReason: 'The Scout can reveal whether the ridge is safe before the crew crosses.', updatedAt: now() }, player: { ...current.player, records: { ...current.player.records, expeditions: current.player.records.expeditions + 1 } } }, 'expedition_started', { gameId: id });
}

export function updateExpeditionReturn(state, patch = {}) { const current = normalizeReturnLoop(state); if (!current.expedition) return current; return recordReturnEvent({ ...current, expedition: { ...current.expedition, ...patch, updatedAt: now() } }, 'expedition_updated', { lifecycle: patch.lifecycle }); }

export function returnRecommendation(state) {
  const current = normalizeReturnLoop(state); const expedition = current.expedition;
  if (!current.player.role) return { action: 'Choose your expedition role', reason: 'A crew needs a distinct contribution before it can depend on you.', href: '#return-loop' };
  if (!expedition) return { action: 'Start or join an expedition', reason: `${RETURN_ROLES[current.player.role].label}s ${RETURN_ROLES[current.player.role].contribution}; the first crew is waiting for that contribution.`, href: '#live-expedition' };
  if (expedition.lifecycle === 'waiting-on-crew') return { action: 'Make your crew decision', reason: expedition.nextReason, href: `/game/${expedition.gameId}` };
  if (expedition.lifecycle === 'at-risk' || expedition.lifecycle === 'extraction-window') return { action: 'Protect the extraction route', reason: `Pressure is ${expedition.pressure}%. ${expedition.nextReason}`, href: `/game/${expedition.gameId}` };
  if (expedition.lifecycle === 'complete' || expedition.lifecycle === 'recoverable') return { action: 'Follow the unresolved clue', reason: expedition.clue, href: '#live-expedition' };
  return { action: 'Resume expedition', reason: expedition.nextReason, href: `/game/${expedition.gameId}` };
}
