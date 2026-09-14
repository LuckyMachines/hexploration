import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
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
  evaluateRuntimeModel,
  inspectGlbBuffer,
  validateTransparentView,
  validate3dManifest,
} from './art-3d-pipeline-utils.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const direction = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/art-pipeline/art-direction.json'), 'utf8'));
const sourceManifest = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/art-pipeline/asset-manifest.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/art-pipeline/asset-3d-manifest.json'), 'utf8'));
const review = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/art-pipeline/asset-3d-review.json'), 'utf8'));
const runtimeRegistry = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/art-pipeline/runtime-models.json'), 'utf8'));
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

test('manifest validation rejects destructive orbit crops and unknown matte modes', () => {
  const invalid = structuredClone(manifest);
  invalid.assets[0].orbitCrop = { leftInset: 300, rightInset: 212 };
  invalid.assets[0].cardinalMatteMode = 'erase-everything';
  invalid.assets[0].cardinalReferenceMode = 'every-old-concept';
  invalid.assets[0].lodSimplifyRatios = { lod9: 0, lod2: 1.5 };
  invalid.assets[0].lodBudgetOverrides = { lod8: { maxTriangles: 0, mystery: 42 } };
  invalid.assets[0].materialOverride = { metallicFactor: 2, glow: 1, baseColorRemap: { shadow: 'green', highlight: '#abcdef', gamma: 0 } };
  const errors = validate3dManifest(direction, sourceManifest, invalid);
  assert.ok(errors.some((error) => /orbitCrop removes the complete source cell/.test(error)));
  assert.ok(errors.some((error) => /cardinalMatteMode must be/.test(error)));
  assert.ok(errors.some((error) => /cardinalReferenceMode must be/.test(error)));
  assert.ok(errors.some((error) => /unknown lod9/.test(error)));
  assert.ok(errors.some((error) => /lod2 simplify ratio must be/.test(error)));
  assert.ok(errors.some((error) => /lodBudgetOverrides references unknown lod8/.test(error)));
  assert.ok(errors.some((error) => /maxTriangles override must be/.test(error)));
  assert.ok(errors.some((error) => /unsupported lod8 budget override mystery/.test(error)));
  assert.ok(errors.some((error) => /metallicFactor must be between 0 and 1/.test(error)));
  assert.ok(errors.some((error) => /unsupported material override glow/.test(error)));
  assert.ok(errors.some((error) => /baseColorRemap.shadow must be a hex color/.test(error)));
  assert.ok(errors.some((error) => /baseColorRemap.gamma must be above 0/.test(error)));
});

test('identity-only cardinal prompts exclude conflicting legacy input roles', () => {
  const identityEntry = { ...entry, cardinalReferenceMode: 'identity-only' };
  const cardinal = buildCardinalPrompt(direction, source, identityEntry);
  assert.match(cardinal, /SOLE INPUT/);
  assert.match(cardinal, /Do not revert to any earlier 2D concept/);
  assert.doesNotMatch(cardinal, /INPUT ROLE 1/);
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
  assert.deepEqual(cellGeometry(manifest, manifest.generation.views[5], { topInset: 8, rightInset: 12, bottomInset: 64, leftInset: 16 }), {
    width: 484,
    height: 440,
    x: 1040,
    y: 520,
  });
});

test('transparent view validation rejects empty and background-dominated crops', () => {
  const valid = { width: 512, height: 512, channels: 'srgba', opaque: false, alphaMean: 0.14 };
  assert.deepEqual(validateTransparentView(valid), []);
  assert.ok(validateTransparentView({ ...valid, alphaMean: 0.005 }).some((error) => /below/.test(error)));
  assert.ok(validateTransparentView({ ...valid, alphaMean: 0.96 }).some((error) => /exceeds/.test(error)));
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
  assert.ok(paths.runtimeModels.lod0.endsWith(`${entry.id}-lod0.glb`));
  assert.ok(paths.runtimeModels.lod1.endsWith(`${entry.id}-lod1.glb`));
  assert.ok(paths.runtimeModels.lod2.endsWith(`${entry.id}-lod2.glb`));
  assert.ok(paths.runtimeContactSheet.endsWith(`${entry.id}-runtime-contact.png`));
});

test('runtime GLB inspection and budgets reject oversized delivery assets', () => {
  const json = Buffer.from(JSON.stringify({
    asset: { version: '2.0' },
    accessors: [{ count: 600 }, { count: 300 }],
    meshes: [{ primitives: [{ mode: 4, indices: 0, attributes: { POSITION: 1 } }] }],
    materials: [{}],
    textures: [{}, {}],
    extensionsRequired: ['EXT_texture_webp'],
  }), 'utf8');
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const buffer = Buffer.alloc(20 + paddedLength, 0x20);
  buffer.write('glTF', 0, 'ascii');
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(paddedLength, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  json.copy(buffer, 20);
  const stats = inspectGlbBuffer(buffer);
  assert.equal(stats.triangles, 200);
  assert.equal(stats.vertices, 300);
  assert.equal(stats.materials, 1);
  assert.equal(stats.textures, 2);
  assert.equal(evaluateRuntimeModel(stats, manifest.runtime, manifest.runtime.lods[0]).passed, true);
  assert.equal(evaluateRuntimeModel({ ...stats, triangles: 999999 }, manifest.runtime, manifest.runtime.lods[0]).passed, false);
  assert.equal(evaluateRuntimeModel({ ...stats, extensionsRequired: ['EXT_unknown'] }, manifest.runtime, manifest.runtime.lods[0]).passed, false);
});

test('every 3D asset has one explicit reviewed lane selection', () => {
  assert.deepEqual(
    review.assets.map((asset) => asset.id).sort(),
    manifest.assets.map((asset) => asset.id).sort(),
  );
  for (const asset of review.assets) {
    assert.ok(['cardinal-multiview', 'six-orbit-multiimage', 'authored-hard-surface'].includes(asset.selectedLane));
    assert.ok(['cleanup-candidate', 'rework-required'].includes(asset.status));
    assert.ok(asset.selectedModel.startsWith(`artifacts/art/3d/${asset.id}/`));
  }
});

test('runtime promotions are approved, fingerprinted, and absent for rework decisions', () => {
  const registered = new Map(runtimeRegistry.assets.map((asset) => [asset.id, asset]));
  for (const asset of review.assets) {
    if (!asset.runtimeReview) continue;
    if (asset.runtimeReview.decision !== 'approved') {
      assert.equal(registered.has(asset.id), false, `${asset.id} must not be promoted`);
      continue;
    }
    const runtimeAsset = registered.get(asset.id);
    assert.ok(runtimeAsset, `${asset.id} approved runtime model must be registered`);
    assert.deepEqual(runtimeAsset.models.map((model) => model.id), ['lod0', 'lod1', 'lod2']);
    for (const model of runtimeAsset.models) {
      const modelPath = path.join(repoRoot, 'app', 'public', model.path.replace(/^\//, ''));
      assert.ok(existsSync(modelPath), `${asset.id}/${model.id} promoted model must exist`);
      const hash = createHash('sha256').update(readFileSync(modelPath)).digest('hex');
      assert.equal(hash, model.sha256, `${asset.id}/${model.id} promoted model fingerprint must match`);
    }
  }
});
