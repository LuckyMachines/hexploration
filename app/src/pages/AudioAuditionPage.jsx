import { useMemo, useRef, useState } from 'react';
import { FEEDBACK_AUDIO, MUSIC_TRACKS } from '../lib/audioAssets';

const MUSIC = MUSIC_TRACKS.map((track) => ({
  file: track.src,
  name: track.id,
  state: track.state,
  trigger: track.trigger,
  desc: track.desc,
  dur: track.durationLabel,
  tag: 'music',
}));

const SFX = [
  { key: 'move', state: 'Move', trigger: 'board aim / route undo', desc: 'Servo-forward route nudge', dur: '0.58s' },
  { key: 'commit', state: 'Commit', trigger: 'valid tile commit / ping', desc: 'Mechanical UI confirmation', dur: '0.90s' },
  { key: 'rush', state: 'Rush', trigger: 'urgent analog or fast input', desc: 'Short modular micro gesture', dur: '0.55s' },
  { key: 'invalid', state: 'Invalid', trigger: 'rejected route or empty undo', desc: 'Hard metal impact rejection', dur: '0.50s' },
  { key: 'tx-pending', state: 'Tx Pending', trigger: 'wallet awaiting signature', desc: 'Data transmission start cue', dur: '0.80s' },
  { key: 'tx-confirming', state: 'Tx Confirming', trigger: 'transaction confirming', desc: 'Data transmission motion cue', dur: '0.90s' },
  { key: 'tx-success', state: 'Tx Success', trigger: 'confirmed transaction', desc: 'Warm tonal success cue', dur: '1.15s' },
  { key: 'tx-error', state: 'Tx Error', trigger: 'failed transaction', desc: 'Metal crush and rattle failure cue', dur: '1.05s' },
].map((item) => ({
  ...item,
  name: item.key,
  file: FEEDBACK_AUDIO[item.key].src,
  tag: 'sfx',
}));

