function sorted(values = []) {
  return [...(values || [])].map(String).sort();
}

function stableLocations(value = {}) {
  return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right)).map(([alias, indices]) => [alias, [...indices].sort((a, b) => a - b)]));
}

export function boardLayerSignatures(state = {}) {
  return Object.freeze({
    affordances: JSON.stringify({
      selected: sorted(state.selectedPath),
      reachable: sorted(state.reachableAliases),
      invalid: state.invalidAlias || '',
      intent: state.intentAlias || '',
      danger: Boolean(state.isDanger),
    }),
    intent: JSON.stringify({
      intent: state.intentAlias || '',
      action: state.activeAction,
      danger: Boolean(state.isDanger),
      encounter: state.encounterId || '',
      resolving: Boolean(state.isResolving),
      previewing: Boolean(state.signals?.isPreviewing ?? ((state.previewPath?.length || 0) > (state.selectedPath?.length || 0))),
    }),
    route: JSON.stringify({
      current: state.currentLocation || '',
      selected: state.selectedPath || [],
      preview: state.previewPath || [],
      submitted: Boolean(state.hasSubmitted),
      danger: Boolean(state.isDanger),
      invalid: state.invalidAlias || '',
    }),
    assistance: JSON.stringify({
      action: state.activeAction,
      currentPlayerIndex: state.currentPlayerIndex,
      locations: stableLocations(state.playerLocationMap),
    }),
    party: JSON.stringify({
      currentPlayerIndex: state.currentPlayerIndex,
      locations: stableLocations(state.playerLocationMap),
      crew: (state.crew || []).map((player) => ({
        characterId: player?.characterId || player?.character || '',
        hasArtifact: Boolean(player?.hasArtifact || player?.inventory?.artifact),
        stats: player?.stats || null,
      })),
      action: state.activeAction,
      resolving: Boolean(state.isResolving),
      lowStats: Boolean(state.lowStats),
    }),
  });
}

export function changedBoardLayers(previous = {}, next = {}) {
  const before = boardLayerSignatures(previous);
  const after = boardLayerSignatures(next);
  return Object.keys(after).filter((layer) => before[layer] !== after[layer]);
}

export function baseTileTransform(tile = {}) {
  return Object.freeze({
    x: Number(tile.x || 0),
    y: Number(tile.height || 0) / 2,
    z: Number(tile.z || 0),
    rotationY: Math.PI / 6,
    scaleX: 1,
    scaleY: Number(tile.height || 0),
    scaleZ: 1,
  });
}
