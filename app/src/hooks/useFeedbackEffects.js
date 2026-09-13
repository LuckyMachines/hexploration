import { useCallback, useEffect, useRef, useState } from 'react';
import { FEEDBACK_EVENT } from '../lib/feedbackEvents';
import {
  DEFAULT_MUSIC_TRACK_ID,
  BOARD_CUE_PROFILES,
  FEEDBACK_AUDIO,
  FEEDBACK_FALLBACK,
  MUSIC_TRACK_BY_ID,
} from '../lib/audioAssets';
import { MUSIC_DIRECTOR_EVENT, trackForRoute } from '../lib/musicDirector';

const STORAGE_KEY = 'xenovoya:audio';
const DEFAULT_AUDIO_PREFS = {
  musicEnabled: false,
  sfxEnabled: true,
};

function loadAudioPrefs() {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_PREFS;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_AUDIO_PREFS, ...saved };
  } catch {
    return DEFAULT_AUDIO_PREFS;
  }
}

function sameDirectorState(a, b) {
  return a.trackId === b.trackId && a.state === b.state && a.reason === b.reason;
}

function normalizeDirectorState(detail) {
  const track = MUSIC_TRACK_BY_ID[detail?.trackId] || MUSIC_TRACK_BY_ID[DEFAULT_MUSIC_TRACK_ID];
  return {
    trackId: track.id,
    state: detail?.state || track.state,
    reason: detail?.reason || track.trigger,
  };
}

