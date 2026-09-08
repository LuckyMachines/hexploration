import path from 'node:path';

export const REQUIRED_VIEW_IDS = Object.freeze([
  'front',
  'front-right',
  'back-right',
  'back',
  'back-left',
  'front-left',
]);

export function validate3dManifest(direction, sourceManifest, manifest) {
  const errors = [];
  if (manifest.artDirectionVersion !== direction.version) {
    errors.push(`3D manifest expects art direction ${manifest.artDirectionVersion}, loaded ${direction.version}`);
  }

  const sheet = manifest.generation?.sheet || {};
  if (!Number.isInteger(sheet.width) || !Number.isInteger(sheet.height)) errors.push('Generation sheet needs integer dimensions');
  if (sheet.columns !== 3 || sheet.rows !== 2) errors.push('Generation sheet must use the canonical 3x2 layout');
  if (sheet.width % sheet.columns !== 0 || sheet.height % sheet.rows !== 0) errors.push('Generation sheet cells must divide evenly');

  const views = manifest.generation?.views || [];
  if (views.length < 6) errors.push('At least six views are required for every 3D source asset');
  const viewIds = views.map((view) => view.id);
  for (const id of REQUIRED_VIEW_IDS) if (!viewIds.includes(id)) errors.push(`Missing canonical view: ${id}`);
  if (new Set(viewIds).size !== viewIds.length) errors.push('3D view ids must be unique');
  if (new Set(views.map((view) => view.cell)).size !== views.length) errors.push('3D view cells must be unique');

  const sourceById = new Map((sourceManifest.assets || []).map((asset) => [asset.id, asset]));
  const ids = new Set();
  for (const asset of manifest.assets || []) {
    if (!asset.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.id)) errors.push(`Invalid 3D asset id: ${asset.id || '(missing)'}`);
    if (ids.has(asset.id)) errors.push(`Duplicate 3D asset id: ${asset.id}`);
    ids.add(asset.id);
    const source = sourceById.get(asset.sourceAssetId);
    if (!source) errors.push(`${asset.id}: source asset ${asset.sourceAssetId} does not exist`);
    else if (source.status !== 'approved') errors.push(`${asset.id}: source asset must be approved, received ${source.status}`);
    if (!Number.isInteger(asset.seed)) errors.push(`${asset.id}: seed must be an integer`);
    if (!Number.isInteger(asset.decimationTarget) || asset.decimationTarget < 10000) errors.push(`${asset.id}: decimationTarget must be at least 10000`);
    if (!asset.physicalBrief?.trim()) errors.push(`${asset.id}: physicalBrief is required`);
    if (!['2x2', '4x1'].includes(asset.cardinalCrop?.layout)) errors.push(`${asset.id}: cardinalCrop.layout must be 2x2 or 4x1`);
    if (asset.cardinalCrop?.regions) {
      for (const role of ['front', 'right', 'back', 'left']) {
        const region = asset.cardinalCrop.regions[role];
        if (!region) {
          errors.push(`${asset.id}: cardinalCrop.regions is missing ${role}`);
          continue;
        }
        for (const key of ['x', 'y', 'width', 'height']) {
          if (!Number.isInteger(region[key]) || region[key] < 0 || (['width', 'height'].includes(key) && region[key] === 0)) {
            errors.push(`${asset.id}: cardinalCrop.regions.${role}.${key} must be a ${['width', 'height'].includes(key) ? 'positive' : 'non-negative'} integer`);
          }
        }
        if (region.x + region.width > 1024 || region.y + region.height > 1024) {
          errors.push(`${asset.id}: cardinalCrop.regions.${role} exceeds the 1024x1024 provider sheet`);
        }
      }
    }
  }
  if ((manifest.assets || []).length === 0) errors.push('3D manifest needs at least one asset');
  return errors;
}

function compactParts(parts) {
  return parts.filter(Boolean).map((part) => String(part).trim()).filter(Boolean).join(' ');
}

