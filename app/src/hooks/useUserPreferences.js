import { useEffect, useState } from 'react';

const STORAGE_KEY = 'xenovoya:user-preferences';
const DEFAULT_PREFS = {
  reducedMotion: false,
  compactMode: false,
  largerBoard: false,
  showTelemetry: true,
  showExtraDetail: false,
  compactHud: false,
  actionDetailsOpen: false,
  outcomePreviewOpen: false,
};

export function useUserPreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_PREFS);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      setPreferences({ ...DEFAULT_PREFS, ...saved });
    } catch {
      setPreferences(DEFAULT_PREFS);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    document.documentElement.classList.toggle('ux-reduced-motion', preferences.reducedMotion);
    document.documentElement.classList.toggle('ux-compact', preferences.compactMode);
    document.documentElement.classList.toggle('ux-large-board', preferences.largerBoard);
    document.documentElement.classList.toggle('ux-compact-hud', preferences.compactHud);
  }, [preferences]);

  const setPreference = (key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const resetPreferences = () => setPreferences(DEFAULT_PREFS);

  return { preferences, setPreference, resetPreferences };
}
