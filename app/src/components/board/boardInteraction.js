export function resolvePickedAlias(intersection = null) {
  if (!intersection?.object) return '';
  const aliases = intersection.object.userData?.aliasByInstance;
  return aliases?.[intersection.instanceId] || intersection.object.userData?.alias || '';
}

export function clampBoardTarget(target = {}, world = {}) {
  const xLimit = Number(world.width || 0) * 0.42;
  const zLimit = Number(world.depth || 0) * 0.42;
  return {
    x: Math.max(-xLimit, Math.min(xLimit, Number(target.x || 0))),
    y: Math.max(0, Math.min(0.9, Number(target.y || 0))),
    z: Math.max(-zLimit, Math.min(zLimit, Number(target.z || 0))),
  };
}

export function cameraPresetAliases(action, state = {}) {
  if (action === 'intent') return state.intentAlias ? [state.intentAlias] : [];
  if (action === 'party') return Object.keys(state.playerLocationMap || {});
  return [];
}

export function pointerExceededDragThreshold(start = {}, current = {}, threshold = 5) {
  return Math.hypot(Number(current.x || 0) - Number(start.x || 0), Number(current.y || 0) - Number(start.y || 0)) > threshold;
}
