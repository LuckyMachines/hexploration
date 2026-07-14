const ENV = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
const PLAUSIBLE_HOST = String(ENV.VITE_PLAUSIBLE_HOST || '').replace(/\/$/, '');
const PLAUSIBLE_DOMAIN = String(ENV.VITE_PLAUSIBLE_DOMAIN || '');
const EVENT_VERSION = '1';
const INSTALLATION_KEY = 'xenovoya:analytics-installation:v1';
const JOURNEY_KEY = 'xenovoya:analytics-journey:v1';
const JOURNEY_SEQUENCE_KEY = 'xenovoya:analytics-journey-sequence:v1';
const DEDUPE_KEY = 'xenovoya:analytics-dedupe:v1';
const MAX_DEDUPE_RECORDS = 200;
const BASE_PROPERTIES = new Set(['event_id', 'event_version', 'environment', 'release', 'route', 'journey_id', 'journey_sequence', 'installation_id', 'source']);
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ENUM_PROPERTIES = Object.freeze({
  environment: new Set(['production', 'preview', 'staging', 'test', 'development']),
  source: new Set(['player', 'synthetic']),
  role: new Set(['scout', 'warden', 'salvager', 'none']),
  choice: new Set(['crew_role']),
  lifecycle: new Set(['preparing', 'active', 'waiting-on-crew', 'at-risk', 'extraction-window', 'complete', 'recoverable']),
  outcome: new Set(['route_charted', 'decision_ready', 'completed', 'recoverable', 'crew_survived', 'partial_survival', 'crew_lost']),
  sync_result: new Set(['synced', 'conflict_resolved']),
  resume_source: new Set(['local', 'cloud']),
  game_context: new Set(['open_registry', 'full_registry']),
  share_type: new Set(['crew_invite', 'report_link', 'relic_text', 'relic_image', 'relic_download']),
  return_interval: new Set(['same_session', 'same_day', 'd1_d3', 'd3_d7', 'd7_plus']),
  persona: new Set(['first-player-v1']),
});

export const JOURNEY_EVENTS = Object.freeze({
  starter_opened: ['persona'],
  role_selected: ['role'],
  meaningful_choice: ['choice', 'role'],
  visible_consequence: ['outcome', 'lifecycle'],
  starter_completed: ['outcome', 'role'],
  cloud_save_offered: ['has_expedition', 'role'],
  cloud_save_completed: ['has_expedition', 'role', 'cloud_version', 'sync_result'],
  live_join: ['game_context'],
  resume: ['has_expedition', 'lifecycle', 'resume_source'],
  recap: ['lifecycle', 'outcome'],
  share: ['share_type'],
  second_expedition_start: ['return_interval', 'role'],
  analytics_canary: ['canary_id'],
});

let ready = false;
let fallbackJourneySequence = 0;

