import materialSystem from '../../art-pipeline/material-system.json';

export const BOARD_QUALITY_MODES = Object.freeze({
  AUTO: 'auto',
  HIGH: 'high',
  BALANCED: 'balanced',
  EFFICIENT: 'efficient',
});

export function resolveBoardQuality({
  mode = BOARD_QUALITY_MODES.AUTO,
  deviceMemory = 8,
  hardwareConcurrency = 8,
  coarsePointer = false,
  viewportWidth = 1024,
} = {}) {
  const constrainedDevice = Number(deviceMemory) <= 4
    || Number(hardwareConcurrency) <= 4
    || (coarsePointer && Number(viewportWidth) < 900);
  const highCapacity = Number(deviceMemory) >= 8
    && Number(hardwareConcurrency) >= 8
    && !coarsePointer
    && Number(viewportWidth) >= 1180;
  const resolvedMode = mode === BOARD_QUALITY_MODES.EFFICIENT || constrainedDevice
    ? BOARD_QUALITY_MODES.EFFICIENT
    : mode === BOARD_QUALITY_MODES.HIGH || (mode === BOARD_QUALITY_MODES.AUTO && highCapacity)
      ? BOARD_QUALITY_MODES.HIGH
      : BOARD_QUALITY_MODES.BALANCED;
  const tier = materialSystem.qualityTiers[resolvedMode];

  return {
    requestedMode: mode,
    mode: resolvedMode,
    ...tier,
    dynamicResolution: resolvedMode !== BOARD_QUALITY_MODES.EFFICIENT,
  };
}

export function nextPixelRatio({ current, frameP95Ms, minimum = 1, maximum = 2, budgetMs = 24 }) {
  if (!Number.isFinite(frameP95Ms) || !Number.isFinite(current)) return current;
  if (frameP95Ms > budgetMs * 2) return minimum;
  if (frameP95Ms > budgetMs * 1.15) return Math.max(minimum, Number((current - 0.15).toFixed(2)));
  if (frameP95Ms < budgetMs * 0.62) return Math.min(maximum, Number((current + 0.1).toFixed(2)));
  return current;
}
