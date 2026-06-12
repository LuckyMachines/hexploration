import { useCallback, useEffect, useRef, useState } from 'react';
import { FEEDBACK_EVENT } from '../lib/feedbackEvents';
import {
  DEFAULT_MUSIC_TRACK_ID,
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
  const sampleCacheRef = useRef(new Map());
  const musicTrack = MUSIC_TRACK_BY_ID[musicDirectorState.trackId] || MUSIC_TRACK_BY_ID[DEFAULT_MUSIC_TRACK_ID];

  const playTone = useCallback((profile) => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;

    try {
      audioContextRef.current ||= new AudioContextCtor();
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      oscillator.type = profile.type;
      oscillator.frequency.setValueAtTime(profile.frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(profile.gain, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.09);
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
    sample.volume = asset.volume;
    sample.play().catch(() => playTone(fallback));
  }, [playTone]);

  const startMusic = useCallback(async () => {
    if (typeof Audio === 'undefined') return false;
    musicRef.current ||= new Audio();
    const music = musicRef.current;

    if (music.__trackId !== musicTrack.id) {
      music.pause();
      music.src = musicTrack.src;
      music.currentTime = 0;
      music.__trackId = musicTrack.id;
    }

    music.loop = true;
    music.preload = 'auto';
    music.volume = musicTrack.volume ?? 0.34;

    try {
      await music.play();
      setMusicBlocked(false);
      return true;
    } catch {
      setMusicBlocked(true);
      return false;
    }
  }, [musicTrack]);

  const stopMusic = useCallback(() => {
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
      if (!profile) return;

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(profile.vibrate);
      }

      playSample(kind, profile);
    };

    window.addEventListener(FEEDBACK_EVENT, onFeedback);
    return () => window.removeEventListener(FEEDBACK_EVENT, onFeedback);
  }, [playSample, sfxEnabled]);

  useEffect(() => () => {
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
