import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  buildCompositionPlan,
  buildPrompt,
  findAsset,
  summarizeArtSystem,
} from '../app/src/art-pipeline/promptBuilder.js';
import { CHARACTER_REVIEW_DIMENSIONS, scoreCharacterReview } from './character-pipeline-utils.mjs';

export { buildCompositionPlan, buildPrompt, findAsset, summarizeArtSystem };

export const VALID_ASSET_STATUSES = new Set(['brief-ready', 'candidate', 'approved', 'reference', 'retired']);

function uniqueMap(items, label, errors) {
  const map = new Map();
  for (const item of items || []) {
    if (!item?.id) {
      errors.push(`${label} entry is missing an id`);
      continue;
    }
    if (map.has(item.id)) errors.push(`Duplicate ${label} id: ${item.id}`);
    map.set(item.id, item);
  }
  return map;
}

export function resolveRepoPath(repoRoot, relativePath) {
  const resolvedRoot = path.resolve(repoRoot);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relation = path.relative(resolvedRoot, resolved);
  if (relation.startsWith('..') || path.isAbsolute(relation)) {
    throw new Error(`Path escapes the repository: ${relativePath}`);
  }
  return resolved;
}

export function loadArtSystem(repoRoot) {
  const directionPath = resolveRepoPath(repoRoot, 'app/src/art-pipeline/art-direction.json');
  const manifestPath = resolveRepoPath(repoRoot, 'app/src/art-pipeline/asset-manifest.json');
  return {
    directionPath,
    manifestPath,
    direction: JSON.parse(readFileSync(directionPath, 'utf8')),
    manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
  };
}

export function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function inspectImage(filePath) {
  const result = spawnSync(
    'magick',
    ['identify', '-quiet', '-format', '%w|%h|%m|%[channels]|%[colorspace]|%[opaque]', filePath],
    { encoding: 'utf8', windowsHide: true },
  );
  if (result.error) throw new Error(`ImageMagick is unavailable: ${result.error.message}`);
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'Image inspection failed').trim());
  const [width, height, format, channels, colorSpace, opaque] = result.stdout.trim().split('|');
  return {
    width: Number(width),
    height: Number(height),
    format: String(format || '').toLowerCase(),
    channels: String(channels || '').toLowerCase(),
    colorSpace: String(colorSpace || '').toLowerCase(),
    opaque: String(opaque || '').toLowerCase() === 'true',
    bytes: statSync(filePath).size,
  };
}

export function validateImageAgainstAsset(asset, metadata) {
  const failures = [];
  const expected = asset.output;
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    failures.push(`expected ${expected.width}x${expected.height}, received ${metadata.width}x${metadata.height}`);
  }
  if (metadata.format !== expected.format.toLowerCase()) {
    failures.push(`expected ${expected.format}, received ${metadata.format}`);
  }
  const hasAlpha = metadata.channels.includes('a');
  if (expected.alpha && !hasAlpha) failures.push(`expected an alpha channel, received ${metadata.channels || 'unknown channels'}`);
  if (expected.alpha && metadata.opaque) failures.push('expected visible transparency, but every pixel is opaque');
  if (!expected.alpha && hasAlpha) failures.push(`expected an opaque image, received ${metadata.channels}`);
  if (!expected.alpha && !metadata.opaque) failures.push('expected an opaque image, but transparent pixels are present');
  if (metadata.bytes > expected.maxBytes) failures.push(`expected at most ${expected.maxBytes} bytes, received ${metadata.bytes}`);
  if (!['srgb', 'rgb'].includes(metadata.colorSpace)) failures.push(`expected an RGB color space, received ${metadata.colorSpace || 'unknown'}`);
  return failures;
}

export function exportImage(asset, sourcePath, targetPath) {
  const expected = asset.output;
  const resizeArgs = expected.alpha
    ? ['-background', 'none', '-gravity', 'center', '-resize', `${expected.width}x${expected.height}>`, '-extent', `${expected.width}x${expected.height}`, '-alpha', 'on']
    : ['-resize', `${expected.width}x${expected.height}^`, '-gravity', 'center', '-extent', `${expected.width}x${expected.height}`, '-background', '#0d0f0a', '-alpha', 'remove', '-alpha', 'off'];
  const formatArgs = expected.format === 'webp'
    ? ['-quality', '82', '-define', 'webp:method=6']
    : expected.format === 'png'
      ? ['-define', 'png:compression-level=9']
      : [];
  const result = spawnSync(
    'magick',
    [sourcePath, '-auto-orient', '-strip', '-colorspace', 'sRGB', ...resizeArgs, ...formatArgs, targetPath],
    { encoding: 'utf8', windowsHide: true },
  );
  if (result.error) throw new Error(`ImageMagick is unavailable: ${result.error.message}`);
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'Image export failed').trim());
  const metadata = inspectImage(targetPath);
  return { metadata, failures: validateImageAgainstAsset(asset, metadata) };
}

