#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assetPaths,
  buildCardinalPrompt,
  buildConsistencyPrompt,
  buildFluxTurntablePrompt,
  buildTrellisArgs,
  cellGeometry,
  evaluateRuntimeModel,
  inspectGlbBuffer,
  validateTransparentView,
  validate3dManifest,
} from './art-3d-pipeline-utils.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directionPath = path.join(repoRoot, 'app', 'src', 'art-pipeline', 'art-direction.json');
const sourceManifestPath = path.join(repoRoot, 'app', 'src', 'art-pipeline', 'asset-manifest.json');
const manifestPath = path.join(repoRoot, 'app', 'src', 'art-pipeline', 'asset-3d-manifest.json');
const reviewPath = path.join(repoRoot, 'app', 'src', 'art-pipeline', 'asset-3d-review.json');
const runtimeRegistryPath = path.join(repoRoot, 'app', 'src', 'art-pipeline', 'runtime-models.json');
const direction = JSON.parse(readFileSync(directionPath, 'utf8'));
const sourceManifest = JSON.parse(readFileSync(sourceManifestPath, 'utf8'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
const sourceById = new Map(sourceManifest.assets.map((asset) => [asset.id, asset]));
const entryById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
const reviewById = new Map(review.assets.map((asset) => [asset.id, asset]));
const codexRoot = process.env.CODEX_HOME || path.join(homedir(), '.codex');
const azureGenerate = path.join(codexRoot, 'azure-image.sh');
const azureEdit = path.join(codexRoot, 'azure-image-edit.sh');
const removeChroma = path.join(codexRoot, 'skills', '.system', 'imagegen', 'scripts', 'remove_chroma_key.py');
const trellisRoot = process.env.TRELLIS2_ROOT || path.join(homedir(), 'Desktop', 'imgntn_repos', 'local_music_scene', 'tools', 'trellis2-local');
const blenderExe = process.env.BLENDER_EXE || path.join('C:', 'Program Files', 'Blender Foundation', 'Blender 4.5', 'blender.exe');
const glbReviewScript = process.env.GLB_REVIEW_SCRIPT || path.join(homedir(), 'Desktop', 'imgntn_repos', 'bbb', 'scripts', 'render-glb-review.py');
const runtimePrepScript = path.join(repoRoot, 'scripts', 'prepare-glb-runtime.py');
const gltfTransformCli = process.env.GLTF_TRANSFORM_CLI
  || path.join(path.dirname(process.execPath), 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js');

function usage() {
  console.log(`Xenovoya six-view image-to-3D pipeline

Usage:
  node scripts/art-3d-pipeline.mjs doctor
  node scripts/art-3d-pipeline.mjs plan [asset-id]
  node scripts/art-3d-pipeline.mjs generate [asset-id] --write [--replace|--replace-cardinal|--reprocess]
  node scripts/art-3d-pipeline.mjs contact-sheet [asset-id] --write [--replace]
  node scripts/art-3d-pipeline.mjs trellis [asset-id] --write [--replace]
  node scripts/art-3d-pipeline.mjs trellis-six [asset-id] --write [--replace]
  node scripts/art-3d-pipeline.mjs render [asset-id] --write [--replace]
  node scripts/art-3d-pipeline.mjs render-six [asset-id] --write [--replace]
  node scripts/art-3d-pipeline.mjs prepare-runtime [asset-id] --write [--replace]
  node scripts/art-3d-pipeline.mjs render-runtime [asset-id] --write [--replace]
  node scripts/art-3d-pipeline.mjs promote-runtime [asset-id] --write [--replace]
  node scripts/art-3d-pipeline.mjs runtime-doctor
  node scripts/art-3d-pipeline.mjs all [asset-id] --write [--replace]

Omit asset-id to process all entries. Generation is resumable and preserves provider output,
compiled prompts, fingerprints, six transparent views, TRELLIS receipts, and review sheets.`);
}

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const flags = { write: false, replace: false, replaceCardinal: false, reprocess: false };
  let assetId = null;
  for (const value of rest) {
    if (value === '--write') flags.write = true;
    else if (value === '--replace') flags.replace = true;
    else if (value === '--replace-cardinal') flags.replaceCardinal = true;
    else if (value === '--reprocess') flags.reprocess = true;
    else if (value.startsWith('--')) throw new Error(`Unknown option: ${value}`);
    else if (!assetId) assetId = value;
    else throw new Error(`Unexpected argument: ${value}`);
  }
  return { command, assetId, flags };
}

function selectedEntries(assetId) {
  if (!assetId) return manifest.assets;
  const entry = entryById.get(assetId);
  if (!entry) throw new Error(`Unknown 3D asset id: ${assetId}`);
  return [entry];
}

function repoRelative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll('\\', '/');
}

function bashPath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function run(command, args, label, options = {}) {
  console.log(`START ${label}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    stdio: options.capture ? 'pipe' : 'inherit',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw new Error(`${label} failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = options.capture ? (result.stderr || result.stdout || '').trim() : '';
    throw new Error(`${label} failed with exit ${result.status}${detail ? `: ${detail}` : ''}`);
  }
  console.log(`DONE  ${label}`);
  return result;
}

function runGltfTransform(args, label, options = {}) {
  if (!existsSync(gltfTransformCli)) throw new Error(`glTF Transform CLI is unavailable: ${gltfTransformCli}`);
  return run(process.execPath, [gltfTransformCli, ...args], label, options);
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readReceipt(filePath) {
  return existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : {};
}

function sourceFor(entry) {
  const source = sourceById.get(entry.sourceAssetId);
  if (!source) throw new Error(`${entry.id}: missing source asset ${entry.sourceAssetId}`);
  const sourcePath = path.resolve(repoRoot, source.output.path);
  if (!existsSync(sourcePath)) throw new Error(`${entry.id}: approved identity image is missing: ${source.output.path}`);
  return { source, sourcePath };
}

function ensureWrite(flags, command) {
  if (!flags.write) throw new Error(`${command} is a write operation; add --write`);
}

function inspectImage(filePath) {
  const result = run('magick', ['identify', '-quiet', '-format', '%w|%h|%m|%[channels]|%[opaque]|%[fx:mean.a]', filePath], `inspect ${path.basename(filePath)}`, { capture: true });
  const [width, height, format, channels, opaque, alphaMean] = result.stdout.trim().split('|');
  return {
    width: Number(width),
    height: Number(height),
    format: String(format || '').toLowerCase(),
    channels: String(channels || '').toLowerCase(),
    opaque: String(opaque || '').toLowerCase() === 'true',
    alphaMean: Number(alphaMean),
    bytes: statSync(filePath).size,
  };
}

function normalizeSheet(input, output, manifestConfig, options = {}) {
  const width = options.width || manifestConfig.generation.sheet.width;
  const height = options.height || manifestConfig.generation.sheet.height;
  const background = options.background || manifestConfig.generation.sheet.background;
  mkdirSync(path.dirname(output), { recursive: true });
  run('magick', [input, '-auto-orient', '-strip', '-colorspace', 'sRGB', '-resize', `${width}x${height}!`, '-background', background, '-alpha', 'remove', '-alpha', 'off', `PNG32:${output}`], `normalize ${path.basename(output)}`);
  const observed = inspectImage(output);
  if (observed.width !== width || observed.height !== height || observed.format !== 'png') {
    throw new Error(`Invalid normalized sheet ${output}: ${observed.width}x${observed.height} ${observed.format}`);
  }
  return observed;
}

function matteThresholds(input) {
  const result = run('magick', [input, '-format', '%[fx:int(255*r)],%[fx:int(255*g)],%[fx:int(255*b)]', 'info:'], `sample key ${path.basename(input)}`, { capture: true });
  const channels = result.stdout.trim().split(',').map(Number);
  const maximum = Math.max(...channels);
  const minimum = Math.min(...channels);
  if (maximum <= 48) return { transparent: '8', opaque: '40', despill: false, key: channels };
  if (minimum >= 207) return { transparent: '40', opaque: '180', despill: false, key: channels };
  return { transparent: '32', opaque: '150', despill: true, key: channels };
}

function removeBackground(entry, input, output, label, stage) {
  const matte = matteThresholds(input);
  const mode = stage === 'cardinal'
    ? (entry.cardinalMatteMode || entry.matteMode)
    : (entry.orbitMatteMode || entry.matteMode);
  if (mode === 'connected-border') {
    const key = `rgb(${matte.key.join(',')})`;
    const fuzz = `${entry.matteFuzzPercent ?? 10}%`;
    console.log(`MATTE ${label} connected-border key ${key} fuzz ${fuzz}`);
    run('magick', [input, '-alpha', 'on', '-bordercolor', key, '-border', '1', '-fuzz', fuzz, '-fill', 'none', '-draw', 'color 0,0 floodfill', '-shave', '1x1', `PNG32:${output}`], `${label} alpha`);
    return;
  }
  const matteArgs = [removeChroma, '--input', input, '--out', output, '--auto-key', 'border', '--soft-matte', '--transparent-threshold', matte.transparent, '--opaque-threshold', matte.opaque];
  if (matte.despill) matteArgs.push('--despill');
  matteArgs.push('--force');
  console.log(`MATTE ${label} key rgb(${matte.key.join(',')}) thresholds ${matte.transparent}/${matte.opaque}`);
  run('python', matteArgs, `${label} alpha`);
}

function generateFlux(entry, source, prompt, paths, flags) {
  if (existsSync(paths.fluxSheet) && !flags.replace && !flags.reprocess) {
    console.log(`SKIP  ${entry.id} FLUX.2-pro sheet already exists`);
    return;
  }
  mkdirSync(paths.raw, { recursive: true });
  writeFileSync(path.join(paths.prompts, 'flux-six-view.prompt.md'), `# ${source.name} - FLUX.2-pro six-view draft\n\n${prompt}\n`, 'utf8');
  if (!existsSync(paths.fluxProviderOutput) || flags.replace) {
    run('bash', [bashPath(azureGenerate), prompt, bashPath(paths.fluxProviderOutput), 'FLUX.2-pro', '1536x1024'], `${entry.id} FLUX.2-pro six-view generation`);
  } else {
    console.log(`REUSE ${entry.id} preserved FLUX.2-pro provider output`);
  }
  if (!existsSync(paths.fluxProviderOutput)) throw new Error(`${entry.id}: FLUX.2-pro returned no image`);
  normalizeSheet(paths.fluxProviderOutput, paths.fluxSheet, manifest);
}

function generateCanonical(entry, source, sourcePath, prompt, paths, flags) {
  if (existsSync(paths.canonicalSheet) && !flags.replace && !flags.reprocess) {
    console.log(`SKIP  ${entry.id} GPT Image 2 canonical sheet already exists`);
    return;
  }
  if (!existsSync(paths.fluxSheet)) throw new Error(`${entry.id}: FLUX sheet is required before the consistency pass`);
  writeFileSync(path.join(paths.prompts, 'gpt-image-2-consistency.prompt.md'), `# ${source.name} - GPT Image 2 identity lock\n\n${prompt}\n`, 'utf8');
  if (!existsSync(paths.canonicalProviderOutput) || flags.replace) {
    run('bash', [
      bashPath(azureEdit),
      prompt,
      bashPath(paths.canonicalProviderOutput),
      '1536x1024',
      bashPath(sourcePath),
      bashPath(paths.fluxSheet),
    ], `${entry.id} GPT Image 2 identity consistency`);
  } else {
    console.log(`REUSE ${entry.id} preserved GPT Image 2 provider output`);
  }
  if (!existsSync(paths.canonicalProviderOutput)) throw new Error(`${entry.id}: GPT Image 2 returned no image`);
  normalizeSheet(paths.canonicalProviderOutput, paths.canonicalSheet, manifest);
}

function generateCardinal(entry, source, sourcePath, prompt, paths, flags) {
  if (existsSync(paths.cardinalSheet) && !flags.replace && !flags.replaceCardinal && !flags.reprocess) {
    console.log(`SKIP  ${entry.id} GPT Image 2 cardinal sheet already exists`);
    return;
  }
  writeFileSync(path.join(paths.prompts, 'gpt-image-2-cardinal.prompt.md'), `# ${source.name} - GPT Image 2 cardinal elevations\n\n${prompt}\n`, 'utf8');
  if (!existsSync(paths.cardinalProviderOutput) || flags.replace || flags.replaceCardinal) {
    const referencePaths = entry.cardinalReferenceMode === 'identity-only'
      ? [paths.canonicalSheet]
      : [sourcePath, paths.fluxSheet, paths.canonicalSheet];
    run('bash', [
      bashPath(azureEdit),
      prompt,
      bashPath(paths.cardinalProviderOutput),
      '1024x1024',
      ...referencePaths.map(bashPath),
    ], `${entry.id} GPT Image 2 cardinal elevations`);
  } else {
    console.log(`REUSE ${entry.id} preserved GPT Image 2 cardinal provider output`);
  }
  if (!existsSync(paths.cardinalProviderOutput)) throw new Error(`${entry.id}: GPT Image 2 returned no cardinal image`);
  normalizeSheet(paths.cardinalProviderOutput, paths.cardinalSheet, manifest, { width: 1024, height: 1024, background: '#00AEEF' });
}

function extractViews(entry, paths, flags) {
  mkdirSync(paths.rawCropRoot, { recursive: true });
  mkdirSync(paths.viewRoot, { recursive: true });
  const viewReceipts = [];
  for (const view of manifest.generation.views) {
    const rawCrop = path.join(paths.rawCropRoot, `${view.id}.png`);
    const output = path.join(paths.viewRoot, `${view.id}.png`);
    if (!existsSync(output) || flags.replace || flags.reprocess) {
      const geometry = cellGeometry(manifest, view, entry.orbitCrop);
      const sheetKey = matteThresholds(paths.canonicalSheet).key;
      const background = `rgb(${sheetKey.join(',')})`;
      run('magick', [paths.canonicalSheet, '-crop', `${geometry.width}x${geometry.height}+${geometry.x}+${geometry.y}`, '+repage', '-resize', '480x480', '-gravity', 'center', '-background', background, '-extent', '512x512', `PNG32:${rawCrop}`], `${entry.id} crop ${view.id}`);
      removeBackground(entry, rawCrop, output, `${entry.id}/${view.id}`, 'orbit');
    } else {
      console.log(`SKIP  ${entry.id} ${view.id} view already exists`);
    }
    const observed = inspectImage(output);
    const coverageErrors = validateTransparentView(observed);
    if (coverageErrors.length) throw new Error(`${entry.id}/${view.id}: ${coverageErrors.join('; ')}; received ${JSON.stringify(observed)}`);
    viewReceipts.push({
      id: view.id,
      yaw: view.yaw,
      path: repoRelative(output),
      sha256: sha256File(output),
      observed,
    });
  }
  return viewReceipts;
}

function extractCardinalViews(entry, paths, flags) {
  const ids = ['front', 'right', 'back', 'left'];
  const crop = entry.cardinalCrop;
  const sourceCells = crop.sourceCells || Object.fromEntries(ids.map((id, index) => [id, index]));
  const cardinals = ids.map((id) => {
    if (crop.regions?.[id]) return { id, ...crop.regions[id] };
    const cell = sourceCells[id];
    if (crop.layout === '4x1') {
      return { id, x: cell * 256, y: crop.y || 0, width: 256, height: crop.height || 1024 };
    }
    const topInset = crop.topInset || 0;
    return {
      id,
      x: (cell % 2) * 512,
      y: Math.floor(cell / 2) * 512 + topInset,
      width: 512,
      height: 512 - topInset,
    };
  });
  mkdirSync(paths.cardinalRawCropRoot, { recursive: true });
  mkdirSync(paths.cardinalRoot, { recursive: true });
  const receipts = [];
  for (const view of cardinals) {
    const rawCrop = path.join(paths.cardinalRawCropRoot, `${view.id}.png`);
    const output = path.join(paths.cardinalRoot, `${view.id}.png`);
    if (!existsSync(output) || flags.replace || flags.replaceCardinal || flags.reprocess) {
      const sheetKey = matteThresholds(paths.cardinalSheet).key;
      const background = `rgb(${sheetKey.join(',')})`;
      run('magick', [paths.cardinalSheet, '-crop', `${view.width}x${view.height}+${view.x}+${view.y}`, '+repage', '-resize', '480x480', '-gravity', 'center', '-background', background, '-extent', '512x512', `PNG32:${rawCrop}`], `${entry.id} crop cardinal ${view.id}`);
      removeBackground(entry, rawCrop, output, `${entry.id}/cardinal-${view.id}`, 'cardinal');
    }
    const observed = inspectImage(output);
    const coverageErrors = validateTransparentView(observed);
    if (coverageErrors.length) throw new Error(`${entry.id}/cardinal-${view.id}: ${coverageErrors.join('; ')}; received ${JSON.stringify(observed)}`);
    receipts.push({ id: view.id, path: repoRelative(output), sha256: sha256File(output), observed });
  }
  return receipts;
}

function generationReceipt(entry, source, sourcePath, paths, fluxPrompt, consistencyPrompt, cardinalPrompt, views, cardinalViews) {
  return {
    schemaVersion: 1,
    assetId: entry.id,
    sourceAssetId: entry.sourceAssetId,
    generatedAt: new Date().toISOString(),
    status: 'candidate',
    sourceIdentity: {
      role: 'approved 2D identity reference',
      path: repoRelative(sourcePath),
      sha256: sha256File(sourcePath),
    },
    stages: {
      turntableDraft: {
        provider: manifest.generation.provider,
        model: manifest.generation.draftModel,
        promptPath: repoRelative(path.join(paths.prompts, 'flux-six-view.prompt.md')),
        promptSha256: sha256Text(fluxPrompt),
        rawProviderOutput: repoRelative(paths.fluxProviderOutput),
        rawProviderSha256: sha256File(paths.fluxProviderOutput),
        normalizedSheet: repoRelative(paths.fluxSheet),
        normalizedSheetSha256: sha256File(paths.fluxSheet),
      },
      identityLock: {
        provider: manifest.generation.provider,
        model: manifest.generation.consistencyModel,
        inputRoles: ['approved 2D identity reference', 'FLUX.2-pro six-view draft'],
        promptPath: repoRelative(path.join(paths.prompts, 'gpt-image-2-consistency.prompt.md')),
        promptSha256: sha256Text(consistencyPrompt),
        rawProviderOutput: repoRelative(paths.canonicalProviderOutput),
        rawProviderSha256: sha256File(paths.canonicalProviderOutput),
        canonicalSheet: repoRelative(paths.canonicalSheet),
        canonicalSheetSha256: sha256File(paths.canonicalSheet),
      },
      cardinalElevations: {
        provider: manifest.generation.provider,
        model: manifest.generation.consistencyModel,
        inputRoles: entry.cardinalReferenceMode === 'identity-only'
          ? ['GPT Image 2 six-view identity sheet']
          : ['approved 2D identity reference', 'FLUX.2-pro turnaround draft', 'GPT Image 2 six-view identity sheet'],
        promptPath: repoRelative(path.join(paths.prompts, 'gpt-image-2-cardinal.prompt.md')),
        promptSha256: sha256Text(cardinalPrompt),
        rawProviderOutput: repoRelative(paths.cardinalProviderOutput),
        rawProviderSha256: sha256File(paths.cardinalProviderOutput),
        canonicalSheet: repoRelative(paths.cardinalSheet),
        canonicalSheetSha256: sha256File(paths.cardinalSheet),
      },
    },
    views,
    cardinalViews,
    next: `npm run art:3d:contact-sheet -- ${entry.id} --write && npm run art:3d:trellis -- ${entry.id} --write`,
  };
}

function commandGenerate(entry, flags) {
  ensureWrite(flags, 'generate');
  const { source, sourcePath } = sourceFor(entry);
  const paths = assetPaths(repoRoot, entry.id);
  mkdirSync(paths.prompts, { recursive: true });
  const fluxPrompt = buildFluxTurntablePrompt(direction, source, entry, manifest);
  const consistencyPrompt = buildConsistencyPrompt(direction, source, entry, manifest);
  const cardinalPrompt = buildCardinalPrompt(direction, source, entry);
  generateFlux(entry, source, fluxPrompt, paths, flags);
  generateCanonical(entry, source, sourcePath, consistencyPrompt, paths, flags);
  generateCardinal(entry, source, sourcePath, cardinalPrompt, paths, flags);
  const views = extractViews(entry, paths, flags);
  const cardinalViews = extractCardinalViews(entry, paths, flags);
  writeJson(paths.receipt, generationReceipt(entry, source, sourcePath, paths, fluxPrompt, consistencyPrompt, cardinalPrompt, views, cardinalViews));
  console.log(`READY ${entry.id}: six identity-locked orbit views plus four strict cardinal views`);
  console.log(`RECEIPT ${repoRelative(paths.receipt)}`);
}

function commandContactSheet(entry, flags) {
  ensureWrite(flags, 'contact-sheet');
  const { sourcePath } = sourceFor(entry);
  const paths = assetPaths(repoRoot, entry.id);
  if (existsSync(paths.contactSheet) && !flags.replace) {
    console.log(`SKIP  ${entry.id} contact sheet already exists`);
    return;
  }
  const inputs = [
    sourcePath,
    paths.fluxSheet,
    paths.canonicalSheet,
    paths.cardinalSheet,
    ...manifest.generation.views.map((view) => path.join(paths.viewRoot, `${view.id}.png`)),
    ...['front', 'right', 'back', 'left'].map((view) => path.join(paths.cardinalRoot, `${view}.png`)),
  ];
  const missing = inputs.filter((filePath) => !existsSync(filePath));
  if (missing.length) throw new Error(`${entry.id}: cannot make contact sheet; missing ${missing.map(repoRelative).join(', ')}`);
  mkdirSync(path.dirname(paths.contactSheet), { recursive: true });
  run('magick', [
    'montage', ...inputs,
    '-thumbnail', '420x360',
    '-tile', '4x4',
    '-geometry', '420x360+20+36',
    '-background', '#0d0f0a',
    '-fill', '#f5efd8',
    '-stroke', 'none',
    '-pointsize', '18',
    '-set', 'label', '%t',
    paths.contactSheet,
  ], `${entry.id} review contact sheet`);
  console.log(`REVIEW ${repoRelative(paths.contactSheet)}`);
}

function commandTrellis(entry, flags) {
  ensureWrite(flags, 'trellis');
  const paths = assetPaths(repoRoot, entry.id);
  if (existsSync(paths.model) && !flags.replace) {
    console.log(`SKIP  ${entry.id} TRELLIS.2 candidate already exists`);
    return;
  }
  const viewInputs = ['front', 'right', 'back', 'left'].map((id) => ({ id, path: path.join(paths.cardinalRoot, `${id}.png`) }));
  const missing = viewInputs.map((view) => view.path).filter((filePath) => !existsSync(filePath));
  if (missing.length) throw new Error(`${entry.id}: TRELLIS.2 inputs are missing: ${missing.map(repoRelative).join(', ')}`);
  const submit = path.join(trellisRoot, 'scripts', 'submit.py');
  if (!existsSync(submit)) throw new Error(`TRELLIS.2 submit client is unavailable: ${submit}`);
  mkdirSync(path.dirname(paths.model), { recursive: true });
  const args = buildTrellisArgs(trellisRoot, manifest.trellis, entry, viewInputs, paths.model);
  run('python', args, `${entry.id} TRELLIS.2 ${manifest.trellis.mode} reconstruction`);
  if (!existsSync(paths.model)) throw new Error(`${entry.id}: TRELLIS.2 completed without a GLB`);
  const receipt = readReceipt(paths.receipt);
  receipt.trellis = {
    completedAt: new Date().toISOString(),
    status: 'source-candidate',
    service: manifest.trellis.server,
    inputMode: manifest.trellis.mode,
    inputViews: Object.fromEntries(viewInputs.map((view) => [view.id, repoRelative(view.path)])),
    recipe: { ...manifest.trellis, decimationTarget: entry.decimationTarget, seed: entry.seed },
    output: repoRelative(paths.model),
    outputSha256: sha256File(paths.model),
    bytes: statSync(paths.model).size,
    serviceReceipt: existsSync(paths.model.replace(/\.glb$/, '.receipt.json'))
      ? repoRelative(paths.model.replace(/\.glb$/, '.receipt.json'))
      : null,
    promotionState: 'awaiting visual review, scale/orientation/material/pivot/LOD validation',
  };
  writeJson(paths.receipt, receipt);
  console.log(`MODEL ${repoRelative(paths.model)} (${receipt.trellis.bytes} bytes)`);
}

function recordSixViewReceipt(entry, paths, viewInputs, sixViewConfig) {
  const receipt = readReceipt(paths.receipt);
  receipt.trellisSixView = {
    completedAt: new Date().toISOString(),
    status: 'comparison-candidate',
    service: manifest.trellis.server,
    inputMode: sixViewConfig.mode,
    inputViews: Object.fromEntries(viewInputs.map((view) => [view.id, repoRelative(view.path)])),
    recipe: { ...sixViewConfig, decimationTarget: entry.decimationTarget, seed: entry.seed },
    output: repoRelative(paths.experimentalModel),
    outputSha256: sha256File(paths.experimentalModel),
    bytes: statSync(paths.experimentalModel).size,
    serviceReceipt: existsSync(paths.experimentalModel.replace(/\.glb$/, '.receipt.json'))
      ? repoRelative(paths.experimentalModel.replace(/\.glb$/, '.receipt.json'))
      : null,
    promotionState: 'comparison only until five-angle visual review',
  };
  writeJson(paths.receipt, receipt);
  console.log(`MODEL ${repoRelative(paths.experimentalModel)} (${receipt.trellisSixView.bytes} bytes)`);
}

function commandTrellisSix(entry, flags) {
  ensureWrite(flags, 'trellis-six');
  const paths = assetPaths(repoRoot, entry.id);
  const viewInputs = manifest.generation.views.map((view) => ({
    id: view.id,
    path: path.join(paths.viewRoot, `${view.id}.png`),
  }));
  const sixViewConfig = { ...manifest.trellis, mode: manifest.trellis.experimentalEvidenceMode };
  if (existsSync(paths.experimentalModel) && !flags.replace) {
    recordSixViewReceipt(entry, paths, viewInputs, sixViewConfig);
    console.log(`SKIP  ${entry.id} six-orbit TRELLIS.2 candidate already exists`);
    return;
  }
  const missing = viewInputs.map((view) => view.path).filter((filePath) => !existsSync(filePath));
  if (missing.length) throw new Error(`${entry.id}: six-orbit TRELLIS.2 inputs are missing: ${missing.map(repoRelative).join(', ')}`);
  const submit = path.join(trellisRoot, 'scripts', 'submit.py');
  if (!existsSync(submit)) throw new Error(`TRELLIS.2 submit client is unavailable: ${submit}`);
  mkdirSync(path.dirname(paths.experimentalModel), { recursive: true });
  const args = buildTrellisArgs(trellisRoot, sixViewConfig, entry, viewInputs, paths.experimentalModel);
  run('python', args, `${entry.id} TRELLIS.2 six-orbit reconstruction`);
  if (!existsSync(paths.experimentalModel)) throw new Error(`${entry.id}: six-orbit TRELLIS.2 completed without a GLB`);
  recordSixViewReceipt(entry, paths, viewInputs, sixViewConfig);
}

function commandRender(entry, flags) {
  ensureWrite(flags, 'render');
  const paths = assetPaths(repoRoot, entry.id);
  if (!existsSync(paths.model)) throw new Error(`${entry.id}: TRELLIS.2 candidate is missing: ${repoRelative(paths.model)}`);
  if (existsSync(paths.modelContactSheet) && !flags.replace) {
    console.log(`SKIP  ${entry.id} model review already exists`);
    return;
  }
  if (!existsSync(blenderExe)) throw new Error(`Blender is unavailable: ${blenderExe}`);
  if (!existsSync(glbReviewScript)) throw new Error(`GLB review renderer is unavailable: ${glbReviewScript}`);
  mkdirSync(paths.modelReviewRoot, { recursive: true });
  run(blenderExe, [
    '--background',
    '--python', glbReviewScript,
    '--', paths.model, paths.modelReviewRoot,
    'front,side,back,top,perspective',
  ], `${entry.id} five-angle Blender review`);
  const renderInputs = ['front', 'side', 'back', 'top', 'perspective']
    .map((view) => path.join(paths.modelReviewRoot, `${view}.png`));
  const missing = renderInputs.filter((filePath) => !existsSync(filePath));
  if (missing.length) throw new Error(`${entry.id}: Blender review is missing ${missing.map(repoRelative).join(', ')}`);
  mkdirSync(path.dirname(paths.modelContactSheet), { recursive: true });
  run('magick', [
    'montage', ...renderInputs,
    '-thumbnail', '560x560',
    '-tile', '5x1',
    '-geometry', '560x560+16+38',
    '-background', '#0d0f0a',
    '-fill', '#f5efd8',
    '-stroke', 'none',
    '-pointsize', '20',
    '-set', 'label', '%t',
    paths.modelContactSheet,
  ], `${entry.id} model review contact sheet`);
  const receipt = readReceipt(paths.receipt);
  receipt.visualReview = {
    renderedAt: new Date().toISOString(),
    status: 'awaiting-identity-and-geometry-review',
    views: renderInputs.map(repoRelative),
    contactSheet: repoRelative(paths.modelContactSheet),
    renderer: glbReviewScript,
  };
  writeJson(paths.receipt, receipt);
  console.log(`REVIEW ${repoRelative(paths.modelContactSheet)}`);
}

function commandRenderSix(entry, flags) {
  ensureWrite(flags, 'render-six');
  const paths = assetPaths(repoRoot, entry.id);
  if (!existsSync(paths.experimentalModel)) throw new Error(`${entry.id}: six-orbit TRELLIS.2 candidate is missing: ${repoRelative(paths.experimentalModel)}`);
  if (existsSync(paths.experimentalModelContactSheet) && !flags.replace) {
    console.log(`SKIP  ${entry.id} six-orbit model review already exists`);
    return;
  }
  if (!existsSync(blenderExe)) throw new Error(`Blender is unavailable: ${blenderExe}`);
  if (!existsSync(glbReviewScript)) throw new Error(`GLB review renderer is unavailable: ${glbReviewScript}`);
  mkdirSync(paths.experimentalModelReviewRoot, { recursive: true });
  run(blenderExe, [
    '--background',
    '--python', glbReviewScript,
    '--', paths.experimentalModel, paths.experimentalModelReviewRoot,
    'front,side,back,top,perspective',
  ], `${entry.id} six-orbit five-angle Blender review`);
  const renderInputs = ['front', 'side', 'back', 'top', 'perspective']
    .map((view) => path.join(paths.experimentalModelReviewRoot, `${view}.png`));
  const missing = renderInputs.filter((filePath) => !existsSync(filePath));
  if (missing.length) throw new Error(`${entry.id}: six-orbit Blender review is missing ${missing.map(repoRelative).join(', ')}`);
  mkdirSync(path.dirname(paths.experimentalModelContactSheet), { recursive: true });
  run('magick', [
    'montage', ...renderInputs,
    '-thumbnail', '560x560',
    '-tile', '5x1',
    '-geometry', '560x560+16+38',
    '-background', '#0d0f0a',
    '-fill', '#f5efd8',
    '-stroke', 'none',
    '-pointsize', '20',
    '-set', 'label', '%t',
    paths.experimentalModelContactSheet,
  ], `${entry.id} six-orbit model review contact sheet`);
  const receipt = readReceipt(paths.receipt);
  receipt.sixViewVisualReview = {
    renderedAt: new Date().toISOString(),
    status: 'awaiting-identity-and-geometry-review',
    views: renderInputs.map(repoRelative),
    contactSheet: repoRelative(paths.experimentalModelContactSheet),
    renderer: glbReviewScript,
  };
  writeJson(paths.receipt, receipt);
  console.log(`REVIEW ${repoRelative(paths.experimentalModelContactSheet)}`);
}

function reviewedRuntimeSource(entry) {
  const selected = reviewById.get(entry.id);
  if (!selected) throw new Error(`${entry.id}: no reviewed reconstruction lane exists`);
  if (selected.status !== 'cleanup-candidate') {
    throw new Error(`${entry.id}: review status ${selected.status} is not eligible for runtime preparation`);
  }
  const assetRoot = path.resolve(repoRoot, 'artifacts', 'art', '3d', entry.id);
  const selectedPath = path.resolve(repoRoot, selected.selectedModel);
  if (selectedPath !== assetRoot && !selectedPath.startsWith(`${assetRoot}${path.sep}`)) {
    throw new Error(`${entry.id}: reviewed model escapes its asset workspace`);
  }
  if (!existsSync(selectedPath)) throw new Error(`${entry.id}: reviewed model is missing: ${selected.selectedModel}`);
  return { selected, selectedPath };
}

function commandPrepareRuntime(entry, flags) {
  ensureWrite(flags, 'prepare-runtime');
  const { selected, selectedPath } = reviewedRuntimeSource(entry);
  const paths = assetPaths(repoRoot, entry.id);
  const runtimeModels = manifest.runtime.lods.map((lod) => ({
    lod: {
      ...lod,
      ...(entry.lodBudgetOverrides?.[lod.id] || {}),
      simplifyRatio: entry.lodSimplifyRatios?.[lod.id] ?? lod.simplifyRatio,
    },
    output: paths.runtimeModels[lod.id],
  }));
  if (!flags.replace && existsSync(paths.runtimeReceipt) && runtimeModels.every(({ output }) => existsSync(output))) {
    console.log(`SKIP  ${entry.id} runtime candidates already exist`);
    return;
  }

  mkdirSync(paths.runtimeRoot, { recursive: true });
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'xenovoya-art3d-'));
  const results = [];
  try {
    for (const { lod, output } of runtimeModels) {
      const decimatedPath = path.join(temporaryRoot, `${entry.id}-${lod.id}-decimated.glb`);
      run(blenderExe, [
        '--background',
        '--python', runtimePrepScript,
        '--', selectedPath, decimatedPath, String(lod.simplifyRatio), JSON.stringify(entry.materialOverride || {}),
      ], `${entry.id} ground and decimate ${lod.id}`);
      runGltfTransform([
        'optimize', decimatedPath, output,
        '--compress', 'quantize',
        '--flatten', 'true',
        '--join', 'true',
        '--simplify', 'false',
        '--texture-compress', 'webp',
        '--texture-size', String(lod.textureSize),
      ], `${entry.id} prepare ${lod.id}`);
      const validation = runGltfTransform(['validate', output], `${entry.id} validate ${lod.id}`, { capture: true });
      const stats = inspectGlbBuffer(readFileSync(output));
      const budget = evaluateRuntimeModel(stats, manifest.runtime, lod);
      results.push({
        id: lod.id,
        path: repoRelative(output),
        sha256: sha256File(output),
        stats,
        budget,
        validator: validation.stdout.trim().split(/\r?\n/).slice(-8),
      });
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }

  const passed = results.length === manifest.runtime.lods.length && results.every((result) => result.budget.passed);
  writeJson(paths.runtimeReceipt, {
    schemaVersion: 1,
    assetId: entry.id,
    preparedAt: new Date().toISOString(),
    status: passed ? 'awaiting-visual-approval' : 'budget-failed',
    sourceReviewStatus: selected.status,
    selectedLane: selected.selectedLane,
    source: repoRelative(selectedPath),
    sourceSha256: sha256File(selectedPath),
    materialOverride: entry.materialOverride || null,
    contract: {
      ...manifest.runtime,
      lods: runtimeModels.map(({ lod }) => lod),
    },
    models: results,
  });
  if (!passed) {
    const failures = results.flatMap((result) => result.budget.failures.map((failure) => `${result.id}: ${failure}`));
    throw new Error(`${entry.id}: runtime preparation failed budgets: ${failures.join('; ')}`);
  }
  console.log(`READY ${entry.id}: ${results.map((result) => `${result.id} ${result.stats.triangles} tris/${result.stats.bytes} bytes`).join(', ')}`);
  console.log(`RECEIPT ${repoRelative(paths.runtimeReceipt)}`);
}

function commandRenderRuntime(entry, flags) {
  ensureWrite(flags, 'render-runtime');
  reviewedRuntimeSource(entry);
  const paths = assetPaths(repoRoot, entry.id);
  if (existsSync(paths.runtimeContactSheet) && !flags.replace) {
    console.log(`SKIP  ${entry.id} runtime review already exists`);
    return;
  }
  if (!existsSync(blenderExe)) throw new Error(`Blender is unavailable: ${blenderExe}`);
  if (!existsSync(glbReviewScript)) throw new Error(`GLB review renderer is unavailable: ${glbReviewScript}`);
  const renderInputs = [];
  for (const lod of manifest.runtime.lods) {
    const model = paths.runtimeModels[lod.id];
    if (!existsSync(model)) throw new Error(`${entry.id}: runtime model is missing: ${repoRelative(model)}`);
    const reviewRoot = path.join(paths.runtimeReviewRoot, lod.id);
    mkdirSync(reviewRoot, { recursive: true });
    run(blenderExe, [
      '--background',
      '--python', glbReviewScript,
      '--', model, reviewRoot,
      'front,side,back,top,perspective',
    ], `${entry.id} ${lod.id} five-angle runtime review`);
    for (const view of ['front', 'side', 'back', 'top', 'perspective']) {
      const rendered = path.join(reviewRoot, `${view}.png`);
      if (!existsSync(rendered)) throw new Error(`${entry.id}: runtime review is missing ${repoRelative(rendered)}`);
      renderInputs.push({ path: rendered, label: `${lod.id}/${view}` });
    }
  }
  mkdirSync(path.dirname(paths.runtimeContactSheet), { recursive: true });
  const montageInputs = renderInputs.flatMap((input) => ['-label', input.label, input.path]);
  run('magick', [
    'montage', ...montageInputs,
    '-thumbnail', '480x480',
    '-tile', `5x${manifest.runtime.lods.length}`,
    '-geometry', '480x480+14+36',
    '-background', '#0d0f0a',
    '-fill', '#f5efd8',
    '-stroke', 'none',
    '-pointsize', '18',
    paths.runtimeContactSheet,
  ], `${entry.id} runtime LOD review contact sheet`);
  const receipt = readReceipt(paths.runtimeReceipt);
  receipt.visualReview = {
    renderedAt: new Date().toISOString(),
    status: 'awaiting-human-approval',
    views: renderInputs.map((input) => ({ label: input.label, path: repoRelative(input.path) })),
    contactSheet: repoRelative(paths.runtimeContactSheet),
    renderer: glbReviewScript,
  };
  writeJson(paths.runtimeReceipt, receipt);
  console.log(`REVIEW ${repoRelative(paths.runtimeContactSheet)}`);
}

function runtimeRegistry() {
  return existsSync(runtimeRegistryPath)
    ? JSON.parse(readFileSync(runtimeRegistryPath, 'utf8'))
    : { schemaVersion: 1, generatedAt: null, assets: [] };
}

function validatedRuntimeEvidence(entry) {
  const selected = reviewById.get(entry.id);
  const paths = assetPaths(repoRoot, entry.id);
  const decision = selected?.runtimeReview;
  if (!decision) throw new Error(`${entry.id}: runtime visual review is missing`);
  if (!existsSync(paths.runtimeReceipt)) throw new Error(`${entry.id}: runtime receipt is missing`);
  if (!existsSync(paths.runtimeContactSheet)) throw new Error(`${entry.id}: runtime contact sheet is missing`);
  const receipt = readReceipt(paths.runtimeReceipt);
  const models = new Map((receipt.models || []).map((model) => [model.id, model]));
  for (const lod of manifest.runtime.lods) {
    const model = models.get(lod.id);
    const modelPath = paths.runtimeModels[lod.id];
    if (!model || !existsSync(modelPath)) throw new Error(`${entry.id}: ${lod.id} runtime model evidence is missing`);
    if (!model.budget?.passed) throw new Error(`${entry.id}: ${lod.id} failed its runtime budget`);
    if (model.sha256 !== sha256File(modelPath)) throw new Error(`${entry.id}: ${lod.id} fingerprint drifted after review`);
  }
  return { selected, paths, decision, receipt };
}

function commandPromoteRuntime(entry, flags) {
  ensureWrite(flags, 'promote-runtime');
  const { paths, decision, receipt } = validatedRuntimeEvidence(entry);
  if (decision.decision !== 'approved') throw new Error(`${entry.id}: runtime review decision is ${decision.decision}, not approved`);
  const outputs = [];
  for (const model of receipt.models) {
    const source = paths.runtimeModels[model.id];
    const destination = path.join(repoRoot, 'app', 'public', 'models', `${entry.id}-${model.id}.glb`);
    mkdirSync(path.dirname(destination), { recursive: true });
    if (existsSync(destination) && !flags.replace) {
      if (sha256File(destination) !== model.sha256) throw new Error(`${entry.id}: promoted ${model.id} exists with a different fingerprint; add --replace after review`);
    } else {
      copyFileSync(source, destination);
    }
    outputs.push({ id: model.id, path: `/${repoRelative(destination).replace(/^app\/public\//, '')}`, sha256: sha256File(destination), ...model.stats });
  }
  const registry = runtimeRegistry();
  registry.generatedAt = new Date().toISOString();
  registry.assets = [
    ...registry.assets.filter((asset) => asset.id !== entry.id),
    {
      id: entry.id,
      reviewDecision: decision.decision,
      reviewPath: repoRelative(reviewPath),
      contactSheet: decision.contactSheet,
      models: outputs,
    },
  ].sort((left, right) => left.id.localeCompare(right.id));
  writeJson(runtimeRegistryPath, registry);
  receipt.status = 'promoted';
  receipt.promotedAt = registry.generatedAt;
  receipt.promotedModels = outputs;
  writeJson(paths.runtimeReceipt, receipt);
  console.log(`PROMOTED ${entry.id}: ${outputs.map((output) => `${output.id} ${output.path}`).join(', ')}`);
}

function commandRuntimeDoctor() {
  const errors = [];
  const registry = runtimeRegistry();
  const registered = new Map(registry.assets.map((asset) => [asset.id, asset]));
  for (const entry of manifest.assets) {
    const selected = reviewById.get(entry.id);
    if (selected?.status === 'rework-required') continue;
    try {
      const { decision } = validatedRuntimeEvidence(entry);
      const registeredAsset = registered.get(entry.id);
      if (decision.decision === 'approved') {
        if (!registeredAsset) throw new Error(`${entry.id}: approved runtime asset is not promoted`);
        for (const model of registeredAsset.models || []) {
          const filePath = path.join(repoRoot, 'app', 'public', model.path.replace(/^\//, ''));
          if (!existsSync(filePath) || sha256File(filePath) !== model.sha256) throw new Error(`${entry.id}: promoted ${model.id} is missing or fingerprint-drifted`);
        }
      } else if (registeredAsset) {
        throw new Error(`${entry.id}: rework decision cannot remain in the promoted registry`);
      }
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (errors.length) throw new Error(`Runtime 3D doctor found ${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  console.log(`OK runtime 3D evidence: ${registry.assets.length} approved assets promoted; ${manifest.assets.length - registry.assets.length} retained as review or rework candidates`);
}

function commandPlan(entries) {
  for (const entry of entries) {
    const { source, sourcePath } = sourceFor(entry);
    const paths = assetPaths(repoRoot, entry.id);
    console.log(`\n${entry.id}`);
    console.log(`  identity: ${repoRelative(sourcePath)} (${source.status})`);
    console.log(`  FLUX.2-pro: one 1536x1024 six-view draft`);
    console.log(`  GPT Image 2: one 1536x1024 identity-lock edit plus one strict 1024x1024 cardinal-elevation edit`);
    console.log(`  views: ${manifest.generation.views.map((view) => `${view.id}@${view.yaw}`).join(', ')}`);
    console.log(`  TRELLIS.2: ${manifest.trellis.mode}/${manifest.trellis.pipeline}, seed ${entry.seed}, target ${entry.decimationTarget}`);
    console.log(`  semantic inputs: ${Object.entries(manifest.trellis.semanticViewMap).map(([role, view]) => `${role}<-${view}`).join(', ')} from the strict cardinal source set`);
    console.log(`  candidate: ${repoRelative(paths.model)}`);
    console.log(`  prompt fingerprints: FLUX ${sha256Text(buildFluxTurntablePrompt(direction, source, entry, manifest)).slice(0, 12)}, GPT ${sha256Text(buildConsistencyPrompt(direction, source, entry, manifest)).slice(0, 12)}`);
  }
  console.log(`\nPLAN ${entries.length} assets, ${entries.length * 6} orbit views plus ${entries.length * 4} cardinal inputs, ${entries.length * 3} Azure image calls, ${entries.length} TRELLIS.2 jobs`);
}

function commandDoctor() {
  const errors = validate3dManifest(direction, sourceManifest, manifest);
  for (const filePath of [azureGenerate, azureEdit, removeChroma, path.join(trellisRoot, 'scripts', 'submit.py'), blenderExe, glbReviewScript, runtimePrepScript, gltfTransformCli]) {
    if (!existsSync(filePath)) errors.push(`Required tool is missing: ${filePath}`);
  }
  if (!process.env.AZURE_OPENAI_API_KEY) errors.push('AZURE_OPENAI_API_KEY is not available in the current environment');
  for (const entry of manifest.assets) {
    try { sourceFor(entry); } catch (error) { errors.push(error.message); }
  }
  for (const [command, args] of [['bash', ['--version']], ['python', ['--version']], ['magick', ['-version']]]) {
    const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) errors.push(`${command} is unavailable`);
  }
  const health = spawnSync('curl.exe', ['-fsS', `${manifest.trellis.server}/health/ready`], { encoding: 'utf8', windowsHide: true });
  if (health.status !== 0) errors.push(`TRELLIS.2 is not ready at ${manifest.trellis.server}`);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR ${error}`);
    throw new Error(`3D pipeline doctor found ${errors.length} problem(s)`);
  }
  console.log(`OK manifest ${manifest.version}: ${manifest.assets.length} assets x ${manifest.generation.views.length} views`);
  console.log(`OK Azure ${manifest.generation.draftModel} + ${manifest.generation.consistencyModel}`);
  console.log(`OK TRELLIS.2 ${manifest.trellis.server} ${health.stdout.trim()}`);
}

function main() {
  const { command, assetId, flags } = parseArgs(process.argv.slice(2));
  if (command === 'help' || command === '--help' || command === '-h') return usage();
  if (command === 'doctor') return commandDoctor();
  if (command === 'runtime-doctor') return commandRuntimeDoctor();
  const errors = validate3dManifest(direction, sourceManifest, manifest);
  if (errors.length) throw new Error(`Invalid 3D manifest:\n- ${errors.join('\n- ')}`);
  const entries = selectedEntries(assetId);
  if (command === 'plan') return commandPlan(entries);
  if (!['generate', 'contact-sheet', 'trellis', 'trellis-six', 'render', 'render-six', 'prepare-runtime', 'render-runtime', 'promote-runtime', 'all'].includes(command)) throw new Error(`Unknown command: ${command}`);
  for (const entry of entries) {
    if (command === 'generate') commandGenerate(entry, flags);
    else if (command === 'contact-sheet') commandContactSheet(entry, flags);
    else if (command === 'trellis') commandTrellis(entry, flags);
    else if (command === 'trellis-six') commandTrellisSix(entry, flags);
    else if (command === 'render') commandRender(entry, flags);
    else if (command === 'render-six') commandRenderSix(entry, flags);
    else if (command === 'prepare-runtime') commandPrepareRuntime(entry, flags);
    else if (command === 'render-runtime') commandRenderRuntime(entry, flags);
    else if (command === 'promote-runtime') commandPromoteRuntime(entry, flags);
    else {
      commandGenerate(entry, flags);
      commandContactSheet(entry, flags);
      commandTrellis(entry, flags);
      commandRender(entry, flags);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(`ERROR ${error.message}`);
  process.exitCode = 1;
}