export function useFeedbackEffects(location) {
  const initialPrefs = useRef(loadAudioPrefs());
  const initialDirectorState = useRef(trackForRoute(location?.pathname || '/'));
  const [musicEnabled, setMusicEnabled] = useState(initialPrefs.current.musicEnabled);
  const [sfxEnabled, setSfxEnabled] = useState(initialPrefs.current.sfxEnabled);
  const [musicBlocked, setMusicBlocked] = useState(false);
  const [musicDirectorState, setMusicDirectorState] = useState(initialDirectorState.current);
  const audioContextRef = useRef(null);
  const musicRef = useRef(null);
  const musicFadeRef = useRef(null);
  const musicDuckRef = useRef(null);
  const sampleCacheRef = useRef(new Map());
  const activeSamplesRef = useRef(new Set());
  const activeToneCountRef = useRef(0);
  const musicTrack = MUSIC_TRACK_BY_ID[musicDirectorState.trackId] || MUSIC_TRACK_BY_ID[DEFAULT_MUSIC_TRACK_ID];

  const playTone = useCallback((profile) => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      audioContextRef.current ||= new AudioContextCtor();
      const ctx = audioContextRef.current;
      ctx.resume?.().catch(() => {});
      const layers = Array.isArray(profile) ? profile : [profile];
      if (activeToneCountRef.current >= 8) return;
      activeToneCountRef.current += 1;
      const cueDurationMs = Math.max(...layers.map((layer) => Number(layer.delayMs || 0) + Number(layer.duration || 0.09) * 1000));
      window.setTimeout(() => { activeToneCountRef.current = Math.max(0, activeToneCountRef.current - 1); }, cueDurationMs + 40);
      layers.forEach((layer) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + Number(layer.delayMs || 0) / 1000;
        const duration = Math.max(0.06, Number(layer.duration || 0.09));
        const attack = Math.min(duration * 0.3, Number(layer.attack || 0.018));

        oscillator.type = layer.type || 'sine';
        oscillator.frequency.setValueAtTime(layer.frequency, start);
        if (layer.frequencyEnd) oscillator.frequency.exponentialRampToValueAtTime(layer.frequencyEnd, start + duration);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, layer.gain || 0.01), start + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
        if (panner) {
          panner.pan.setValueAtTime(Number(layer.pan || 0), start);
          oscillator.connect(gain).connect(panner).connect(ctx.destination);
        } else oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
      });
    } catch {
      // Browser audio policies may block this until user interaction.
    }
  }, []);

  const playSample = useCallback((kind, fallback) => {
    const asset = FEEDBACK_AUDIO[kind];
    if (!asset || typeof Audio === 'undefined') {
      playTone(fallback);
      return;
    }

    let base = sampleCacheRef.current.get(kind);
    if (!base) {
      base = new Audio(asset.src);
      base.preload = 'auto';
      sampleCacheRef.current.set(kind, base);
    }

    const sample = base.cloneNode();
    if (activeSamplesRef.current.size >= 5) {
      const oldest = activeSamplesRef.current.values().next().value;
      oldest?.pause?.();
      activeSamplesRef.current.delete(oldest);
    }
    activeSamplesRef.current.add(sample);
    const release = () => activeSamplesRef.current.delete(sample);
    sample.addEventListener('ended', release, { once: true });
    sample.addEventListener('error', release, { once: true });
    sample.volume = asset.volume;
    sample.play().catch(() => {
      release();
      playTone(fallback);
    });
  }, [playTone]);

  const duckMusic = useCallback(() => {
    const music = musicRef.current;
    if (!music || music.paused) return;
    const targetVolume = music.__targetVolume ?? music.volume;
    music.__targetVolume = targetVolume;
    music.volume = Math.min(music.volume, targetVolume * 0.52);
    if (musicDuckRef.current) window.clearTimeout(musicDuckRef.current);
    musicDuckRef.current = window.setTimeout(() => {
      if (musicRef.current === music) music.volume = targetVolume;
      musicDuckRef.current = null;
    }, 520);
  }, []);

  const startMusic = useCallback(async () => {
    if (typeof Audio === 'undefined') return false;
    const current = musicRef.current;
    const targetVolume = musicTrack.volume ?? 0.34;
    if (current?.__trackId === musicTrack.id) {
      current.volume = targetVolume;
      try {
        await current.play();
        setMusicBlocked(false);
        return true;
      } catch {
        setMusicBlocked(true);
        return false;
      }
    }

    const music = new Audio(musicTrack.src);
    music.__trackId = musicTrack.id;
    music.__targetVolume = targetVolume;
    music.loop = true;
    music.preload = 'auto';
    music.volume = current && !current.paused ? 0 : targetVolume;

    try {
      await music.play();
      if (musicFadeRef.current) window.clearInterval(musicFadeRef.current);
      if (current && !current.paused) {
        const previousVolume = current.volume;
        const startedAt = performance.now();
        musicFadeRef.current = window.setInterval(() => {
          const progress = Math.min(1, (performance.now() - startedAt) / 900);
          current.volume = Math.max(0, previousVolume * (1 - progress));
          music.volume = Math.min(targetVolume, targetVolume * progress);
          if (progress >= 1) {
            window.clearInterval(musicFadeRef.current);
            musicFadeRef.current = null;
            current.pause();
            current.src = '';
          }
        }, 50);
      }
      musicRef.current = music;
      setMusicBlocked(false);
      return true;
    } catch {
      setMusicBlocked(true);
      return false;
    }
  }, [musicTrack]);

  const stopMusic = useCallback(() => {
    if (musicFadeRef.current) {
      window.clearInterval(musicFadeRef.current);
      musicFadeRef.current = null;
    }
    if (musicRef.current) musicRef.current.pause();
    setMusicBlocked(false);
  }, []);

  const toggleMusic = useCallback(() => {
    if (musicEnabled && musicBlocked) {
      startMusic();
      return;
    }

    const next = !musicEnabled;
    setMusicEnabled(next);
    if (next) {
      startMusic();
    } else {
      stopMusic();
    }
  }, [musicBlocked, musicEnabled, startMusic, stopMusic]);

  const toggleSfx = useCallback(() => {
    setSfxEnabled((enabled) => !enabled);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ musicEnabled, sfxEnabled }));
  }, [musicEnabled, sfxEnabled]);

  useEffect(() => {
    const next = trackForRoute(location?.pathname || '/');
    setMusicDirectorState((current) => (sameDirectorState(current, next) ? current : next));
  }, [location?.pathname]);

  useEffect(() => {
    const onMusicDirector = (event) => {
      const next = normalizeDirectorState(event.detail);
      setMusicDirectorState((current) => (sameDirectorState(current, next) ? current : next));
    };

    window.addEventListener(MUSIC_DIRECTOR_EVENT, onMusicDirector);
    return () => window.removeEventListener(MUSIC_DIRECTOR_EVENT, onMusicDirector);
  }, []);

  useEffect(() => {
    if (!musicEnabled) {
      stopMusic();
      return;
    }
    startMusic();
  }, [musicEnabled, startMusic, stopMusic]);

  useEffect(() => {
    const onFeedback = (event) => {
      if (!sfxEnabled) return;
      const kind = event.detail?.kind;
      const profile = FEEDBACK_FALLBACK[kind];
      const boardCue = BOARD_CUE_PROFILES[event.detail?.soundCue];
      if (!profile && !boardCue) return;

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(profile?.vibrate || (event.detail?.soundCue === 'board.danger' ? 28 : 10));
      }

      if (boardCue) playTone(boardCue);
      else playSample(kind, profile);
      if (['board.relic.resonate', 'board.danger', 'board.emergency', 'board.complete'].includes(event.detail?.soundCue)) duckMusic();
    };

    window.addEventListener(FEEDBACK_EVENT, onFeedback);
    return () => window.removeEventListener(FEEDBACK_EVENT, onFeedback);
  }, [duckMusic, playSample, playTone, sfxEnabled]);

  useEffect(() => () => {
    if (musicFadeRef.current) window.clearInterval(musicFadeRef.current);
    if (musicDuckRef.current) window.clearTimeout(musicDuckRef.current);
    activeSamplesRef.current.forEach((sample) => sample.pause?.());
    activeSamplesRef.current.clear();
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.src = '';
    }
    audioContextRef.current?.close?.();
  }, []);

  return {
    musicEnabled,
    sfxEnabled,
    musicBlocked,
    musicDirectorState,
    musicTrack,
    toggleMusic,
    toggleSfx,
  };
}