export function validateArtSystem(direction, manifest, options = {}) {
  const { repoRoot = process.cwd(), checkFiles = false, imageInspector = inspectImage } = options;
  const errors = [];
  const warnings = [];

  if (manifest.artDirectionVersion !== direction.version) {
    errors.push(`Manifest expects art direction ${manifest.artDirectionVersion}, loaded ${direction.version}`);
  }
  if (!Array.isArray(direction.visualDna) || direction.visualDna.length < 3) errors.push('Art direction needs at least three visual DNA rules');
  if (!Array.isArray(direction.continuityLocks) || direction.continuityLocks.length < 3) errors.push('Art direction needs continuity locks');
  if (!Array.isArray(direction.globalAvoid) || direction.globalAvoid.length < 3) errors.push('Art direction needs a global avoid list');
  if (!Number.isFinite(direction.minimumJoyScore)) errors.push('Art direction needs a minimumJoyScore');
  if (!Number.isFinite(direction.minimumGateScore)) errors.push('Art direction needs a minimumGateScore');
  if (!Array.isArray(manifest.managedRoots) || manifest.managedRoots.length === 0) errors.push('Manifest needs at least one managed art root');

  const emotionMap = uniqueMap(direction.emotions, 'emotion', errors);
  const typeMap = uniqueMap(direction.assetTypes, 'asset type', errors);
  const roleMap = uniqueMap(direction.partRoles, 'part role', errors);
  const gateMap = uniqueMap(direction.qualityGates, 'quality gate', errors);
  const assetMap = uniqueMap(manifest.assets, 'asset', errors);
  const compositionMap = uniqueMap(manifest.compositions, 'composition', errors);
  const outputPaths = new Set();

  if (gateMap.size < 5) errors.push('At least five quality gates are required');

  for (const asset of manifest.assets || []) {
    const label = asset.id || 'unknown asset';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label)) errors.push(`${label}: id must use kebab-case`);
    if (!VALID_ASSET_STATUSES.has(asset.status)) errors.push(`${label}: invalid status ${asset.status}`);
    if (!emotionMap.has(asset.emotionalBeat)) errors.push(`${label}: unknown emotional beat ${asset.emotionalBeat}`);
    if (!typeMap.has(asset.assetType)) errors.push(`${label}: unknown asset type ${asset.assetType}`);
    if (!roleMap.has(asset.partRole)) errors.push(`${label}: unknown part role ${asset.partRole}`);

    const output = asset.output || {};
    if (!output.path) errors.push(`${label}: output path is required`);
    else {
      try {
        resolveRepoPath(repoRoot, output.path);
      } catch (error) {
        errors.push(`${label}: ${error.message}`);
      }
      if (outputPaths.has(output.path)) errors.push(`${label}: duplicate output path ${output.path}`);
      outputPaths.add(output.path);
    }
    if (!Number.isInteger(output.width) || output.width <= 0) errors.push(`${label}: output width must be a positive integer`);
    if (!Number.isInteger(output.height) || output.height <= 0) errors.push(`${label}: output height must be a positive integer`);
    if (!Number.isInteger(output.maxBytes) || output.maxBytes <= 0) errors.push(`${label}: output maxBytes must be a positive integer`);
    if (typeof output.alpha !== 'boolean') errors.push(`${label}: output alpha must be boolean`);
    if (!output.safeZone) errors.push(`${label}: output safeZone is required`);

    const type = typeMap.get(asset.assetType);
    if (type && type.id !== 'reference-only') {
      for (const field of ['width', 'height', 'format', 'alpha', 'maxBytes']) {
        if (output[field] !== type[field]) errors.push(`${label}: output ${field} must match asset type ${asset.assetType}`);
      }
    }

    for (const field of ['primaryRequest', 'scene', 'subject', 'composition', 'lighting']) {
      if (!asset.prompt?.[field]) errors.push(`${label}: prompt.${field} is required`);
    }
    if (!Array.isArray(asset.prompt?.constraints) || asset.prompt.constraints.length < 2) {
      errors.push(`${label}: at least two asset-specific prompt constraints are required`);
    }

    if (asset.family === 'character' || asset.family === 'character-condition') {
      if (!asset.character?.id) errors.push(`${label}: character.id is required`);
      if (!asset.character?.state) errors.push(`${label}: character.state is required`);
      if (!asset.character?.baseAssetId) errors.push(`${label}: character.baseAssetId is required`);
    }
    if (asset.family === 'character') {
      if (asset.character?.state !== 'neutral') errors.push(`${label}: canonical character art must use the neutral state`);
      if (asset.character?.baseAssetId !== asset.id) errors.push(`${label}: canonical character art must reference itself as the base asset`);
    }
    if (asset.family === 'character-condition') {
      const baseAsset = assetMap.get(asset.character?.baseAssetId);
      if (!baseAsset) errors.push(`${label}: canonical base asset ${asset.character?.baseAssetId || '(missing)'} does not exist`);
      else {
        if (baseAsset.family !== 'character') errors.push(`${label}: canonical base must use the character family`);
        if (baseAsset.character?.id !== asset.character?.id) errors.push(`${label}: condition character id must match its canonical base`);
      }
      if (!Array.isArray(asset.prompt?.identityLocks) || asset.prompt.identityLocks.length < 5) {
        errors.push(`${label}: at least five explicit identity locks are required`);
      }
    }

    for (const reference of asset.references || []) {
      try {
        const referencePath = resolveRepoPath(repoRoot, reference.path);
        if (!existsSync(referencePath)) errors.push(`${label}: reference is missing: ${reference.path}`);
      } catch (error) {
        errors.push(`${label}: ${error.message}`);
      }
      if (!reference.role) errors.push(`${label}: every reference needs a role`);
    }

    if (asset.status === 'approved' || asset.status === 'reference') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(asset.provenance?.reviewedAt || '')) errors.push(`${label}: tracked asset needs a review date`);
      if (!/^[a-f0-9]{64}$/.test(asset.provenance?.sha256 || '')) errors.push(`${label}: tracked asset needs a SHA-256 fingerprint`);
      if (asset.provenance?.origin?.includes('image-generation')) {
        const promptFingerprint = createHash('sha256').update(buildPrompt(direction, manifest, asset.id)).digest('hex');
        if (asset.provenance.promptSha256 !== promptFingerprint) errors.push(`${label}: approved prompt fingerprint has drifted`);
        if (!asset.provenance.review) {
          errors.push(`${label}: generated asset needs a durable review`);
        } else if (checkFiles) {
          try {
            const reviewPath = resolveRepoPath(repoRoot, asset.provenance.review);
            if (!existsSync(reviewPath)) {
              errors.push(`${label}: durable review is missing: ${asset.provenance.review}`);
            } else {
              const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
              if (review.assetId !== asset.id) errors.push(`${label}: durable review belongs to ${review.assetId || 'an unknown asset'}`);
              if (review.candidateSha256 !== asset.provenance.sha256) errors.push(`${label}: durable review fingerprint does not match the approved asset`);
              if (review.generation?.promptSha256 !== promptFingerprint) errors.push(`${label}: durable review prompt fingerprint has drifted`);
              if (!review.generation?.tool || !review.generation?.model) errors.push(`${label}: durable review needs generation tool and model provenance`);
              const reviewResult = scoreReview(direction, review, { asset, manifest });
              for (const failure of reviewResult.errors) errors.push(`${label}: durable review ${failure}`);
              if (review.decision !== 'approved') errors.push(`${label}: durable review decision must be approved`);
            }
          } catch (error) {
            errors.push(`${label}: ${error.message}`);
          }
        }
      }
      if (checkFiles && output.path) {
        try {
          const outputPath = resolveRepoPath(repoRoot, output.path);
          if (!existsSync(outputPath)) {
            errors.push(`${label}: tracked output is missing: ${output.path}`);
          } else {
            const metadata = imageInspector(outputPath);
            for (const failure of validateImageAgainstAsset(asset, metadata)) errors.push(`${label}: ${failure}`);
            const fingerprint = sha256File(outputPath);
            if (fingerprint !== asset.provenance.sha256) errors.push(`${label}: SHA-256 fingerprint does not match the approved file`);
          }
        } catch (error) {
          errors.push(`${label}: ${error.message}`);
        }
      }
    } else if (checkFiles && output.path) {
      const plannedPath = resolveRepoPath(repoRoot, output.path);
      if (existsSync(plannedPath)) warnings.push(`${label}: output exists but status is ${asset.status}`);
    }
  }

  if (checkFiles) {
    const imageExtensions = new Set(['.avif', '.jpg', '.jpeg', '.png', '.webp']);
    const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(entryPath) : [entryPath];
    });
    for (const managedRoot of manifest.managedRoots || []) {
      const absoluteRoot = resolveRepoPath(repoRoot, managedRoot);
      if (!existsSync(absoluteRoot)) {
        warnings.push(`Managed art root does not exist: ${managedRoot}`);
        continue;
      }
      for (const filePath of walk(absoluteRoot)) {
        if (!imageExtensions.has(path.extname(filePath).toLowerCase())) continue;
        const relativePath = path.relative(repoRoot, filePath).replaceAll('\\', '/');
        if (!outputPaths.has(relativePath)) errors.push(`Unmanaged art file: ${relativePath}`);
      }
    }
  }

  const slotCompatibility = {
    backplate: new Set(['backplate', 'texture', 'proof']),
    focal: new Set(['focal']),
    route: new Set(['route']),
    signal: new Set(['signal']),
    texture: new Set(['texture']),
    proof: new Set(['proof']),
  };
  for (const composition of manifest.compositions || []) {
    const label = composition.id || 'unknown composition';
    if (!emotionMap.has(composition.emotionalBeat)) errors.push(`${label}: unknown emotional beat ${composition.emotionalBeat}`);
    if (!Array.isArray(composition.slots) || composition.slots.length < 2) errors.push(`${label}: composition needs at least two slots`);
    if (!composition.rule) errors.push(`${label}: composition rule is required`);
    for (const slot of composition.slots || []) {
      const asset = assetMap.get(slot.assetId);
      if (!asset) {
        errors.push(`${label}: unknown asset ${slot.assetId}`);
        continue;
      }
      const allowed = slotCompatibility[slot.role];
      if (!allowed || !allowed.has(asset.partRole)) errors.push(`${label}: ${asset.id} cannot fill the ${slot.role} slot`);
    }
  }

  if (compositionMap.size === 0) warnings.push('No reusable compositions are defined');
  return { errors, warnings };
}

