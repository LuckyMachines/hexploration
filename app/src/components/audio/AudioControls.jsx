export default function AudioControls({
  musicEnabled,
  sfxEnabled,
  musicBlocked,
  musicTrack,
  musicDirectorState,
  onMusicToggle,
  onSfxToggle,
}) {
  const musicLabel = musicBlocked ? 'Start Audio' : musicEnabled ? 'Music On' : 'Music Off';
  const sfxLabel = sfxEnabled ? 'SFX On' : 'SFX Off';
  const cueTitle = musicTrack
    ? `Toggle background music. Current cue: ${musicTrack.title} (${musicDirectorState?.state || musicTrack.state}).`
    : 'Toggle background music';

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-pressed={musicEnabled && !musicBlocked}
        title={cueTitle}
        onClick={onMusicToggle}
        className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
          musicEnabled && !musicBlocked
            ? 'border-compass/45 bg-compass/10 text-compass-bright'
            : musicBlocked
              ? 'border-blueprint/45 bg-blueprint/10 text-blueprint'
              : 'border-exp-border/75 bg-exp-dark/30 text-exp-text-dim hover:border-compass/40 hover:text-exp-text'
        }`}
      >
        {musicLabel}
      </button>
      <button
        type="button"
        aria-pressed={sfxEnabled}
        title="Toggle sound effects"
        onClick={onSfxToggle}
        className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
          sfxEnabled
            ? 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green'
            : 'border-exp-border/75 bg-exp-dark/30 text-exp-text-dim hover:border-compass/40 hover:text-exp-text'
        }`}
      >
        {sfxLabel}
      </button>
    </div>
  );
}
