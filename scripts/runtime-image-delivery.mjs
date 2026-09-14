import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assessRuntimeImage, validateRuntimeImageManifest } from './runtime-image-delivery-utils.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'app', 'src', 'art-pipeline', 'runtime-image-delivery.json');
const command = process.argv.slice(2).find((value) => !value.startsWith('--')) || 'doctor';
const write = process.argv.includes('--write');
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

function inspect(manifest, { requireFingerprints = true } = {}) {
  const failures = validateRuntimeImageManifest(manifest);
  let sourceBytes = 0;
  let outputBytes = 0;
  for (const asset of manifest.assets || []) {
    const sourcePath = path.resolve(repoRoot, asset.source);
    const outputPath = path.resolve(repoRoot, asset.output);
    if (!existsSync(sourcePath)) {
      failures.push(`${asset.id}: source is missing`);
      continue;
    }
    if (!existsSync(outputPath)) {
      failures.push(`${asset.id}: runtime output is missing`);
      continue;
    }
    const sourceBuffer = readFileSync(sourcePath);
    const outputBuffer = readFileSync(outputPath);
    const result = assessRuntimeImage({
      asset,
      sourceBuffer,
      outputBuffer,
      sourceSha256: sha256(sourceBuffer),
      outputSha256: sha256(outputBuffer),
    });
    if (requireFingerprints && (!asset.sourceSha256 || !asset.outputSha256)) result.failures.push('fingerprints are missing');
    result.failures.forEach((failure) => failures.push(`${asset.id}: ${failure}`));
    sourceBytes += sourceBuffer.length;
    outputBytes += outputBuffer.length;
  }
  return { failures, sourceBytes, outputBytes, ratio: sourceBytes ? outputBytes / sourceBytes : 1 };
}

function doctor(manifest) {
  const result = inspect(manifest);
  if (result.failures.length) throw new Error(`Runtime image doctor found ${result.failures.length} problem(s):\n- ${result.failures.join('\n- ')}`);
  console.log(`PASS ${manifest.assets.length} lossless runtime images: ${(result.sourceBytes / 1048576).toFixed(2)} MiB -> ${(result.outputBytes / 1048576).toFixed(2)} MiB (${((1 - result.ratio) * 100).toFixed(1)}% smaller)`);
}

function generate(manifest) {
  if (!write) throw new Error('generate is a write operation; add --write');
  const failures = validateRuntimeImageManifest(manifest);
  if (failures.length) throw new Error(`Invalid runtime image manifest:\n- ${failures.join('\n- ')}`);
  for (const asset of manifest.assets) {
    const sourcePath = path.resolve(repoRoot, asset.source);
    const outputPath = path.resolve(repoRoot, asset.output);
    if (!existsSync(sourcePath)) throw new Error(`${asset.id}: source is missing`);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    const result = spawnSync('magick', [sourcePath, '-define', 'webp:lossless=true', '-define', 'webp:method=6', outputPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.error || result.status !== 0) throw new Error(`${asset.id}: ImageMagick failed: ${result.error?.message || result.stderr}`);
    const sourceBuffer = readFileSync(sourcePath);
    const outputBuffer = readFileSync(outputPath);
    asset.sourceSha256 = sha256(sourceBuffer);
    asset.outputSha256 = sha256(outputBuffer);
    asset.width = assessRuntimeImage({ asset, sourceBuffer, outputBuffer, sourceSha256: asset.sourceSha256, outputSha256: asset.outputSha256 }).sourceSize.width;
    asset.height = assessRuntimeImage({ asset, sourceBuffer, outputBuffer, sourceSha256: asset.sourceSha256, outputSha256: asset.outputSha256 }).sourceSize.height;
    asset.sourceBytes = sourceBuffer.length;
    asset.outputBytes = outputBuffer.length;
  }
  manifest.generatedAt = new Date().toISOString();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  doctor(manifest);
}

try {
  const manifest = readManifest();
  if (command === 'generate') generate(manifest);
  else if (command === 'doctor') doctor(manifest);
  else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
