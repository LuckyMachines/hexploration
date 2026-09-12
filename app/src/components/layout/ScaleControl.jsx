import { useUIScale, SCALE_PRESETS } from '../../contexts/UIScaleContext';

export default function ScaleControl({ alwaysVisible = false }) {
  const { scale, setScale } = useUIScale();

  return (
    <div className={`${alwaysVisible ? 'flex' : 'hidden sm:flex'} min-h-11 items-center gap-0.5 bg-exp-panel border border-exp-border rounded px-1.5 py-0.5`}>
      {SCALE_PRESETS.map((preset) => (
        <button
          key={preset.label}
          onClick={() => setScale(preset.value)}
          aria-label={`Set interface scale to ${preset.label}`}
          aria-pressed={scale === preset.value}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center px-1.5 py-1 text-xs font-mono rounded transition-colors cursor-pointer ${
            scale === preset.value
              ? 'text-compass-bright bg-exp-border'
              : 'text-exp-text-dim hover:text-exp-text'
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
