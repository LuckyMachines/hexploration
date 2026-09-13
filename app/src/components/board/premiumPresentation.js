export const PRESENTATION_DURATION_MS = 760;

export function presentationDurationMs() {
  const requestedScale = typeof window === 'undefined' ? 1 : Number(window.__XENOVOYA_PRESENTATION_SCALE__ || 1);
  const scale = Number.isFinite(requestedScale) ? Math.min(8, Math.max(1, requestedScale)) : 1;
  return PRESENTATION_DURATION_MS * scale;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function premiumBeatKey(state = {}, beat = {}) {
  return [
    beat.id || 'planning-open',
    state.phase || 'planning',
    state.intentAlias || '',
    state.currentLocation || '',
    Number(state.source?.turn || 0),
  ].join(':');
}

export function presentationStage(progress) {
  const value = clamp01(progress);
  if (value < 0.2) return 'anticipation';
  if (value < 0.68) return 'action';
  if (value < 0.86) return 'impact';
  return 'settle';
}

export function presentationFrame({ startedAt = 0, now = 0, resolving = false } = {}) {
  const progress = clamp01((Number(now) - Number(startedAt)) / presentationDurationMs());
  const actionProgress = smoothstep((progress - 0.16) / 0.64);
  const impactProgress = smoothstep((progress - 0.62) / 0.2);
  const settleProgress = smoothstep((progress - 0.82) / 0.18);
  const anticipation = smoothstep(progress / 0.2);
  const impactPulse = Math.sin(Math.PI * clamp01((progress - 0.58) / 0.3));

  return Object.freeze({
    progress,
    stage: resolving ? presentationStage(progress) : 'settle',
    travel: resolving ? actionProgress : 0,
    lift: resolving ? Math.sin(Math.PI * actionProgress) * 0.2 : 0,
    squash: resolving ? 1 - anticipation * 0.035 + impactProgress * 0.055 - settleProgress * 0.02 : 1,
    impactPulse: resolving ? Math.max(0, impactPulse) : 0,
    lensPulse: resolving ? Math.sin(Math.PI * progress) : 0,
    complete: progress >= 1,
  });
}
