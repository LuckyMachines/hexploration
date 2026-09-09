import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const MATERIAL_CHANNELS = ['baseColor', 'normal', 'roughness', 'ao', 'height', 'emissive'];

export function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function materialOutputPaths(root, profile, { side = false } = {}) {
  const directory = path.resolve(root, profile.directory);
  return Object.fromEntries(MATERIAL_CHANNELS.map((channel) => [
    channel,
    path.join(directory, `${side ? 'side-' : ''}${channel}.webp`),
  ]));
}

export function validateMaterialSystem(system) {
  const errors = [];
  const hexColor = /^#[0-9a-f]{6}$/i;
  const finiteInRange = (value, minimum, maximum) => Number.isFinite(value) && value >= minimum && value <= maximum;
  if (!/^\d+\.\d+\.\d+$/.test(system.version || '')) errors.push('version must use semantic versioning');
  for (const channel of MATERIAL_CHANNELS) {
    if (!system.channels?.[channel]) errors.push(`missing channel contract: ${channel}`);
    else if (!['srgb', 'linear'].includes(system.channels[channel].colorSpace)) errors.push(`${channel}: colorSpace must be srgb or linear`);
  }
  for (const quality of ['high', 'balanced', 'efficient']) {
    const tier = system.qualityTiers?.[quality];
    if (!tier) {
      errors.push(`missing quality tier: ${quality}`);
      continue;
    }
    if (!finiteInRange(tier.pixelRatioCap, 1, 3)) errors.push(`${quality}: pixelRatioCap must be 1..3`);
    if (!Number.isInteger(tier.shadowMapSize) || tier.shadowMapSize < 256) errors.push(`${quality}: shadowMapSize must be an integer of at least 256`);
    if (!Number.isInteger(tier.anisotropy) || tier.anisotropy < 1) errors.push(`${quality}: anisotropy must be a positive integer`);
    for (const flag of ['shadows', 'environment', 'normalMap', 'aoMap', 'heightMap', 'compressedTextures']) {
      if (typeof tier[flag] !== 'boolean') errors.push(`${quality}: ${flag} must be boolean`);
    }
  }
  for (const rig of ['neutral', 'discovery', 'danger', 'recovery', 'relic']) {
    const definition = system.lightingRigs?.[rig];
    if (!definition) {
      errors.push(`missing lighting rig: ${rig}`);
      continue;
    }
    if (!finiteInRange(definition.exposure, 0.25, 3)) errors.push(`${rig}: exposure must be 0.25..3`);
    if (!finiteInRange(definition.environmentIntensity, 0, 3)) errors.push(`${rig}: environmentIntensity must be 0..3`);
    if (!hexColor.test(definition.fog?.color || '') || !finiteInRange(definition.fog?.density, 0, 0.2)) errors.push(`${rig}: fog requires a hex color and density from 0..0.2`);
    if (!hexColor.test(definition.hemisphere?.sky || '') || !hexColor.test(definition.hemisphere?.ground || '') || !finiteInRange(definition.hemisphere?.intensity, 0, 10)) errors.push(`${rig}.hemisphere: requires sky and ground hex colors and intensity from 0..10`);
    for (const light of ['key', 'fill', 'rim']) {
      if (!hexColor.test(definition[light]?.color || '') || !finiteInRange(definition[light]?.intensity, 0, 10)) errors.push(`${rig}.${light}: requires a hex color and intensity from 0..10`);
    }
  }
  const tiers = system.qualityTiers || {};
  if (tiers.high && tiers.balanced && tiers.efficient) {
    if (!(tiers.high.pixelRatioCap >= tiers.balanced.pixelRatioCap && tiers.balanced.pixelRatioCap >= tiers.efficient.pixelRatioCap)) errors.push('quality tier pixelRatioCap must decrease from high to efficient');
    if (!(tiers.high.anisotropy >= tiers.balanced.anisotropy && tiers.balanced.anisotropy >= tiers.efficient.anisotropy)) errors.push('quality tier anisotropy must decrease from high to efficient');
  }
  const tileTypes = new Set();
  const ids = new Set();
  for (const profile of system.materials || []) {
    if (ids.has(profile.id)) errors.push(`duplicate material id: ${profile.id}`);
    if (tileTypes.has(profile.tileType)) errors.push(`duplicate material tileType: ${profile.tileType}`);
    ids.add(profile.id);
    tileTypes.add(profile.tileType);
    if (!profile.label || !profile.source || !profile.directory) errors.push(`${profile.id}: label, source, and directory are required`);
    if (!Array.isArray(profile.story) || profile.story.length !== 3) errors.push(`${profile.id}: story requires base, deposit, and signal`);
    if (!hexColor.test(profile.tint || '') || !hexColor.test(profile.sideTint || '') || !hexColor.test(profile.emissiveColor || '')) errors.push(`${profile.id}: tint, sideTint, and emissiveColor must be hex colors`);
    if (!Number.isFinite(profile.roughness) || profile.roughness < 0 || profile.roughness > 1) errors.push(`${profile.id}: roughness must be 0..1`);
    if (!Number.isFinite(profile.metalness) || profile.metalness < 0 || profile.metalness > 1) errors.push(`${profile.id}: metalness must be 0..1`);
    if (!finiteInRange(profile.bumpScale, 0, 0.2)) errors.push(`${profile.id}: bumpScale must be 0..0.2`);
    if (!finiteInRange(profile.normalScale, 0, 2)) errors.push(`${profile.id}: normalScale must be 0..2`);
    if (!finiteInRange(profile.aoIntensity, 0, 2)) errors.push(`${profile.id}: aoIntensity must be 0..2`);
    if (!finiteInRange(profile.emissiveIntensity, 0, 2)) errors.push(`${profile.id}: emissiveIntensity must be 0..2`);
    if (!finiteInRange(profile.uv?.repeat, 0.1, 8) || !finiteInRange(profile.uv?.jitter, 0, 1) || !Number.isInteger(profile.uv?.rotationSteps) || profile.uv.rotationSteps < 1) errors.push(`${profile.id}: uv requires bounded repeat, jitter, and positive integer rotationSteps`);
  }
  for (let tileType = 1; tileType <= 6; tileType += 1) {
    if (!tileTypes.has(tileType)) errors.push(`tileType ${tileType} has no surface profile`);
  }
  const contract = system.qualityContract || {};
  if (!Array.isArray(contract.dimensions) || contract.dimensions.length !== 2 || contract.dimensions.some((value) => !Number.isInteger(value) || value < 64)) errors.push('qualityContract.dimensions must contain two integers of at least 64');
  for (const field of ['maxBytesPerMap', 'maxEdgeMeanDifference', 'minimumRelationalScore']) {
    if (!Number.isFinite(contract[field]) || contract[field] <= 0) errors.push(`qualityContract.${field} must be positive`);
  }
  for (const [field, value] of Object.entries(contract.performance || {})) {
    if (!Number.isFinite(value) || value <= 0) errors.push(`qualityContract.performance.${field} must be positive`);
  }
  for (const rigId of contract.captureRigs || []) if (!system.lightingRigs?.[rigId]) errors.push(`captureRigs references unknown rig: ${rigId}`);
  for (const tierId of contract.captureQualities || []) if (!system.qualityTiers?.[tierId]) errors.push(`captureQualities references unknown tier: ${tierId}`);
  return errors;
}