function storageValue(storage, key, create) {
  if (!storage) return create();
  try {
    const existing = storage.getItem(key);
    if (existing) return existing;
    const value = create();
    storage.setItem(key, value);
    return value;
  } catch {
    return create();
  }
}

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    return (token === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function nextJourneySequence() {
  if (typeof window === 'undefined') return ++fallbackJourneySequence;
  try {
    const stored = Number(window.sessionStorage.getItem(JOURNEY_SEQUENCE_KEY) || 0);
    const next = Math.max(Number.isSafeInteger(stored) ? stored : 0, fallbackJourneySequence) + 1;
    fallbackJourneySequence = next;
    window.sessionStorage.setItem(JOURNEY_SEQUENCE_KEY, String(next));
    return next;
  } catch {
    return ++fallbackJourneySequence;
  }
}

function currentEnvironment() {
  if (ENV.VITE_APP_ENV) return String(ENV.VITE_APP_ENV).slice(0, 32);
  if (typeof window !== 'undefined' && window.location.hostname === 'play.xenovoya.com') return 'production';
  return 'development';
}

function currentRoute() {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname.slice(0, 120) || '/';
}

function safeString(value) {
  const text = String(value).trim().slice(0, 120);
  if (!text) return undefined;
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) return undefined;
  if (/0x[a-f0-9]{40,}/i.test(text)) return undefined;
  if (/(?:bearer\s+|postgres(?:ql)?:\/\/|mysql:\/\/|redis:\/\/|sk_(?:live|test)_|whsec_|private[_ -]?key|wallet[_ -]?signature)/i.test(text)) return undefined;
  if (/:\/\//.test(text)) return undefined;
  return text;
}

function safeProperty(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return safeString(value);
  return undefined;
}

function validProperty(key, value) {
  if (ENUM_PROPERTIES[key]) return ENUM_PROPERTIES[key].has(value);
  if (key === 'event_version') return value === EVENT_VERSION;
  if (key === 'event_id' || key === 'installation_id' || key === 'journey_id' || key === 'canary_id') return UUID_PATTERN.test(value);
  if (key === 'route') return value.startsWith('/') && !/[?#]/.test(value);
  if (key === 'release') return value === 'unknown' || value === 'e2e-release' || /^[a-f0-9]{40}$/i.test(value);
  if (key === 'has_expedition') return typeof value === 'boolean';
  if (key === 'cloud_version') return Number.isSafeInteger(value) && value >= 0;
  if (key === 'journey_sequence') return Number.isSafeInteger(value) && value > 0 && value <= 1_000_000;
  return false;
}

function readDedupe() {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DEDUPE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeDedupe(value) {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.entries(value).sort((left, right) => Number(right[1]) - Number(left[1])).slice(0, MAX_DEDUPE_RECORDS);
    window.localStorage.setItem(DEDUPE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Analytics must never block play when storage is unavailable.
  }
}

export function analyticsEnabled() {
  return Boolean(PLAUSIBLE_HOST && PLAUSIBLE_DOMAIN && typeof document !== 'undefined' && typeof window !== 'undefined');
}

export function getAnalyticsContext() {
  const installationId = storageValue(typeof window === 'undefined' ? null : window.localStorage, INSTALLATION_KEY, randomId);
  const journeyId = storageValue(typeof window === 'undefined' ? null : window.sessionStorage, JOURNEY_KEY, randomId);
  return {
    event_version: EVENT_VERSION,
    environment: currentEnvironment(),
    release: safeString(ENV.VITE_RELEASE_SHA || 'unknown') || 'unknown',
    route: currentRoute(),
    journey_id: journeyId,
    installation_id: installationId,
    source: safeString(ENV.VITE_ANALYTICS_SOURCE || 'player') || 'player',
  };
}

function queuePageview() {
  if (typeof window === 'undefined' || typeof window.plausible !== 'function') return;
  const url = window.location.href;
  if (window.__xenovoyaLastPageview === url) return;
  window.__xenovoyaLastPageview = url;
  window.plausible('pageview', { u: url, props: { ...getAnalyticsContext(), event_id: randomId() } });
}

function installNavigationTracking() {
  if (window.__xenovoyaNavigationTracking) return;
  window.__xenovoyaNavigationTracking = true;
  const schedule = () => queueMicrotask(queuePageview);
  for (const method of ['pushState', 'replaceState']) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args) => {
      const result = original(...args);
      schedule();
      return result;
    };
  }
  window.addEventListener('popstate', schedule);
}

export function initAnalytics() {
  if (!analyticsEnabled()) return false;
  if (typeof window.plausible !== 'function') {
    window.plausible = (...args) => {
      window.plausible.q = window.plausible.q || [];
      window.plausible.q.push(args);
    };
  }
  installNavigationTracking();
  queuePageview();
  if (ready || document.querySelector('script[data-xenovoya-plausible]')) return true;
  const script = document.createElement('script');
  script.defer = true;
  script.dataset.domain = PLAUSIBLE_DOMAIN;
  script.dataset.api = `${PLAUSIBLE_HOST}/api/event`;
  script.dataset.xenovoyaPlausible = 'true';
  script.src = `${PLAUSIBLE_HOST}/js/script.manual.js`;
  script.onload = () => { ready = true; };
  document.head.appendChild(script);
  return true;
}

export function trackJourneyEvent(name, props = {}, { dedupeKey = 'once' } = {}) {
  const permitted = JOURNEY_EVENTS[name];
  if (!permitted || !analyticsEnabled()) return false;
  initAnalytics();
  const context = getAnalyticsContext();
  const identity = `${context.journey_id}:${name}:${String(dedupeKey).slice(0, 80)}`;
  const dedupe = readDedupe();
  if (dedupe[identity]) return false;

  const allowed = new Set([...BASE_PROPERTIES, ...permitted]);
  const candidate = { ...props, ...context, event_id: randomId(), journey_sequence: nextJourneySequence() };
  const safeProps = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (!allowed.has(key)) continue;
    const safe = safeProperty(value);
    if (safe !== undefined && validProperty(key, safe)) safeProps[key] = safe;
  }
  window.plausible(name, { props: safeProps });
  dedupe[identity] = Date.now();
  writeDedupe(dedupe);
  return true;
}

export function trackRetentionEvent(name, props = {}, options = {}) {
  return trackJourneyEvent(name, props, options);
}
