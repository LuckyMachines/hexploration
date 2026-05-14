import { useUserPreferences } from '../../hooks/useUserPreferences';

const OPTIONS = [
  ['reducedMotion', 'Reduced motion'],
  ['compactMode', 'Compact mode'],
  ['largerBoard', 'Larger board'],
  ['showTelemetry', 'Show telemetry'],
];

export default function UserPreferencesPanel() {
  const { preferences, setPreference, resetPreferences } = useUserPreferences();

  return (
    <details className="rounded border border-exp-border bg-exp-panel/70 px-4 py-3">
      <summary className="cursor-pointer list-none font-mono text-xs uppercase tracking-[0.28em] text-exp-text-dim">
        UI Preferences
      </summary>
      <div className="mt-3 flex flex-wrap gap-2">
        {OPTIONS.map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-2 rounded border border-exp-border bg-exp-dark/35 px-3 py-2 font-mono text-xs text-exp-text-dim"
          >
            <input
              type="checkbox"
              checked={Boolean(preferences[key])}
              onChange={(event) => setPreference(key, event.target.checked)}
              className="accent-compass"
            />
            {label}
          </label>
        ))}
        <button
          type="button"
          onClick={resetPreferences}
          className="rounded border border-exp-border px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] text-exp-text-dim hover:border-compass/50 hover:text-compass"
        >
          Reset
        </button>
      </div>
    </details>
  );
}

