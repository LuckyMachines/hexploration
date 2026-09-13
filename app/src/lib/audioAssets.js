export const MUSIC_TRACKS = [
  {
    id: 'xenovoya-title-menu',
    src: '/audio/music/xenovoya-title-menu.mp3',
    title: 'Title Menu',
    state: 'Title',
    trigger: 'home / public shell / no active run',
    desc: 'Slow analog beacon, star-chart ambience, and distant metallic bells.',
    duration: 45,
    durationLabel: '45.0s',
    volume: 0.32,
  },
  {
    id: 'xenovoya-lobby-setup',
    src: '/audio/music/xenovoya-lobby-setup.mp3',
    title: 'Lobby Setup',
    state: 'Lobby',
    trigger: 'game lobby / waiting for crew / setup screens',
    desc: 'Quiet hangar room tone, equipment pulses, and patient preparation groove.',
    duration: 45,
    durationLabel: '45.0s',
    volume: 0.32,
  },
  {
    id: 'xenovoya-expedition-calm',
    src: '/audio/music/xenovoya-expedition-calm.mp3',
    title: 'Expedition Calm',
    state: 'Expedition Calm',
    trigger: 'active game / low-risk planning',
    desc: 'Dusty modular arpeggios, soft metallic percussion, and compass motif.',
    duration: 60,
    durationLabel: '60.0s',
    volume: 0.34,
  },
  {
    id: 'xenovoya-expedition-danger',
    src: '/audio/music/xenovoya-expedition-danger.mp3',
    title: 'Expedition Danger',
    state: 'Danger',
    trigger: 'high risk / invalid route pressure / redline moments',
    desc: 'Tense modular bass, urgent muted toms, warning harmonics, and survival pressure.',
    duration: 60,
    durationLabel: '60.0s',
    volume: 0.34,
  },
  {
    id: 'xenovoya-camp-recovery',
    src: '/audio/music/xenovoya-camp-recovery.mp3',
    title: 'Camp Recovery',
    state: 'Camp / Recovery',
    trigger: 'camp, rest, recovery, post-resolution breather',
    desc: 'Firelike synth crackle, filtered pads, gentle percussion, and fragile safety.',
    duration: 45,
    durationLabel: '45.0s',
    volume: 0.32,
  },
  {
    id: 'xenovoya-relic-discovery',
    src: '/audio/music/xenovoya-relic-discovery.mp3',
    title: 'Relic Discovery',
    state: 'Relic Discovery',
    trigger: 'dig / artifact found / rare beat',
    desc: 'Shimmering glass harmonics, tuned percussion, magnetic drone, and unease.',
    duration: 45,
    durationLabel: '45.0s',
    volume: 0.34,
  },
  {
    id: 'xenovoya-chain-resolving',
    src: '/audio/music/xenovoya-chain-resolving.mp3',
    title: 'Chain Resolving',
    state: 'Resolving',
    trigger: 'transaction pending / chain resolving / waiting on outcome',
    desc: 'Ticking data pulses, low sequenced synth, granular delay, and suspense.',
    duration: 45,
    durationLabel: '45.0s',
    volume: 0.31,
  },
  {
    id: 'xenovoya-victory-extraction',
    src: '/audio/music/xenovoya-victory-extraction.mp3',
    title: 'Victory Extraction',
    state: 'Victory',
    trigger: 'game over won / extraction success',
    desc: 'Bright analog brass pads, compass arpeggio, and warm major-key release.',
    duration: 45,
    durationLabel: '45.0s',
    volume: 0.34,
  },
  {
    id: 'xenovoya-defeat-lost',
    src: '/audio/music/xenovoya-defeat-lost.mp3',
    title: 'Defeat Lost',
    state: 'Defeat',
    trigger: 'game over lost / failed extraction',
    desc: 'Detuned synth elegy, broken beacon, low percussion, and distant storm noise.',
    duration: 45,
    durationLabel: '45.0s',
    volume: 0.33,
  },
  {
    id: 'xenovoya-expedition-loop',
    src: '/audio/music/xenovoya-expedition-loop.mp3',
    title: 'Expedition Loop',
    state: 'Expedition Alt',
    trigger: 'manual audition / alternate exploration bed',
    desc: 'Original ACE-Step expedition loop with analog pulse and glass harmonics.',
    duration: 60,
    durationLabel: '60.0s',
    volume: 0.34,
  },
];

export const MUSIC_TRACK_BY_ID = Object.fromEntries(
  MUSIC_TRACKS.map((track) => [track.id, track]),
);

export const DEFAULT_MUSIC_TRACK_ID = 'xenovoya-title-menu';

export const GAME_MUSIC = MUSIC_TRACK_BY_ID[DEFAULT_MUSIC_TRACK_ID];

export const FEEDBACK_AUDIO = {
  invalid: { src: '/audio/sfx/invalid.wav', volume: 0.42 },
  commit: { src: '/audio/sfx/commit.wav', volume: 0.38 },
  rush: { src: '/audio/sfx/rush.wav', volume: 0.3 },
  move: { src: '/audio/sfx/move.wav', volume: 0.24 },
  'tx-pending': { src: '/audio/sfx/tx-pending.wav', volume: 0.24 },
  'tx-confirming': { src: '/audio/sfx/tx-confirming.wav', volume: 0.22 },
  'tx-success': { src: '/audio/sfx/tx-success.wav', volume: 0.34 },
  'tx-error': { src: '/audio/sfx/tx-error.wav', volume: 0.34 },
};