export function createReviewTemplate(direction, manifest, assetId, candidatePath = '') {
  const asset = findAsset(manifest, assetId);
  const review = {
    assetId: asset.id,
    candidate: candidatePath,
    reviewer: '',
    reviewedAt: new Date().toISOString().slice(0, 10),
    scores: Object.fromEntries(direction.qualityGates.map((gate) => [gate.id, null])),
    notes: Object.fromEntries(direction.qualityGates.map((gate) => [gate.id, gate.question])),
    decision: 'pending',
  };
  if (asset.family === 'character-condition') {
    const baseAsset = findAsset(manifest, asset.character?.baseAssetId);
    review.characterIdentity = {
      characterId: asset.character?.id || '',
      state: asset.character?.state || '',
      baseAssetId: baseAsset.id,
      baseSha256: baseAsset.provenance?.sha256 || '',
      scores: Object.fromEntries(CHARACTER_REVIEW_DIMENSIONS.map((dimension) => [dimension, null])),
      notes: Object.fromEntries(CHARACTER_REVIEW_DIMENSIONS.map((dimension) => [dimension, 'Record concrete comparison evidence against the canonical neutral asset.'])),
    };
  }
  return review;
}

export function scoreReview(direction, review, { asset = null, manifest = null } = {}) {
  const errors = [];
  let earned = 0;
  let possible = 0;
  for (const gate of direction.qualityGates) {
    const score = review.scores?.[gate.id];
    if (!Number.isFinite(score) || score < 0 || score > 4) {
      errors.push(`${gate.id}: score must be between 0 and 4`);
      continue;
    }
    if (score < direction.minimumGateScore) errors.push(`${gate.id}: ${score} is below the minimum ${direction.minimumGateScore}`);
    earned += score * gate.weight;
    possible += 4 * gate.weight;
  }
  const joyScore = possible > 0 ? Number(((earned / possible) * 10).toFixed(1)) : 0;
  if (joyScore < direction.minimumJoyScore) errors.push(`joy score ${joyScore} is below the minimum ${direction.minimumJoyScore}`);
  if (!review.reviewer?.trim()) errors.push('reviewer is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt || '')) errors.push('reviewedAt must use YYYY-MM-DD');
  if (asset?.family === 'character-condition') {
    const baseAsset = manifest?.assets?.find((item) => item.id === asset.character?.baseAssetId);
    if (!review.characterIdentity) errors.push('characterIdentity relational review is required');
    else {
      if (review.characterIdentity.characterId !== asset.character?.id) errors.push('characterIdentity character id does not match the asset contract');
      if (review.characterIdentity.state !== asset.character?.state) errors.push('characterIdentity state does not match the asset contract');
      if (review.characterIdentity.baseAssetId !== asset.character?.baseAssetId) errors.push('characterIdentity base asset does not match the asset contract');
      if (!baseAsset?.provenance?.sha256 || review.characterIdentity.baseSha256 !== baseAsset.provenance.sha256) errors.push('characterIdentity base fingerprint is stale');
      const relational = scoreCharacterReview(review, 3);
      for (const failure of relational.errors) if (!errors.includes(failure)) errors.push(`characterIdentity ${failure}`);
    }
  }
  return { joyScore, passed: errors.length === 0, errors };
}
