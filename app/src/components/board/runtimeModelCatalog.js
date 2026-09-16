export function approvedRuntimeModelPath(registry, assetId, lodId = 'lod2') {
  const asset = registry?.assets?.find((candidate) => candidate.id === assetId);
  if (!asset || asset.reviewDecision !== 'approved') return undefined;
  return asset.models?.find((model) => model.id === lodId)?.path;
}
