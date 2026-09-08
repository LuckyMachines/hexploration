#!/usr/bin/env node

import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildCompositionPlan,
  buildPrompt,
  createReviewTemplate,
  exportImage,
  findAsset,
  inspectImage,
  loadArtSystem,
  resolveRepoPath,
  scoreReview,
  sha256File,
  summarizeArtSystem,
  validateArtSystem,
  validateImageAgainstAsset,
} from './art-pipeline-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const { direction, manifest, manifestPath } = loadArtSystem(repoRoot);

function parseArguments(values) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const [rawKey, inlineValue] = value.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      flags[rawKey] = inlineValue;
    } else if (values[index + 1] && !values[index + 1].startsWith('--')) {
      flags[rawKey] = values[index + 1];
      index += 1;
    } else {
      flags[rawKey] = true;
    }
  }
  return { positionals, flags };
}

function printHelp() {
  console.log(`Xenovoya art pipeline

Commands:
  doctor [--strict]                         Validate contracts, files, dimensions, formats, and fingerprints.
  list [--status status]                    Show the asset inventory and next state.
  brief <asset-id> [--write]                Compile a generation or capture brief.
  generate <asset-id> --variant name [--direction text] [--size WIDTHxHEIGHT] --write [--out path] [--replace]
                                             Generate a raw candidate through the authorized FLUX.2-pro adapter.
  cutout <asset-id> <source-path> --write [--fuzz percent] [--background color] [--seeds "x,y;x,y"] [--all-background] [--out path] [--replace]
                                             Remove an isolation background and export a contract-valid alpha asset.
  composition <composition-id>              Show the reusable layer stack.
  inspect <asset-id> <candidate-path>        Validate a candidate against its delivery contract.
  export <asset-id> <source-path> --write [--out path] [--replace]
                                             Normalize a source into its exact delivery contract.
  review <asset-id> [candidate] [--write] [--mode mode] [--tool tool] [--model model]
                                             Create a joy-review scorecard with generation provenance.
  review-check <review-path>                 Calculate the evidence-weighted joy score.
  contact-sheet <asset-id> <files...> --write [--out path] [--columns count] [--thumbnail geometry] [--labels filename|variant|asset] [--replace]
                                             Build a deterministic candidate comparison.
  context-sheet <asset-id> <candidate> --write [--out path] [--replace]
                                             Check an alpha asset at board and thumbnail scale on three surfaces.
  promote <asset-id> <candidate> --review path --write [--replace]
                                             Promote only a technically valid, approved candidate.

Generated working files live under artifacts/art/ and are ignored by Git.
Promotion is the only command that writes to app/public, and it requires --write.`);
}

function writeArtifact(relativePath, contents) {
  const target = resolveRepoPath(repoRoot, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
  return target;
}

function commandDoctor(flags) {
  const result = validateArtSystem(direction, manifest, { repoRoot, checkFiles: true });
  const summary = summarizeArtSystem(direction, manifest);
  console.log(`Art direction ${direction.version}; manifest ${manifest.version}`);
  console.log(`${summary.assets} assets; ${summary.compositions} compositions`);
  console.log(Object.entries(summary.statuses).map(([key, value]) => `${key}=${value}`).join('  '));
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`FAIL ${error}`);
  const failed = result.errors.length > 0 || (flags.strict && result.warnings.length > 0);
  if (failed) process.exitCode = 1;
  else console.log('PASS Art contracts and tracked files are valid.');
}

function commandList(flags) {
  const assets = flags.status ? manifest.assets.filter((asset) => asset.status === flags.status) : manifest.assets;
  for (const asset of assets) {
    console.log(`${asset.status.padEnd(11)} ${asset.id.padEnd(34)} ${asset.emotionalBeat.padEnd(12)} ${asset.output.path}`);
  }
  if (assets.length === 0) console.log('No assets match that status.');
}

function commandBrief(assetId, flags) {
  if (!assetId) throw new Error('brief requires an asset id');
  const prompt = buildPrompt(direction, manifest, assetId);
  if (!flags.write) {
    console.log(prompt);
    return;
  }
  const target = writeArtifact(`artifacts/art/briefs/${assetId}.md`, `# ${assetId}\n\n${prompt}\n`);
  console.log(`WROTE ${path.relative(repoRoot, target)}`);
}

