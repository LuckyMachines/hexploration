import { createContext, useContext, useState, useEffect } from 'react';

const UIScaleContext = createContext();

export const SCALE_PRESETS = [
  { label: 'S', value: 0.85 },
  { label: 'M', value: 1 },
  { label: 'L', value: 1.15 },
  { label: 'XL', value: 1.3 },
];

function applyScale(scale) {
  const base = getComputedStyle(document.documentElement)
    .getPropertyValue('--base-font-size')
    .trim();
  document.documentElement.style.fontSize = `calc(${base} * ${scale})`;
}

export function UIScaleProvider({ children }) {
  const [scale, setScaleState] = useState(() => {
    const stored = localStorage.getItem('ui-scale');
    return stored ? parseFloat(stored) : 1;
  });

  useEffect(() => {
    applyScale(scale);
  }, [scale]);

  const setScale = (val) => {
    localStorage.setItem('ui-scale', String(val));
    setScaleState(val);
  };

  return (
    <UIScaleContext.Provider value={{ scale, setScale }}>
      {children}
    </UIScaleContext.Provider>
  );
}

export function useUIScale() {
  const ctx = useContext(UIScaleContext);
  if (!ctx) throw new Error('useUIScale must be used within UIScaleProvider');
  return ctx;
}
