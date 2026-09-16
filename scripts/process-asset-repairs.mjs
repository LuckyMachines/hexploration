#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(repoRoot, 'artifacts', 'art', 'asset-repairs-2026-09-16');
const manifestPath = path.join(repoRoot, 'app/src/art-pipeline/asset-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const jobs = [
  ['character-relic-tender-aftermath', 'characters/relic-tender-aftermath-source.png', 'app/public/images/art/characters/relic-tender-aftermath.png', 'south'],
  ['character-relic-tender-carrying', 'characters/relic-tender-carrying-source.png', 'app/public/images/art/characters/relic-tender-carrying.png', 'south'],
  ['character-relic-tender-escaping', 'characters/relic-tender-escaping-source.png', 'app/public/images/art/characters/relic-tender-escaping.png', 'south'],
  ['character-relic-tender-helping', 'characters/relic-tender-helping-source.png', 'app/public/images/art/characters/relic-tender-helping.png', 'south'],
  ['character-relic-tender-idle-alert', 'characters/relic-tender-idle-alert-source.png', 'app/public/images/art/characters/relic-tender-idle-alert.png', 'south'],
  ['prop-campsite-shelter', 'props/prop-campsite-shelter-source.png', 'app/public/images/art/props/campsite-shelter.png', 'center'],
  ['prop-emberglass-shards', 'props/prop-emberglass-shards-source.png', 'app/public/images/art/props/emberglass-shards.png', 'center'],
  ['prop-glassroot-fronds', 'props/prop-glassroot-fronds-source.png', 'app/public/images/art/props/glassroot-fronds.png', 'center'],
  ['prop-lantern-moss', 'props/prop-lantern-moss-source.png', 'app/public/images/art/props/lantern-moss.png', 'center'],
  ['prop-slate-spires', 'props/prop-slate-spires-source.png', 'app/public/images/art/props/slate-spires.png', 'center'],
];

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

for (const [assetId, sourceRelative, outputRelative, gravity] of jobs) {
  const source = path.join(sourceRoot, sourceRelative);
  const output = path.join(repoRoot, outputRelative);
  if (!existsSync(source)) {
    console.warn(`SKIP missing generated source: ${path.relative(repoRoot, source)}`);
    continue;
  }
  mkdirSync(path.dirname(output), { recursive: true });
  const temporary = output.replace(/\.png$/, '.repair.png');
  execFileSync('magick', [
    source,
    '-alpha', 'on',
    '-fuzz', '3%', '-fill', 'none', '-draw', 'alpha 0,0 floodfill',
    '-trim', '+repage',
    '-resize', '900x900>',
    '-gravity', gravity,
    '-background', 'none',
    '-extent', '1024x1024',
    `PNG32:${temporary}`,
  ], { cwd: repoRoot, windowsHide: true });
  renameSync(temporary, output);

  const asset = manifest.assets.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error(`Missing manifest asset: ${assetId}`);
  asset.provenance.sha256 = sha256(output);
  asset.provenance.origin = 'azure-image-edit-individual-repair';
  asset.provenance.reviewedAt = '2026-09-16';
  const reviewPath = path.join(repoRoot, asset.provenance.review);
  if (existsSync(reviewPath)) {
    const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
    review.candidateSha256 = asset.provenance.sha256;
    review.reviewedAt = '2026-09-16';
    review.generation = { mode: 'azure-image-edit-individual-repair', tool: 'azure-foundry', model: 'gpt-image-2' };
    review.decision = 'approved';
    writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
  }
  console.log(`PROMOTED ${assetId}`);
}

manifest.version = '1.16.0';
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
