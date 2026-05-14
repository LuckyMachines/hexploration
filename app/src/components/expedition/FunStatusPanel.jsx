const TONE_CLASS = {
  red: 'border-signal-red/35 bg-signal-red/10 text-signal-red',
  gold: 'border-compass/35 bg-compass/10 text-compass-bright',
  green: 'border-oxide-green/35 bg-oxide-green/10 text-oxide-green',
  blue: 'border-blueprint/35 bg-blueprint/10 text-blueprint',
  purple: 'border-relic/35 bg-relic/10 text-relic',
  neutral: 'border-exp-border/70 bg-exp-dark/35 text-exp-text-dim',
};

function toneClass(tone) {
  return TONE_CLASS[tone] || TONE_CLASS.neutral;
}

export default function FunStatusPanel({ telemetry }) {
  if (!telemetry) return null;

  const {
    mood,
    bark,
    risk,
    combo,
    nearMiss,
    rareBeat,
    preview,
    rhythm,
    turnScene,
    namedMoment,
    soundCues = [],
  } = telemetry;

  return (
    <div className="rounded border border-compass/25 bg-exp-panel/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-exp-text-dim">
                Expedition pulse
              </p>
              <h3 className="mt-1 font-display text-xl uppercase tracking-[0.14em] text-compass-bright">
                {namedMoment.title}
              </h3>
              <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
                {turnScene.body}
              </p>
            </div>
            <div className={`rounded border px-3 py-2 ${toneClass(mood.tone)}`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
                Mood
              </p>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em]">
                {mood.label}
              </p>
            </div>
          </div>

          <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-exp-text-dim">
              Explorer
            </p>
            <p className="mt-1 font-mono text-sm text-exp-text">
              "{bark.line}"
            </p>
            <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
              {mood.body}
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className={`rounded border px-3 py-2 ${toneClass(combo.tone)}`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
                Combo
              </p>
              <p className="mt-1 font-mono text-xs">{combo.label}</p>
              <p className="mt-1 font-mono text-[11px] opacity-80">{combo.body}</p>
            </div>
            <div className={`rounded border px-3 py-2 ${toneClass(nearMiss.active ? 'red' : 'blue')}`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
                Edge
              </p>
              <p className="mt-1 font-mono text-xs">{nearMiss.label}</p>
              <p className="mt-1 font-mono text-[11px] opacity-80">{nearMiss.body}</p>
            </div>
            <div className={`rounded border px-3 py-2 ${toneClass(rareBeat.tone)}`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-70">
                Sign
              </p>
              <p className="mt-1 font-mono text-xs">{rareBeat.label}</p>
              <p className="mt-1 font-mono text-[11px] opacity-80">{rareBeat.body}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className={`rounded border p-3 ${risk.level === 'redline' ? 'alive-risk-redline border-signal-red/40 bg-signal-red/10' : 'border-exp-border/60 bg-exp-dark/35'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-exp-text-dim">
                  Risk tension
                </p>
                <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-compass-bright">
                  {risk.label}
                </p>
              </div>
              <p className="font-mono text-lg tabular-nums text-exp-text">
                {risk.score}
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded bg-exp-border/70">
              <div
                className={`h-full rounded ${risk.level === 'redline' ? 'bg-signal-red' : risk.level === 'hot' ? 'bg-compass-bright' : 'bg-oxide-green'}`}
                style={{ width: `${risk.score}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-[11px] text-exp-text-dim">
              {risk.body}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-blueprint/25 bg-blueprint/5 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-blueprint">
                Preview
              </p>
              <p className="mt-1 font-mono text-xs text-exp-text">{preview.label}</p>
              <p className="mt-1 font-mono text-[11px] text-exp-text-dim">{preview.body}</p>
            </div>
            <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
                Rhythm
              </p>
              <p className="mt-1 font-mono text-xs text-exp-text">{rhythm.label}</p>
              <p className="mt-1 font-mono text-[11px] text-exp-text-dim">
                {rhythm.beats.join(' / ')}
              </p>
            </div>
          </div>

          <div className="rounded border border-exp-border/60 bg-exp-dark/35 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-exp-text-dim">
              Cue hooks
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {soundCues.map((cue) => (
                <span
                  key={`${cue.key}-${cue.label}`}
                  className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${toneClass(cue.tone)}`}
                >
                  {cue.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
