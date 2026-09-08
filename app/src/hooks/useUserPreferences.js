import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'xenovoya:user-preferences';
const CHANGE_EVENT = 'xenovoya:user-preferences-changed';
const DEFAULT_PREFS = Object.freeze({
  reducedMotion: false,
  compactMode: false,
  largerBoard: true,
  showTelemetry: false,
  showExtraDetail: false,
  compactHud: false,
  tacticalBoard: false,
  efficientBoard: false,
  actionDetailsOpen: false,
  outcomePreviewOpen: false,
  analytics: true,
});

let snapshot = DEFAULT_PREFS;
let snapshotRaw;
const listeners = new Set();

function readPreferences() {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  let raw = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return snapshot;
  }
  if (raw === snapshotRaw) return snapshot;
  snapshotRaw = raw;
  try {
    const saved = raw ? JSON.parse(raw) : {};
    snapshot = { ...DEFAULT_PREFS, ...saved };
  } catch {
    snapshot = DEFAULT_PREFS;
  }
  return snapshot;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function writePreferences(next) {
  snapshot = next;
  snapshotRaw = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, snapshotRaw);
  } catch {
    // Preferences remain active in memory when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  notify();
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    snapshotRaw = undefined;
    readPreferences();
    notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useUserPreferences() {
  const preferences = useSyncExternalStore(subscribe, readPreferences, () => DEFAULT_PREFS);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('ux-reduced-motion', preferences.reducedMotion);
    html.classList.toggle('ux-compact', preferences.compactMode);
    html.classList.toggle('ux-large-board', preferences.largerBoard);
    html.classList.toggle('ux-compact-hud', preferences.compactHud);
  }, [preferences]);

  const setPreference = useCallback((key, value) => {
    writePreferences({ ...readPreferences(), [key]: value });
  }, []);

  const resetPreferences = useCallback(() => writePreferences({ ...DEFAULT_PREFS }), []);

  return { preferences, setPreference, resetPreferences };
}

export {
  CHANGE_EVENT as USER_PREFERENCES_CHANGE_EVENT,
  DEFAULT_PREFS,
  STORAGE_KEY as USER_PREFERENCES_STORAGE_KEY,
};