export function validateMaterialRuntimeEvidence(runtime, system) {
  const errors = [];
  const performance = system.qualityContract?.performance || {};
  if (!runtime?.board) errors.push('integrated board runtime evidence is missing');
  else {
    if (runtime.board.materialSystemVersion !== system.version) errors.push('integrated board runtime evidence targets a stale material-system version');
    const states = runtime.board.states || [];
    for (const requiredState of ['ready', 'danger']) {
      if (!states.some((state) => state.lens === requiredState)) errors.push(`integrated board runtime evidence is missing ${requiredState}`);
    }
    for (const state of states) {
      if (state.drawCalls > performance.maxDrawCalls) errors.push(`${state.lens}: ${state.drawCalls} draw calls exceed ${performance.maxDrawCalls}`);
      if (state.textures > performance.maxTextures) errors.push(`${state.lens}: ${state.textures} resident textures exceed ${performance.maxTextures}`);
      if (!Number.isFinite(state.triangles) || state.triangles <= 0) errors.push(`${state.lens}: triangle evidence is invalid`);
    }
  }
  if (!runtime?.frame) errors.push('frame pacing evidence is missing');
  else {
    const withinBudget = runtime.frame.frameP95Ms <= performance.maxFrameP95Ms;
    const adaptedToMinimum = runtime.frame.pixelRatio === 1;
    if (!withinBudget && !adaptedToMinimum) errors.push(`frame p95 ${runtime.frame.frameP95Ms} ms exceeds ${performance.maxFrameP95Ms} ms without reaching minimum pixel ratio`);
  }
  return errors;
}