export function buildFluxTurntablePrompt(direction, source, entry, manifest) {
  const views = manifest.generation.views
    .map((view, index) => `cell ${index + 1}: ${view.id} view at ${view.yaw} degrees yaw`)
    .join('; ');
  return compactParts([
    'Create one exact six-view object turnaround contact sheet for 3D reconstruction.',
    source.prompt.primaryRequest,
    source.prompt.subject,
    entry.physicalBrief,
    `Layout: an exact 3 columns by 2 rows grid, read left to right then top to bottom: ${views}.`,
    'Every cell shows the same single object with identical proportions, construction, colors, materials, wear, and light placement. Rotate only the object around a fixed vertical axis. Keep camera distance, orthographic-like lens, elevation, scale, pose, and vertical alignment identical in all six cells.',
    `Use a perfectly flat uniform ${manifest.generation.sheet.background} background across the entire sheet. No floor plane, horizon, cast shadow, reflection, platform, border, gutter, divider, caption, label, arrows, numbers, text, logo, watermark, or detached debris.`,
    'Show the complete object in every cell with generous even padding. Reveal plausible back and side construction; do not mirror the front, invent extra parts, or change silhouette between views.',
    `Xenovoya material language: ${direction.materials.join('; ')}.`,
    `Continuity: ${direction.continuityLocks.join(' ')}`,
    `Avoid: ${[...direction.globalAvoid, ...(source.prompt.constraints || [])].join('; ')}.`,
  ]);
}

export function buildConsistencyPrompt(direction, source, entry, manifest) {
  const views = manifest.generation.views
    .map((view, index) => `cell ${index + 1} is ${view.id}, ${view.yaw} degrees yaw`)
    .join('; ');
  return compactParts([
    'Create the canonical six-view identity-locked object turnaround used as image conditioning for 3D reconstruction.',
    'INPUT ROLE 1: the approved Xenovoya identity reference. Preserve its unmistakable silhouette, part count, proportions, palette, materials, wear, and localized lights.',
    'INPUT ROLE 2: the FLUX.2-pro six-view draft. Preserve its camera sequence and useful rear/side construction, but correct all cross-view identity drift against input 1.',
    source.prompt.primaryRequest,
    source.prompt.subject,
    entry.physicalBrief,
    `Output one exact 1536x1024 image with an invisible 3 by 2 equal-cell layout: ${views}.`,
    'The same single physical object appears once per cell. Rotate only the object around a fixed vertical axis. Lock camera distance, near-orthographic lens, camera elevation, scale, vertical alignment, materials, construction, and illumination across all cells. Every part visible in one view must resolve coherently in adjacent and opposite views.',
    `Background must be perfectly uniform ${manifest.generation.sheet.background}. No visible grid, gutters, dividers, floor, horizon, cast shadow, reflection, platform, caption, label, arrows, text, pseudo-text, logo, watermark, or loose fragments.`,
    'Show the complete object in every cell with equal generous padding and crisp clean separation from the background. Do not redesign, simplify, decorate, mirror, or add components.',
    `Xenovoya continuity: ${direction.visualDna.join(' ')} ${direction.continuityLocks.join(' ')}`,
  ]);
}

export function buildCardinalPrompt(direction, source, entry) {
  return compactParts([
    'Create one strict four-view orthographic object turnaround for view-aware 3D reconstruction.',
    'INPUT ROLE 1: the approved Xenovoya identity reference. Preserve its unmistakable silhouette, part count, proportions, palette, materials, wear, and localized lights.',
    'INPUT ROLE 2: the FLUX.2-pro turnaround draft. Use only its useful thickness and rear-construction evidence; remove pseudo-text and reject any redesign.',
    'INPUT ROLE 3: the GPT Image 2 six-view identity sheet. Use it to keep one identical physical object across every cell.',
    source.prompt.primaryRequest,
    source.prompt.subject,
    entry.physicalBrief,
    'Output one exact 1024x1024 square image divided invisibly into four equal 512x512 cells. Top-left: exact FRONT elevation at 0 degrees yaw. Top-right: exact RIGHT SIDE profile at 90 degrees yaw. Bottom-left: exact BACK elevation at 180 degrees yaw. Bottom-right: exact LEFT SIDE profile at 270 degrees yaw.',
    'These are four orthographic elevations, not three-quarter views. The right and left cells must show true narrow side profiles. The front and back cells must face the camera squarely. Rotate only the same rigid object around one fixed vertical axis. Lock camera elevation, scale, center, construction, materials, and lighting.',
    'Fill the entire background with perfectly uniform saturated cyan-blue #00AEEF. No visible grid, gutter, divider, floor, horizon, platform, shadow, reflection, caption, label, arrow, number, text, pseudo-text, logo, watermark, or loose fragments.',
    'Show the complete object in every cell with generous equal padding. Every component must resolve in the adjacent and opposite elevations. Do not mirror the front to fake the back. Do not add handles, barrels, grips, buttons, dials, or consumer-device features.',
    `Xenovoya continuity: ${direction.visualDna.join(' ')} ${direction.continuityLocks.join(' ')}`,
  ]);
}

