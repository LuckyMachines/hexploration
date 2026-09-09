const STATUS_ORDER = ['brief-ready', 'candidate', 'approved', 'reference', 'retired'];

export function findAsset(manifest, assetId) {
  const asset = manifest.assets.find((item) => item.id === assetId);
  if (!asset) throw new Error(`Unknown asset: ${assetId}`);
  return asset;
}

export function buildPrompt(direction, manifest, assetId) {
  const asset = findAsset(manifest, assetId);
  const type = direction.assetTypes.find((item) => item.id === asset.assetType);
  const emotion = direction.emotions.find((item) => item.id === asset.emotionalBeat);
  const role = direction.partRoles.find((item) => item.id === asset.partRole);
  if (!type || !emotion || !role) throw new Error(`Asset ${assetId} references an unavailable art module`);

  const captureOnly = asset.family === 'proof';
  const references = asset.references.length > 0
    ? asset.references.map((reference, index) => `Image ${index + 1}: ${reference.path} (${reference.role})`).join('; ')
    : 'None';
  const palette = direction.palette.map((swatch) => `${swatch.id} ${swatch.hex} for ${swatch.job}`).join('; ');
  const constraints = [...direction.continuityLocks, ...asset.prompt.constraints].join('; ');
  const characterEdit = asset.family === 'character-condition';
  const identityLines = characterEdit ? [
    `Canonical character ID: ${asset.character?.id}`,
    `Identity locks: ${(asset.prompt.identityLocks || []).join('; ')}`,
    'Identity requirement: edit the supplied canonical image; preserve the exact same person, age, face, hair, proportions, costume construction, equipment placement, and apparent scale.',
  ] : [];

  return [
    `Production mode: ${captureOnly ? 'deterministic product capture; do not use image generation' : characterEdit ? 'identity-preserving edit of the canonical character reference' : 'generate a new raster candidate'}`,
    `Use case: ${type.useCase}`,
    `Asset ID: ${asset.id}`,
    `Asset type: ${type.id}; ${role.purpose}`,
    `Primary request: ${asset.prompt.primaryRequest}`,
    `Input images: ${references}`,
    `Scene/backdrop: ${asset.prompt.scene}`,
    `Subject: ${asset.prompt.subject}`,
    ...identityLines,
    'Style/medium: restrained cinematic game art with tactile mineral materials and precise expedition-instrument geometry',
    `Composition/framing: ${asset.prompt.composition}`,
    `Lighting/mood: ${asset.prompt.lighting}`,
    `Color palette: ${palette}`,
    `Materials/textures: ${direction.materials.join('; ')}`,
    `Emotional job: ${emotion.job} Signals: ${emotion.visualSignals.join('; ')} Payoff: ${emotion.payoff}`,
    `Delivery contract: ${asset.output.width}x${asset.output.height} ${asset.output.format.toUpperCase()}; ${asset.output.alpha ? 'genuinely transparent alpha' : 'opaque'}; safe zone ${asset.output.safeZone}; maximum ${asset.output.maxBytes} bytes after export`,
    `Constraints: ${constraints}`,
    `Avoid: ${[...direction.globalAvoid, emotion.avoid].join('; ')}`,
    ...(asset.prompt.variationDirection ? [`Variation direction: ${asset.prompt.variationDirection}`] : []),
  ].join('\n');
}

export function buildCompositionPlan(direction, manifest, compositionId) {
  const composition = manifest.compositions.find((item) => item.id === compositionId);
  if (!composition) throw new Error(`Unknown composition: ${compositionId}`);
  const emotion = direction.emotions.find((item) => item.id === composition.emotionalBeat);
  const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const lines = [
    `Composition: ${composition.name} (${composition.id})`,
    `Emotional job: ${emotion.job}`,
    `Rule: ${composition.rule}`,
    'Layer stack:',
  ];
  composition.slots.forEach((slot, index) => {
    const asset = assets.get(slot.assetId);
    lines.push(`${index + 1}. ${slot.role.toUpperCase()} - ${asset.name} [${asset.status}]${slot.required ? ' required' : ' optional'}`);
  });
  lines.push('Runtime data and UI copy must remain code-native and must not be baked into generative art.');
  return lines.join('\n');
}

export function summarizeArtSystem(direction, manifest) {
  const statuses = Object.fromEntries(STATUS_ORDER.map((status) => [status, 0]));
  const emotions = Object.fromEntries(direction.emotions.map((emotion) => [emotion.id, 0]));
  for (const asset of manifest.assets) {
    statuses[asset.status] = (statuses[asset.status] || 0) + 1;
    emotions[asset.emotionalBeat] = (emotions[asset.emotionalBeat] || 0) + 1;
  }
  return {
    assets: manifest.assets.length,
    compositions: manifest.compositions.length,
    statuses,
    emotions,
  };
}