export function runMagick(args, label, { quiet = false } = {}) {
  return runTool('magick', args, label, { quiet });
}

export function runTool(command, args, label, { quiet = false } = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
  if (result.error) throw new Error(`${command} unavailable while attempting ${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed: ${(result.stderr || result.stdout || '').trim()}`);
  if (!quiet && result.stdout?.trim()) process.stdout.write(result.stdout);
  return result.stdout?.trim() || '';
}

export function inspectImage(filePath) {
  if (!existsSync(filePath)) return null;
  const raw = runMagick([
    'identify', '-quiet', '-format', '%w|%h|%m|%[channels]|%[fx:mean]', filePath,
  ], `inspect ${path.basename(filePath)}`, { quiet: true });
  const [width, height, format, channels, mean] = raw.split('|');
  return { width: Number(width), height: Number(height), format, channels, mean: Number(mean) };
}

export function edgeMeanDifference(filePath, width, height) {
  const edge = 1;
  const metric = (a, b) => Number(runMagick([
    '(', filePath, '-crop', a, '+repage', ')',
    '(', filePath, '-crop', b, '+repage', ')',
    '-compose', 'difference', '-composite', '-colorspace', 'gray',
    '-format', '%[fx:mean*255]', 'info:',
  ], `measure seams in ${path.basename(filePath)}`, { quiet: true }));
  return Math.max(
    metric(`${edge}x${height}+0+0`, `${edge}x${height}+${width - edge}+0`),
    metric(`${width}x${edge}+0+0`, `${width}x${edge}+0+${height - edge}`),
  );
}

export function clippedPixelPercent(filePath) {
  const shadows = Number(runMagick([
    filePath, '-colorspace', 'gray', '-threshold', '2%', '-negate', '-format', '%[fx:100*mean]', 'info:',
  ], `measure shadow clipping in ${path.basename(filePath)}`, { quiet: true }));
  const highlights = Number(runMagick([
    filePath, '-colorspace', 'gray', '-threshold', '98%', '-format', '%[fx:100*mean]', 'info:',
  ], `measure highlight clipping in ${path.basename(filePath)}`, { quiet: true }));
  return { shadows, highlights };
}

export function materialReviewTemplate(system, profile, files) {
  return {
    materialSystemVersion: system.version,
    materialId: profile.id,
    sourceSha256: null,
    candidateSha256: Object.fromEntries(Object.entries(files).map(([channel, file]) => [channel, existsSync(file) ? sha256File(file) : null])),
    reviewer: '',
    reviewedAt: null,
    scores: {
      tileability: null,
      depthResponse: null,
      lightNeutrality: null,
      materialIdentity: null,
      stateLegibility: null,
      accessibility: null
    },
    decision: 'pending',
    notes: 'Review the standardized neutral, danger, grayscale, and thumbnail evidence before promotion.'
  };
}