export function cellGeometry(manifest, view) {
  const sheet = manifest.generation.sheet;
  const width = sheet.width / sheet.columns;
  const height = sheet.height / sheet.rows;
  const column = view.cell % sheet.columns;
  const row = Math.floor(view.cell / sheet.columns);
  return { width, height, x: column * width, y: row * height };
}

export function assetPaths(repoRoot, assetId) {
  const root = path.join(repoRoot, 'artifacts', 'art', '3d', assetId);
  const viewRoot = path.join(root, 'views');
  return {
    root,
    prompts: path.join(root, 'prompts'),
    raw: path.join(root, 'raw'),
    rawCropRoot: path.join(root, 'raw', 'crops'),
    viewRoot,
    fluxProviderOutput: path.join(root, 'raw', `${assetId}-flux-provider-output.jpg`),
    fluxSheet: path.join(root, 'raw', `${assetId}-flux-six-view.png`),
    canonicalProviderOutput: path.join(root, 'raw', `${assetId}-gpt-image-2-provider-output.png`),
    canonicalSheet: path.join(root, 'raw', `${assetId}-gpt-image-2-six-view.png`),
    cardinalProviderOutput: path.join(root, 'raw', `${assetId}-gpt-image-2-cardinal-provider-output.png`),
    cardinalSheet: path.join(root, 'raw', `${assetId}-gpt-image-2-cardinal-four-view.png`),
    cardinalRawCropRoot: path.join(root, 'raw', 'cardinal-crops'),
    cardinalRoot: path.join(root, 'cardinal-views'),
    receipt: path.join(root, `${assetId}-generation.receipt.json`),
    model: path.join(root, `${assetId}-trellis2-multiview.glb`),
    experimentalModel: path.join(root, `${assetId}-trellis2-multiimage-experimental.glb`),
    contactSheet: path.join(repoRoot, 'artifacts', 'art', '3d', 'reviews', `${assetId}-views.png`),
    modelReviewRoot: path.join(repoRoot, 'artifacts', 'art', '3d', 'reviews', `${assetId}-trellis2-cardinal`),
    modelContactSheet: path.join(repoRoot, 'artifacts', 'art', '3d', 'reviews', `${assetId}-trellis2-cardinal-contact.png`),
    experimentalModelReviewRoot: path.join(repoRoot, 'artifacts', 'art', '3d', 'reviews', `${assetId}-trellis2-six-view`),
    experimentalModelContactSheet: path.join(repoRoot, 'artifacts', 'art', '3d', 'reviews', `${assetId}-trellis2-six-view-contact.png`),
  };
}

export function buildTrellisArgs(toolRoot, config, entry, viewPaths, outputPath) {
  const args = [
    path.join(toolRoot, 'scripts', 'submit.py'),
    '--server', config.server,
    '--mode', config.mode,
  ];
  if (config.mode === 'multiimage') {
    for (const view of viewPaths) args.push('--view', view.path);
  } else if (config.mode === 'multiview') {
    const byId = new Map(viewPaths.map((view) => [view.id, view.path]));
    for (const role of ['front', 'right', 'back', 'left']) {
      const sourceId = config.semanticViewMap?.[role];
      const viewPath = byId.get(sourceId);
      if (!viewPath) throw new Error(`TRELLIS multiview is missing ${role} source ${sourceId}`);
      args.push(`--${role}`, viewPath);
    }
  } else {
    throw new Error(`Unsupported TRELLIS input mode: ${config.mode}`);
  }
  args.push(
    '--seed', String(entry.seed),
    '--pipeline', config.pipeline,
    '--steps', String(config.steps),
    '--sparse-resolution', String(config.sparseResolution),
    '--max-tokens', String(config.maxTokens),
    '--texture-size', String(config.textureSize),
    '--decimation-target', String(entry.decimationTarget),
    '--sampler', config.sampler,
    '--front-axis', config.frontAxis,
    '--blend-temperature', String(config.blendTemperature),
    '--dino-lock', String(config.dinoLock),
    '--dino-substeps', String(config.dinoSubsteps),
    '--dino-foundation-cap', String(config.dinoFoundationCap),
    '--conditioning-subject-scale', String(config.conditioningSubjectScale),
    '--hole-fill-algorithm', config.holeFillAlgorithm,
    '--hole-iterations', String(config.holeIterations),
    '--output', outputPath,
  );
  return args;
}