function commandGenerate(assetId, flags) {
  const asset = findAsset(manifest, assetId);
  if (asset.family === 'proof') throw new Error('Product proof must be captured from the real build, not generated');
  const variant = String(flags.variant || '').trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(variant)) throw new Error('generate requires --variant with a kebab-case name');

  const relativeOutput = flags.out || `artifacts/art/candidates/${asset.id}/${asset.id}-${variant}.png`;
  const output = resolveRepoPath(repoRoot, relativeOutput);
  if (existsSync(output) && !flags.replace) throw new Error(`Candidate exists; use --replace: ${relativeOutput}`);

  const codexRoot = process.env.CODEX_HOME || path.join(homedir(), '.codex');
  const defaultAzureHelper = path.join(codexRoot, 'azure-image.sh');
  const helper = process.env.ART_FLUX2_COMMAND
    ? path.resolve(process.env.ART_FLUX2_COMMAND)
    : existsSync(defaultAzureHelper)
      ? defaultAzureHelper
      : path.join(codexRoot, 'flux2-pro-image.sh');
  if (!existsSync(helper)) throw new Error(`FLUX.2-pro adapter is unavailable: ${helper}`);
  const requestedSize = String(flags.size || '1024x1024');
  if (!/^\d{3,4}x\d{3,4}$/.test(requestedSize)) throw new Error('size must use WIDTHxHEIGHT');

  const basePrompt = buildPrompt(direction, manifest, asset.id);
  const variationDirection = typeof flags.direction === 'string' ? flags.direction.trim() : '';
  const prompt = variationDirection ? `${basePrompt}\nVariation direction: ${variationDirection}` : basePrompt;
  if (!flags.write) {
    console.log(`DRY RUN FLUX.2-pro -> ${relativeOutput}`);
    console.log('Add --write to make the billable generation request.');
    return;
  }

  mkdirSync(path.dirname(output), { recursive: true });
  const promptPath = output.replace(/\.[^.]+$/, '.prompt.md');
  writeFileSync(promptPath, `# ${asset.name} / ${variant}\n\n${prompt}\n`);
  const helperArgs = path.basename(helper).toLowerCase() === 'azure-image.sh'
    ? [helper, prompt, output, 'FLUX.2-pro', requestedSize]
    : [helper, prompt, output];
  const result = spawnSync('bash', helperArgs, { encoding: 'utf8', windowsHide: true });
  if (result.error) throw new Error(`FLUX.2-pro adapter failed to start: ${result.error.message}`);
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'FLUX.2-pro generation failed').trim());
  if (!existsSync(output)) throw new Error('FLUX.2-pro adapter completed without creating a candidate');

  const metadata = inspectImage(output);
  const normalizedCandidatePath = path.relative(repoRoot, output).replaceAll('\\', '/');
  const receipt = {
    assetId: asset.id,
    variant,
    generatedAt: new Date().toISOString(),
    provider: 'azure-foundry',
    model: 'FLUX.2-pro',
    variationDirection,
    requestedSize,
    promptSha256: sha256Text(prompt),
    candidateSha256: sha256File(output),
    candidate: normalizedCandidatePath,
    promptFile: path.relative(repoRoot, promptPath).replaceAll('\\', '/'),
    sourceReferences: asset.references,
    observed: metadata,
    next: asset.output.alpha
      ? `npm run art:cutout -- ${asset.id} ${normalizedCandidatePath} --write`
      : `npm run art:export -- ${asset.id} ${normalizedCandidatePath} --write`,
  };
  writeFileSync(output.replace(/\.[^.]+$/, '.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`GENERATED ${path.relative(repoRoot, output)} with Azure Foundry FLUX.2-pro`);
  console.log(`OBSERVED ${metadata.width}x${metadata.height} ${metadata.format.toUpperCase()} ${metadata.bytes} bytes`);
  console.log(`RECEIPT ${path.relative(repoRoot, output.replace(/\.[^.]+$/, '.json'))}`);
  console.log(`PROMPT ${path.relative(repoRoot, promptPath)}`);
  console.log('Raw provider output is not approved art. Normalize, compare, review, and promote it.');
}

function commandCutout(assetId, sourceValue, flags) {
  const asset = findAsset(manifest, assetId);
  if (!asset.output.alpha) throw new Error(`cutout requires an alpha-enabled asset contract; ${assetId} is opaque`);
  const source = candidatePath(sourceValue);
  if (!flags.write) throw new Error('cutout is a write operation; add --write');

  const fuzz = Number.parseFloat(flags.fuzz || '13');
  if (!Number.isFinite(fuzz) || fuzz < 0 || fuzz > 30) throw new Error('fuzz must be a number from 0 to 30');
  const background = String(flags.background || 'white');
  if (!/^(?:white|#[a-fA-F0-9]{6})$/.test(background)) throw new Error('background must be white or a six-digit hex color');
  const interiorSeeds = flags.seeds
    ? String(flags.seeds).split(';').filter(Boolean).map((seed) => {
      const match = seed.trim().match(/^(\d+),(\d+)$/);
      if (!match) throw new Error('seeds must be source-image pixel coordinates formatted as "x,y;x,y"');
      return [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10)];
    })
    : [];
  if (flags['all-background'] && interiorSeeds.length > 0) {
    throw new Error('Choose either --seeds or --all-background, not both');
  }
  const sourceMetadata = inspectImage(source);
  for (const [x, y] of interiorSeeds) {
    if (x >= sourceMetadata.width || y >= sourceMetadata.height) {
      throw new Error(`seed ${x},${y} is outside the ${sourceMetadata.width}x${sourceMetadata.height} source image`);
    }
  }
  const backgroundScope = flags['all-background'] ? 'all' : interiorSeeds.length > 0 ? 'connected-plus-seeds' : 'connected';

  const relativeOutput = flags.out || `artifacts/art/exports/${asset.id}.${asset.output.format}`;
  const output = resolveRepoPath(repoRoot, relativeOutput);
  if (path.resolve(source) === path.resolve(output)) throw new Error('Cutout source and destination must be different files');
  if (existsSync(output) && !flags.replace) throw new Error(`Output exists; use --replace: ${relativeOutput}`);

  const sourceStem = path.basename(source, path.extname(source));
  const prepared = resolveRepoPath(repoRoot, `artifacts/art/prepared/${asset.id}/${sourceStem}-alpha.png`);
  mkdirSync(path.dirname(prepared), { recursive: true });
  const extractionArgs = [source, '-auto-orient', '-alpha', 'on', '-fuzz', `${fuzz}%`];
  if (backgroundScope === 'all') {
    extractionArgs.push('-transparent', background);
  } else {
    extractionArgs.push(
      '-bordercolor', background,
      '-border', '1',
      '-fill', 'none',
      '-draw', 'alpha 0,0 floodfill',
    );
    for (const [x, y] of interiorSeeds) extractionArgs.push('-draw', `alpha ${x + 1},${y + 1} floodfill`);
    extractionArgs.push('-shave', '1x1');
  }
  extractionArgs.push(prepared);
  const extraction = spawnSync('magick', extractionArgs, { encoding: 'utf8', windowsHide: true });
  if (extraction.error) throw new Error(`ImageMagick is unavailable: ${extraction.error.message}`);
  if (extraction.status !== 0) throw new Error((extraction.stderr || extraction.stdout || 'Cutout extraction failed').trim());

  mkdirSync(path.dirname(output), { recursive: true });
  const result = exportImage(asset, prepared, output);
  const preparationReceipt = {
    assetId: asset.id,
    source: path.relative(repoRoot, source).replaceAll('\\', '/'),
    sourceSha256: sha256File(source),
    background,
    backgroundScope,
    interiorSeeds,
    fuzzPercent: fuzz,
    prepared: path.relative(repoRoot, prepared).replaceAll('\\', '/'),
    preparedSha256: sha256File(prepared),
    output: path.relative(repoRoot, output).replaceAll('\\', '/'),
    outputSha256: sha256File(output),
  };
  writeFileSync(prepared.replace(/\.[^.]+$/, '.json'), `${JSON.stringify(preparationReceipt, null, 2)}\n`);
  console.log(`PREPARED ${path.relative(repoRoot, prepared)} from ${backgroundScope} ${background} background at ${fuzz}% fuzz`);
  console.log(`WROTE ${path.relative(repoRoot, output)}`);
  console.log(`${result.metadata.width}x${result.metadata.height} ${result.metadata.format.toUpperCase()} ${result.metadata.channels} ${result.metadata.bytes} bytes`);
  for (const failure of result.failures) console.error(`FAIL ${failure}`);
  if (result.failures.length > 0) process.exitCode = 1;
  else console.log('PASS Cutout satisfies the technical delivery contract.');
}

function commandComposition(compositionId) {
  if (!compositionId) throw new Error('composition requires a composition id');
  console.log(buildCompositionPlan(direction, manifest, compositionId));
}

function candidatePath(value) {
  if (!value) throw new Error('A candidate path is required');
  const resolved = path.resolve(process.cwd(), value);
  if (!existsSync(resolved)) throw new Error(`Candidate does not exist: ${resolved}`);
  return resolved;
}

function commandInspect(assetId, candidateValue) {
  const asset = findAsset(manifest, assetId);
  const candidate = candidatePath(candidateValue);
  const metadata = inspectImage(candidate);
  const failures = validateImageAgainstAsset(asset, metadata);
  console.log(`${asset.id}: ${metadata.width}x${metadata.height} ${metadata.format.toUpperCase()} ${metadata.channels} ${metadata.bytes} bytes`);
  for (const failure of failures) console.error(`FAIL ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
  else console.log('PASS Candidate satisfies the technical delivery contract.');
}

function commandExport(assetId, sourceValue, flags) {
  const asset = findAsset(manifest, assetId);
  const source = candidatePath(sourceValue);
  if (!flags.write) throw new Error('export is a write operation; add --write');
  const relativeOutput = flags.out || `artifacts/art/exports/${asset.id}.${asset.output.format}`;
  const output = resolveRepoPath(repoRoot, relativeOutput);
  if (path.resolve(source) === path.resolve(output)) throw new Error('Export source and destination must be different files');
  if (existsSync(output) && !flags.replace) throw new Error(`Output exists; use --replace: ${relativeOutput}`);
  mkdirSync(path.dirname(output), { recursive: true });
  const result = exportImage(asset, source, output);
  console.log(`WROTE ${path.relative(repoRoot, output)}`);
  console.log(`${result.metadata.width}x${result.metadata.height} ${result.metadata.format.toUpperCase()} ${result.metadata.channels} ${result.metadata.bytes} bytes`);
  for (const failure of result.failures) console.error(`FAIL ${failure}`);
  if (result.failures.length > 0) process.exitCode = 1;
  else console.log('PASS Export satisfies the technical delivery contract.');
}

function commandReview(assetId, candidateValue, flags) {
  if (!assetId) throw new Error('review requires an asset id');
  const candidate = candidateValue ? candidatePath(candidateValue) : '';
  const reviewCandidate = candidate ? path.relative(repoRoot, candidate).replaceAll('\\', '/') : '';
  const review = createReviewTemplate(direction, manifest, assetId, reviewCandidate);
  review.candidateSha256 = candidate ? sha256File(candidate) : '';
  review.generation = {
    mode: flags.mode || (findAsset(manifest, assetId).family === 'proof' ? 'product-capture' : 'built-in-imagegen'),
    tool: flags.tool || '',
    model: flags.model || '',
    promptSha256: sha256Text(buildPrompt(direction, manifest, assetId)),
  };
  const serialized = `${JSON.stringify(review, null, 2)}\n`;
  if (!flags.write) {
    console.log(serialized);
    return;
  }
  const target = writeArtifact(`artifacts/art/reviews/${assetId}.json`, serialized);
  console.log(`WROTE ${path.relative(repoRoot, target)}`);
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

function commandReviewCheck(reviewValue) {
  const reviewPath = candidatePath(reviewValue);
  const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
  findAsset(manifest, review.assetId);
  const result = scoreReview(direction, review);
  console.log(`Joy score: ${result.joyScore}/10`);
  for (const error of result.errors) console.error(`FAIL ${error}`);
  if (!result.passed) process.exitCode = 1;
  else console.log('PASS Candidate clears every joy and continuity gate.');
}

function commandContactSheet(assetId, candidateValues, flags) {
  findAsset(manifest, assetId);
  if (!flags.write) throw new Error('contact-sheet is a write operation; add --write');
  if (candidateValues.length < 2) throw new Error('contact-sheet requires at least two candidate files');
  const candidates = candidateValues.map(candidatePath);
  const relativeOutput = flags.out || `artifacts/art/contact-sheets/${assetId}.png`;
  const output = resolveRepoPath(repoRoot, relativeOutput);
  if (existsSync(output) && !flags.replace) throw new Error(`Output exists; use --replace: ${relativeOutput}`);
  mkdirSync(path.dirname(output), { recursive: true });

  const columns = Number.parseInt(flags.columns || '2', 10);
  if (!Number.isInteger(columns) || columns < 1 || columns > 8) throw new Error('columns must be an integer from 1 to 8');
  const thumbnail = String(flags.thumbnail || '640x640>');
  if (!/^\d{2,4}x\d{2,4}>?$/.test(thumbnail)) throw new Error('thumbnail must use WIDTHxHEIGHT or WIDTHxHEIGHT>');

  const labelMode = String(flags.labels || 'filename');
  if (!['filename', 'variant', 'asset'].includes(labelMode)) throw new Error('labels must be filename, variant, or asset');
  const candidateLabel = (candidate) => {
    if (labelMode === 'filename') return path.basename(candidate);
    if (labelMode === 'asset') {
      const directoryId = path.basename(path.dirname(candidate));
      const filenameId = path.basename(candidate, path.extname(candidate));
      const matchedAsset = manifest.assets.find((asset) => asset.id === directoryId || asset.id === filenameId);
      return matchedAsset?.name || directoryId;
    }
    const receiptPath = candidate.replace(/\.[^.]+$/, '.json');
    if (!existsSync(receiptPath)) return path.basename(candidate);
    try {
      const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
      const shortId = String(receipt.assetId || '')
        .replace(/^(relic|environment|character)-/, '')
        .replace(/-focal$/, '');
      return `${shortId} / ${receipt.variant || path.basename(candidate)}`;
    } catch {
      return path.basename(candidate);
    }
  };

  const args = ['montage'];
  for (const candidate of candidates) args.push('-label', candidateLabel(candidate), candidate);
  args.push('-thumbnail', thumbnail, '-tile', `${columns}x`, '-geometry', '+24+52', '-background', '#0d0f0a', '-fill', '#e8c860', '-stroke', 'none', '-pointsize', '20', output);
  const result = spawnSync('magick', args, { encoding: 'utf8', windowsHide: true });
  if (result.error) throw new Error(`ImageMagick is unavailable: ${result.error.message}`);
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'Contact sheet failed').trim());
  console.log(`WROTE ${path.relative(repoRoot, output)}`);
}

function commandContextSheet(assetId, candidateValue, flags) {
  const asset = findAsset(manifest, assetId);
  if (!asset.output.alpha) throw new Error(`context-sheet requires an alpha-enabled asset contract; ${assetId} is opaque`);
  if (!flags.write) throw new Error('context-sheet is a write operation; add --write');
  const candidate = candidatePath(candidateValue);
  const relativeOutput = flags.out || `artifacts/art/contact-sheets/${assetId}-context.png`;
  const output = resolveRepoPath(repoRoot, relativeOutput);
  if (existsSync(output) && !flags.replace) throw new Error(`Output exists; use --replace: ${relativeOutput}`);
  mkdirSync(path.dirname(output), { recursive: true });

  const panelDir = resolveRepoPath(repoRoot, `artifacts/art/context-panels/${asset.id}`);
  mkdirSync(panelDir, { recursive: true });
  const surfaces = [
    ['paper', '#eee8d8', '#24231f'],
    ['night', '#101712', '#e8c860'],
    ['emberglass', '#3b2927', '#f4d47a'],
  ];
  const sizes = [220, 72];
  const panels = [];

  for (const size of sizes) {
    for (const [surface, background, foreground] of surfaces) {
      const panel = path.join(panelDir, `${surface}-${size}.png`);
      const label = `${surface} / ${size}px`;
      const args = [
        '-size', '360x300', `xc:${background}`,
        '(', candidate, '-thumbnail', `${size}x${size}>`, ')',
        '-gravity', 'center', '-geometry', '+0-10', '-composite',
        '-gravity', 'south', '-fill', foreground, '-stroke', 'none', '-pointsize', '18',
        '-annotate', '+0+16', label,
        panel,
      ];
      const panelResult = spawnSync('magick', args, { encoding: 'utf8', windowsHide: true });
      if (panelResult.error) throw new Error(`ImageMagick is unavailable: ${panelResult.error.message}`);
      if (panelResult.status !== 0) throw new Error((panelResult.stderr || panelResult.stdout || 'Context panel failed').trim());
      panels.push(panel);
    }
  }

  const result = spawnSync('magick', ['montage', ...panels, '-tile', '3x2', '-geometry', '+18+18', '-background', '#0d0f0a', output], { encoding: 'utf8', windowsHide: true });
  if (result.error) throw new Error(`ImageMagick is unavailable: ${result.error.message}`);
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'Context sheet failed').trim());
  console.log(`WROTE ${path.relative(repoRoot, output)}`);
}

function commandPromote(assetId, candidateValue, flags) {
  const candidate = candidatePath(candidateValue);
  if (!flags.review) throw new Error('promote requires --review <review-path>');
  const reviewPath = candidatePath(flags.review);
  const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
  if (review.assetId !== assetId) throw new Error(`Review belongs to ${review.assetId}, not ${assetId}`);
  if (review.decision !== 'approved') throw new Error('Review decision must be approved');
  const candidateFingerprint = sha256File(candidate);
  if (!/^[a-f0-9]{64}$/.test(review.candidateSha256 || '')) throw new Error('Review must record the candidate SHA-256 fingerprint');
  if (review.candidateSha256 !== candidateFingerprint) throw new Error('Candidate fingerprint does not match the reviewed file');
  const reviewResult = scoreReview(direction, review);
  if (!reviewResult.passed) throw new Error(`Review does not pass: ${reviewResult.errors.join('; ')}`);
  const lockPath = resolveRepoPath(repoRoot, 'artifacts/art/asset-manifest.lock');
  mkdirSync(path.dirname(lockPath), { recursive: true });
  let lockHandle;
  try {
    try {
      lockHandle = openSync(lockPath, 'wx');
    } catch (error) {
      if (error?.code === 'EEXIST') throw new Error('Another art promotion is updating the manifest. Retry this promotion after it finishes.');
      throw error;
    }

    const currentManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const asset = findAsset(currentManifest, assetId);
    const metadata = inspectImage(candidate);
    const failures = validateImageAgainstAsset(asset, metadata);
    if (failures.length > 0) throw new Error(`Candidate does not satisfy delivery contract: ${failures.join('; ')}`);
    const destination = resolveRepoPath(repoRoot, asset.output.path);
    if (!flags.write) {
      console.log(`DRY RUN ${path.relative(repoRoot, candidate)} -> ${asset.output.path}; joy ${reviewResult.joyScore}/10`);
      console.log('Add --write to promote. Existing outputs also require --replace.');
      return;
    }
    if (existsSync(destination) && !flags.replace) throw new Error(`Destination exists; use --replace: ${asset.output.path}`);

    mkdirSync(path.dirname(destination), { recursive: true });
    if (existsSync(destination)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backup = resolveRepoPath(repoRoot, `artifacts/art/backups/${asset.id}-${stamp}${path.extname(destination)}`);
      mkdirSync(path.dirname(backup), { recursive: true });
      copyFileSync(destination, backup);
      console.log(`BACKUP ${path.relative(repoRoot, backup)}`);
    }
    copyFileSync(candidate, destination);

    const durableReviewPath = resolveRepoPath(repoRoot, `app/src/art-pipeline/reviews/${asset.id}.json`);
    mkdirSync(path.dirname(durableReviewPath), { recursive: true });
    writeFileSync(durableReviewPath, `${JSON.stringify({ ...review, joyScore: reviewResult.joyScore }, null, 2)}\n`);
    asset.status = 'approved';
    asset.provenance = {
      origin: review.generation?.mode || 'reviewed-candidate',
      reviewedAt: review.reviewedAt,
      sha256: candidateFingerprint,
      review: path.relative(repoRoot, durableReviewPath).replaceAll('\\', '/'),
      promptSha256: review.generation?.promptSha256 || null,
    };
    writeFileSync(manifestPath, `${JSON.stringify(currentManifest, null, 2)}\n`);
    console.log(`PROMOTED ${asset.id} -> ${asset.output.path}; joy ${reviewResult.joyScore}/10`);
  } finally {
    if (lockHandle !== undefined) closeSync(lockHandle);
    if (lockHandle !== undefined && existsSync(lockPath)) unlinkSync(lockPath);
  }
}

const { positionals, flags } = parseArguments(process.argv.slice(2));
const [command = 'help', subject, ...rest] = positionals;

try {
  switch (command) {
    case 'doctor': commandDoctor(flags); break;
    case 'list': commandList(flags); break;
    case 'brief': commandBrief(subject, flags); break;
    case 'generate': commandGenerate(subject, flags); break;
    case 'cutout': commandCutout(subject, rest[0], flags); break;
    case 'composition': commandComposition(subject); break;
    case 'inspect': commandInspect(subject, rest[0]); break;
    case 'export': commandExport(subject, rest[0], flags); break;
    case 'review': commandReview(subject, rest[0], flags); break;
    case 'review-check': commandReviewCheck(subject); break;
    case 'contact-sheet': commandContactSheet(subject, rest, flags); break;
    case 'context-sheet': commandContextSheet(subject, rest[0], flags); break;
    case 'promote': commandPromote(subject, rest[0], flags); break;
    case 'help':
    case '--help':
    case '-h': printHelp(); break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