export const FEEDBACK_FALLBACK = {
  invalid: { frequency: 120, type: 'square', gain: 0.024, vibrate: 34 },
  commit: { frequency: 420, type: 'triangle', gain: 0.014, vibrate: 18 },
  rush: { frequency: 330, type: 'triangle', gain: 0.016, vibrate: 12 },
  move: { frequency: 260, type: 'triangle', gain: 0.012, vibrate: 8 },
  'tx-pending': { frequency: 180, type: 'sine', gain: 0.01, vibrate: 6 },
  'tx-confirming': { frequency: 240, type: 'sine', gain: 0.01, vibrate: 6 },
  'tx-success': { frequency: 520, type: 'triangle', gain: 0.016, vibrate: 18 },
  'tx-error': { frequency: 100, type: 'square', gain: 0.02, vibrate: 30 },
};

export const BOARD_CUE_PROFILES = Object.freeze({
  'board.ready': [
    { frequency: 176, frequencyEnd: 220, type: 'sine', gain: 0.008, duration: 0.18 },
  ],
  'board.route.preview': [
    { frequency: 294, frequencyEnd: 392, type: 'triangle', gain: 0.012, duration: 0.12 },
    { frequency: 587, type: 'sine', gain: 0.006, delayMs: 68, duration: 0.14, pan: 0.18 },
  ],
  'board.commit': [
    { frequency: 110, frequencyEnd: 82, type: 'sine', gain: 0.024, duration: 0.24 },
    { frequency: 330, frequencyEnd: 495, type: 'triangle', gain: 0.012, delayMs: 42, duration: 0.18 },
  ],
  'board.resolve': [
    { frequency: 146, frequencyEnd: 220, type: 'sawtooth', gain: 0.009, duration: 0.48, pan: -0.2 },
    { frequency: 440, frequencyEnd: 660, type: 'sine', gain: 0.009, delayMs: 150, duration: 0.34, pan: 0.22 },
    { frequency: 880, type: 'sine', gain: 0.005, delayMs: 430, duration: 0.16 },
  ],
  'board.discovery': [
    { frequency: 392, frequencyEnd: 523, type: 'triangle', gain: 0.012, duration: 0.24, pan: -0.12 },
    { frequency: 784, frequencyEnd: 1047, type: 'sine', gain: 0.006, delayMs: 105, duration: 0.32, pan: 0.16 },
  ],
  'board.relic.resonate': [
    { frequency: 196, frequencyEnd: 147, type: 'sine', gain: 0.018, duration: 0.64 },
    { frequency: 587, frequencyEnd: 880, type: 'triangle', gain: 0.01, delayMs: 80, duration: 0.56, pan: -0.22 },
    { frequency: 1175, frequencyEnd: 1568, type: 'sine', gain: 0.006, delayMs: 260, duration: 0.46, pan: 0.26 },
  ],
  'board.danger': [
    { frequency: 92, frequencyEnd: 74, type: 'sawtooth', gain: 0.018, duration: 0.46 },
    { frequency: 138, type: 'square', gain: 0.008, delayMs: 180, duration: 0.15, pan: 0.2 },
  ],
  'board.recovery': [
    { frequency: 220, frequencyEnd: 330, type: 'sine', gain: 0.012, duration: 0.36 },
    { frequency: 440, type: 'triangle', gain: 0.006, delayMs: 130, duration: 0.34, pan: -0.16 },
  ],
  'board.camp.prepare': [
    { frequency: 196, frequencyEnd: 247, type: 'triangle', gain: 0.012, duration: 0.32 },
    { frequency: 98, type: 'sine', gain: 0.008, delayMs: 90, duration: 0.44 },
  ],
  'board.recovery.rest': [
    { frequency: 220, frequencyEnd: 294, type: 'sine', gain: 0.011, duration: 0.42 },
    { frequency: 440, type: 'sine', gain: 0.005, delayMs: 180, duration: 0.3 },
  ],
  'board.rescue.link': [
    { frequency: 330, frequencyEnd: 440, type: 'triangle', gain: 0.011, duration: 0.28, pan: -0.3 },
    { frequency: 440, frequencyEnd: 660, type: 'triangle', gain: 0.011, delayMs: 110, duration: 0.32, pan: 0.3 },
  ],
  'board.return': [
    { frequency: 262, frequencyEnd: 392, type: 'sine', gain: 0.012, duration: 0.38 },
    { frequency: 523, type: 'triangle', gain: 0.006, delayMs: 150, duration: 0.28 },
  ],
  'board.escape.commit': [
    { frequency: 131, frequencyEnd: 196, type: 'sawtooth', gain: 0.014, duration: 0.46 },
    { frequency: 523, frequencyEnd: 784, type: 'triangle', gain: 0.012, delayMs: 140, duration: 0.46, pan: -0.18 },
    { frequency: 1047, type: 'sine', gain: 0.007, delayMs: 420, duration: 0.4, pan: 0.2 },
  ],
  'board.emergency': [
    { frequency: 104, frequencyEnd: 78, type: 'square', gain: 0.015, duration: 0.34 },
    { frequency: 294, frequencyEnd: 220, type: 'triangle', gain: 0.009, delayMs: 190, duration: 0.4 },
  ],
  'board.complete': [
    { frequency: 262, frequencyEnd: 392, type: 'triangle', gain: 0.011, duration: 0.38 },
    { frequency: 523, frequencyEnd: 784, type: 'sine', gain: 0.007, delayMs: 170, duration: 0.42 },
  ],
});