function AudioCard({ item, loopAll, registerPlayer }) {
  const haystack = `${item.name} ${item.state} ${item.trigger} ${item.desc} ${item.tag}`.toLowerCase();

  return (
    <article
      data-haystack={haystack}
      className="audio-card min-w-0 rounded border border-exp-border bg-exp-panel/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors data-[playing=true]:border-compass data-[playing=true]:shadow-[0_0_0_1px_rgba(196,166,74,0.8)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base uppercase tracking-[0.08em] text-exp-text">
            {item.name}
          </h3>
          <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">
            {item.desc} <span className="text-exp-text-dim/65">/ {item.dur}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
            item.tag === 'music'
              ? 'bg-compass text-exp-dark'
              : 'bg-blueprint text-exp-dark'
          }`}>
            {item.state}
          </span>
          <a
            href={item.file}
            download
            className="rounded border border-exp-border px-2 py-0.5 font-mono text-xs text-exp-text-dim hover:border-compass/60 hover:text-compass"
            title="Download audio file"
          >
            dl
          </a>
        </div>
      </div>
      <p className="mt-2 truncate font-mono text-[11px] text-oxide-green">
        &gt; {item.trigger}
      </p>
      <audio
        className="mt-3 h-9 w-full min-w-0 max-w-full"
        controls
        preload="none"
        loop={loopAll}
        src={item.file}
        ref={registerPlayer}
      />
    </article>
  );
}

function AuditionSection({ title, items, query, loopAll, registerPlayer }) {
  const filtered = items.filter((item) => {
    if (!query) return true;
    return `${item.name} ${item.state} ${item.trigger} ${item.desc} ${item.tag}`.toLowerCase().includes(query);
  });

  return (
    <section className="mt-8">
      <div className="border-b border-exp-border pb-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.28em] text-blueprint">
          {title} <span className="text-exp-text-dim">/ {filtered.length}</span>
        </h2>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <AudioCard
            key={item.file}
            item={item}
            loopAll={loopAll}
            registerPlayer={registerPlayer}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="mt-3 rounded border border-exp-border bg-exp-panel/70 p-6 text-center font-mono text-xs text-exp-text-dim">
          No matching audio files.
        </div>
      )}
    </section>
  );
}

export default function AudioAuditionPage() {
  const [query, setQuery] = useState('');
  const [loopAll, setLoopAll] = useState(false);
  const [soloMode, setSoloMode] = useState(true);
  const playersRef = useRef(new Set());
  const soloModeRef = useRef(soloMode);
  const normalizedQuery = query.trim().toLowerCase();
  const total = MUSIC.length + SFX.length;
  soloModeRef.current = soloMode;

  const visibleCount = useMemo(() => {
    if (!normalizedQuery) return total;
    return [...MUSIC, ...SFX].filter((item) => (
      `${item.name} ${item.state} ${item.trigger} ${item.desc} ${item.tag}`.toLowerCase().includes(normalizedQuery)
    )).length;
  }, [normalizedQuery, total]);

  const registerPlayer = (node) => {
    if (!node || playersRef.current.has(node)) return;
    playersRef.current.add(node);

    node.addEventListener('play', () => {
      if (soloModeRef.current) {
        playersRef.current.forEach((player) => {
          if (player !== node) player.pause();
        });
      }
      document.querySelectorAll('.audio-card[data-playing="true"]').forEach((card) => {
        card.dataset.playing = 'false';
      });
      node.closest('.audio-card').dataset.playing = 'true';
    });
    node.addEventListener('pause', () => {
      node.closest('.audio-card').dataset.playing = 'false';
    });
    node.addEventListener('ended', () => {
      node.closest('.audio-card').dataset.playing = 'false';
    });
  };

  const stopAll = () => {
    playersRef.current.forEach((player) => {
      player.pause();
      player.currentTime = 0;
    });
    document.querySelectorAll('.audio-card[data-playing="true"]').forEach((card) => {
      card.dataset.playing = 'false';
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-9">
      <header className="border-b border-exp-border pb-5">
        <h1 className="font-display text-3xl uppercase tracking-[0.14em] text-exp-text">
          Xenovoya <span className="text-compass">Audio Audition</span>
        </h1>
        <p className="mt-2 max-w-3xl font-mono text-sm leading-relaxed text-exp-text-dim">
          {MUSIC.length} music tracks + {SFX.length} SFX cues. Music comes from ACE-Step 1.5; SFX are curated from Perforce game audio.
        </p>
      </header>

      <div className="sticky top-0 z-20 -mx-4 mt-4 border-y border-exp-border bg-exp-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, state, or trigger..."
            className="min-w-56 flex-1 rounded border border-exp-border bg-exp-panel px-3 py-2 font-mono text-sm text-exp-text outline-none placeholder:text-exp-text-dim focus:border-compass/70"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded border border-exp-border bg-exp-dark/35 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-exp-text-dim">
            <input
              type="checkbox"
              checked={loopAll}
              onChange={(event) => setLoopAll(event.target.checked)}
              className="accent-compass"
            />
            Loop
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-exp-border bg-exp-dark/35 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-exp-text-dim">
            <input
              type="checkbox"
              checked={soloMode}
              onChange={(event) => setSoloMode(event.target.checked)}
              className="accent-compass"
            />
            Solo
          </label>
          <button
            type="button"
            onClick={stopAll}
            className="rounded border border-exp-border bg-exp-panel px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-exp-text-dim hover:border-compass/60 hover:text-compass"
          >
            Stop All
          </button>
          <span className="font-mono text-xs text-exp-text-dim">
            {visibleCount}/{total} files
          </span>
        </div>
      </div>

      <AuditionSection
        title="Music"
        items={MUSIC}
        query={normalizedQuery}
        loopAll={loopAll}
        registerPlayer={registerPlayer}
      />
      <AuditionSection
        title="Sound Effects"
        items={SFX}
        query={normalizedQuery}
        loopAll={loopAll}
        registerPlayer={registerPlayer}
      />

      <footer className="mt-10 border-t border-exp-border pt-4 font-mono text-xs leading-relaxed text-exp-text-dim">
        Manifest: <code>/audio/audio-sources.json</code>. Local ACE-Step source:
        <code> X:/Music_AI_JBP/music-ai-suite/shared/generated</code>.
      </footer>
    </div>
  );
}
