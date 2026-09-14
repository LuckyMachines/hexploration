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

  const runtime = manifest.runtime || {};
  if (!Number.isInteger(runtime.maxMaterials) || runtime.maxMaterials < 1) errors.push('Runtime maxMaterials must be a positive integer');
  if (!Number.isInteger(runtime.maxTextures) || runtime.maxTextures < 1) errors.push('Runtime maxTextures must be a positive integer');
  if (!Array.isArray(runtime.allowedRequiredExtensions)) errors.push('Runtime allowedRequiredExtensions must be an array');
  if (!Array.isArray(runtime.lods) || runtime.lods.length < 2) errors.push('Runtime preparation needs at least two LOD contracts');
  const lodIds = new Set();
  for (const lod of runtime.lods || []) {
    if (!lod.id || !/^lod[0-9]+$/.test(lod.id)) errors.push(`Invalid runtime LOD id: ${lod.id || '(missing)'}`);
    if (lodIds.has(lod.id)) errors.push(`Duplicate runtime LOD id: ${lod.id}`);
    lodIds.add(lod.id);
    if (!(lod.simplifyRatio > 0 && lod.simplifyRatio <= 1)) errors.push(`${lod.id || 'runtime LOD'}: simplifyRatio must be above 0 and at most 1`);
    if (!(lod.simplifyError > 0 && lod.simplifyError <= 1)) errors.push(`${lod.id || 'runtime LOD'}: simplifyError must be above 0 and at most 1`);
    for (const key of ['textureSize', 'maxBytes', 'maxTriangles', 'maxVertices']) {
      if (!Number.isInteger(lod[key]) || lod[key] < 1) errors.push(`${lod.id || 'runtime LOD'}: ${key} must be a positive integer`);
    }
  }

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
    for (const key of ['matteMode', 'orbitMatteMode', 'cardinalMatteMode']) {
      if (asset[key] && !['soft-color', 'connected-border'].includes(asset[key])) {
        errors.push(`${asset.id}: ${key} must be soft-color or connected-border`);
      }
    }
    if (asset.cardinalReferenceMode && !['all', 'identity-only'].includes(asset.cardinalReferenceMode)) {
      errors.push(`${asset.id}: cardinalReferenceMode must be all or identity-only`);
    }
    for (const [lodId, ratio] of Object.entries(asset.lodSimplifyRatios || {})) {
      if (!lodIds.has(lodId)) errors.push(`${asset.id}: lodSimplifyRatios references unknown ${lodId}`);
      if (!(ratio > 0 && ratio <= 1)) errors.push(`${asset.id}: ${lodId} simplify ratio must be above 0 and at most 1`);
    }
    for (const [lodId, overrides] of Object.entries(asset.lodBudgetOverrides || {})) {
      if (!lodIds.has(lodId)) errors.push(`${asset.id}: lodBudgetOverrides references unknown ${lodId}`);
      for (const [key, value] of Object.entries(overrides || {})) {
        if (!['maxBytes', 'maxTriangles', 'maxVertices'].includes(key)) errors.push(`${asset.id}: unsupported ${lodId} budget override ${key}`);
        else if (!Number.isInteger(value) || value < 1) errors.push(`${asset.id}: ${lodId} ${key} override must be a positive integer`);
      }
    }
    for (const [key, value] of Object.entries(asset.materialOverride || {})) {
      if (['metallicFactor', 'roughnessFactor'].includes(key)) {
        if (!Number.isFinite(value) || value < 0 || value > 1) errors.push(`${asset.id}: ${key} must be between 0 and 1`);
      } else if (key === 'baseColorRemap') {
        for (const colorKey of ['shadow', 'highlight']) {
          if (!/^#[0-9a-f]{6}$/i.test(value?.[colorKey] || '')) errors.push(`${asset.id}: baseColorRemap.${colorKey} must be a hex color`);
        }
        for (const pointKey of ['blackPoint', 'whitePoint']) {
          if (value?.[pointKey] !== undefined && (!Number.isFinite(value[pointKey]) || value[pointKey] < 0 || value[pointKey] > 1)) {
            errors.push(`${asset.id}: baseColorRemap.${pointKey} must be between 0 and 1`);
          }
        }
        if (value?.gamma !== undefined && (!Number.isFinite(value.gamma) || value.gamma <= 0 || value.gamma > 4)) {
          errors.push(`${asset.id}: baseColorRemap.gamma must be above 0 and at most 4`);
        }
      } else errors.push(`${asset.id}: unsupported material override ${key}`);
    }
    if (asset.matteFuzzPercent !== undefined && (!(asset.matteFuzzPercent >= 0) || asset.matteFuzzPercent > 30)) {
      errors.push(`${asset.id}: matteFuzzPercent must be between 0 and 30`);
    }
    if (asset.orbitCrop) {
      const cellWidth = sheet.width / sheet.columns;
      const cellHeight = sheet.height / sheet.rows;
      const horizontal = (asset.orbitCrop.leftInset || 0) + (asset.orbitCrop.rightInset || 0);
      const vertical = (asset.orbitCrop.topInset || 0) + (asset.orbitCrop.bottomInset || 0);
      if (horizontal >= cellWidth || vertical >= cellHeight) errors.push(`${asset.id}: orbitCrop removes the complete source cell`);
    }
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

export function validateTransparentView(observed, { minCoverage = 0.02, maxCoverage = 0.85 } = {}) {
  const errors = [];
  if (observed.width !== 512 || observed.height !== 512) errors.push(`expected 512x512, received ${observed.width}x${observed.height}`);
  if (!observed.channels?.includes('a') || observed.opaque) errors.push('expected visible alpha');
  if (!Number.isFinite(observed.alphaMean)) errors.push('alpha coverage could not be measured');
  else if (observed.alphaMean < minCoverage) errors.push(`visible subject coverage ${observed.alphaMean.toFixed(4)} is below ${minCoverage}`);
  else if (observed.alphaMean > maxCoverage) errors.push(`visible subject coverage ${observed.alphaMean.toFixed(4)} exceeds ${maxCoverage}`);
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
  const identityOnly = entry.cardinalReferenceMode === 'identity-only';
  return compactParts([
    'Create one strict four-view orthographic object turnaround for view-aware 3D reconstruction.',
    'CRITICAL OUTPUT CONTRACT: the image may contain only four object renders on flat saturated cyan-blue. Do not draw view names, captions, letters, numbers, grid lines, dividers, borders, panels, guides, or any other graphic-design element.',
    identityOnly
      ? 'SOLE INPUT: the GPT Image 2 six-view identity sheet is the canonical object. Match its silhouette, proportions, construction, palette, materials, and captured components exactly. Do not revert to any earlier 2D concept or alternate silhouette.'
      : 'INPUT ROLE 1: the approved Xenovoya identity reference. Preserve its unmistakable silhouette, proportions, palette, materials, wear, and localized lights except where the REWORK TARGET explicitly replaces a fragile or floating feature. The REWORK TARGET is authoritative wherever it conflicts with an input.',
    identityOnly ? null : 'INPUT ROLE 2: the FLUX.2-pro turnaround draft. Use only its useful thickness and rear-construction evidence; remove pseudo-text and reject any redesign.',
    identityOnly ? null : 'INPUT ROLE 3: the GPT Image 2 six-view identity sheet. Use it to keep one identical physical object across every cell.',
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

export function cellGeometry(manifest, view, crop = {}) {
  const sheet = manifest.generation.sheet;
  const cellWidth = sheet.width / sheet.columns;
  const cellHeight = sheet.height / sheet.rows;
  const column = view.cell % sheet.columns;
  const row = Math.floor(view.cell / sheet.columns);
  const top = crop.topInset || 0;
  const right = crop.rightInset || 0;
  const bottom = crop.bottomInset || 0;
  const left = crop.leftInset || 0;
  return {
    width: cellWidth - left - right,
    height: cellHeight - top - bottom,
    x: column * cellWidth + left,
    y: row * cellHeight + top,
  };
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
    runtimeRoot: path.join(root, 'runtime'),
    runtimeReceipt: path.join(root, 'runtime', `${assetId}-runtime.receipt.json`),
    runtimeModels: {
      lod0: path.join(root, 'runtime', `${assetId}-lod0.glb`),
      lod1: path.join(root, 'runtime', `${assetId}-lod1.glb`),
      lod2: path.join(root, 'runtime', `${assetId}-lod2.glb`),
    },
    runtimeReviewRoot: path.join(repoRoot, 'artifacts', 'art', '3d', 'reviews', `${assetId}-runtime`),
    runtimeContactSheet: path.join(repoRoot, 'artifacts', 'art', '3d', 'reviews', `${assetId}-runtime-contact.png`),
  };
}

export function inspectGlbBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('Expected a binary glTF 2.0 buffer');
  }
  if (buffer.readUInt32LE(4) !== 2) throw new Error('Only binary glTF 2.0 is supported');
  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength !== buffer.length) throw new Error(`GLB length mismatch: header ${declaredLength}, file ${buffer.length}`);
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a || 20 + jsonLength > buffer.length) throw new Error('GLB JSON chunk is missing or invalid');
  const document = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).replace(/\u0000+$/g, '').trim());
  const accessors = document.accessors || [];
  let triangles = 0;
  let vertices = 0;
  let primitives = 0;
  for (const mesh of document.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      primitives += 1;
      const positionAccessor = accessors[primitive.attributes?.POSITION];
      const indexAccessor = accessors[primitive.indices];
      vertices += positionAccessor?.count || 0;
      if ((primitive.mode ?? 4) === 4) triangles += Math.floor((indexAccessor?.count || positionAccessor?.count || 0) / 3);
    }
  }
  return {
    bytes: buffer.length,
    triangles,
    vertices,
    primitives,
    materials: (document.materials || []).length,
    textures: (document.textures || []).length,
    animations: (document.animations || []).length,
    extensionsUsed: document.extensionsUsed || [],
    extensionsRequired: document.extensionsRequired || [],
  };
}

export function evaluateRuntimeModel(stats, runtime, lod) {
  const failures = [];
  if (stats.bytes > lod.maxBytes) failures.push(`bytes ${stats.bytes} exceed ${lod.maxBytes}`);
  if (stats.triangles > lod.maxTriangles) failures.push(`triangles ${stats.triangles} exceed ${lod.maxTriangles}`);
  if (stats.vertices > lod.maxVertices) failures.push(`vertices ${stats.vertices} exceed ${lod.maxVertices}`);
  if (stats.materials > runtime.maxMaterials) failures.push(`materials ${stats.materials} exceed ${runtime.maxMaterials}`);
  if (stats.textures > runtime.maxTextures) failures.push(`textures ${stats.textures} exceed ${runtime.maxTextures}`);
  if (stats.animations > 0) failures.push(`unexpected animations ${stats.animations}`);
  const unsupported = stats.extensionsRequired.filter((extension) => !runtime.allowedRequiredExtensions.includes(extension));
  if (unsupported.length) failures.push(`unsupported required extensions: ${unsupported.join(', ')}`);
  return { passed: failures.length === 0, failures };
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
