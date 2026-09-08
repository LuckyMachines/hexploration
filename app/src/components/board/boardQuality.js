export const BOARD_QUALITY_MODES = Object.freeze({
  AUTO: 'auto',
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
  const efficient = mode === BOARD_QUALITY_MODES.EFFICIENT || constrainedDevice;

  return {
    mode: efficient ? BOARD_QUALITY_MODES.EFFICIENT : BOARD_QUALITY_MODES.AUTO,
    pixelRatioCap: efficient ? 1 : 1.5,
    shadows: !efficient,
    shadowMapSize: efficient ? 512 : 1536,
    particleScale: efficient ? 0.42 : 1,
  };
}

