import { useUIScale, SCALE_PRESETS } from '../../contexts/UIScaleContext';

export default function ScaleControl() {
  const { scale, setScale } = useUIScale();

  return (
    <div className="flex items-center gap-0.5 bg-exp-panel border border-exp-border rounded px-1.5 py-0.5">
      {SCALE_PRESETS.map((preset) => (
        <button
          key={preset.label}
          onClick={() => setScale(preset.value)}
          className={`px-1.5 py-0.5 text-xs font-mono rounded transition-colors cursor-pointer ${
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
