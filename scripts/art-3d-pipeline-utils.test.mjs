import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assetPaths,
  buildConsistencyPrompt,
  buildCardinalPrompt,
  buildFluxTurntablePrompt,
  buildTrellisArgs,
  cellGeometry,
  validate3dManifest,
} from './art-3d-pipeline-utils.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const direction = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/art-pipeline/art-direction.json'), 'utf8'));
const sourceManifest = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/art-pipeline/asset-manifest.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/art-pipeline/asset-3d-manifest.json'), 'utf8'));
const review = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/art-pipeline/asset-3d-review.json'), 'utf8'));
const entry = manifest.assets[0];
const source = sourceManifest.assets.find((asset) => asset.id === entry.sourceAssetId);

test('the checked-in 3D manifest is valid and requires six views', () => {
  assert.deepEqual(validate3dManifest(direction, sourceManifest, manifest), []);
  assert.equal(manifest.generation.views.length, 6);
  assert.ok(existsSync(path.join(repoRoot, 'app/src/art-pipeline/schema/asset-3d-manifest.schema.json')));
});

test('cardinal crop regions cannot escape the provider sheet', () => {
  const invalid = structuredClone(manifest);
  invalid.assets[1].cardinalCrop.regions.right.width = 900;
  assert.ok(validate3dManifest(direction, sourceManifest, invalid)
    .some((error) => /right exceeds the 1024x1024 provider sheet/.test(error)));
});

test('prompt compilation names providers, roles, camera order, and isolation constraints', () => {
  const flux = buildFluxTurntablePrompt(direction, source, entry, manifest);
  const canonical = buildConsistencyPrompt(direction, source, entry, manifest);
  assert.match(flux, /exact six-view/i);
  assert.match(flux, /cell 6: front-left view at 300 degrees yaw/i);
  assert.match(canonical, /INPUT ROLE 1/);
  assert.match(canonical, /FLUX\.2-pro/);
  assert.match(canonical, /1536x1024/);
  assert.match(canonical, /Do not redesign/i);
  const cardinal = buildCardinalPrompt(direction, source, entry);
  assert.match(cardinal, /RIGHT SIDE profile at 90 degrees/i);
  assert.match(cardinal, /#00AEEF/);
});

test('grid cells divide the canonical sheet without overlap', () => {
  assert.deepEqual(cellGeometry(manifest, manifest.generation.views[0]), { width: 512, height: 512, x: 0, y: 0 });
  assert.deepEqual(cellGeometry(manifest, manifest.generation.views[5]), { width: 512, height: 512, x: 1024, y: 512 });
});

test('TRELLIS receives four semantic inputs selected from the strict cardinal set', () => {
  const views = ['front', 'right', 'back', 'left'].map((id) => ({ id, path: `${id}.png` }));
  const args = buildTrellisArgs('C:/trellis', manifest.trellis, entry, views, 'candidate.glb');
  assert.equal(args.filter((value) => ['--front', '--right', '--back', '--left'].includes(value)).length, 4);
  assert.ok(args.includes('front.png'));
  assert.ok(args.includes('right.png'));
  assert.ok(args.includes('back.png'));
  assert.ok(args.includes('left.png'));
  assert.ok(args.includes('multiview'));
  assert.ok(args.includes(String(entry.decimationTarget)));
});

test('candidate paths stay under the repository artifact root', () => {
  const paths = assetPaths(repoRoot, entry.id);
  assert.match(paths.model, /artifacts[\\/]art[\\/]3d/);
  assert.ok(paths.model.endsWith(`${entry.id}-trellis2-multiview.glb`));
  assert.ok(paths.modelContactSheet.endsWith(`${entry.id}-trellis2-cardinal-contact.png`));
  assert.ok(paths.experimentalModel.endsWith(`${entry.id}-trellis2-multiimage-experimental.glb`));
  assert.ok(paths.experimentalModelContactSheet.endsWith(`${entry.id}-trellis2-six-view-contact.png`));
});

test('every 3D asset has one explicit reviewed lane selection', () => {
  assert.deepEqual(
    review.assets.map((asset) => asset.id).sort(),
    manifest.assets.map((asset) => asset.id).sort(),
  );
  for (const asset of review.assets) {
    assert.ok(['cardinal-multiview', 'six-orbit-multiimage'].includes(asset.selectedLane));
    assert.ok(['cleanup-candidate', 'rework-required'].includes(asset.status));
    assert.ok(asset.selectedModel.startsWith(`artifacts/art/3d/${asset.id}/`));
  }
});
