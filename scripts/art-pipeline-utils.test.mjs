import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  buildCompositionPlan,
  buildPrompt,
  createReviewTemplate,
  loadArtSystem,
  resolveRepoPath,
  scoreReview,
  summarizeArtSystem,
  validateArtSystem,
  validateImageAgainstAsset,
} from './art-pipeline-utils.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { direction, manifest } = loadArtSystem(repoRoot);

describe('art pipeline contracts', () => {
  test('the checked-in art direction and manifest are internally valid', () => {
    const result = validateArtSystem(direction, manifest, { repoRoot });
    assert.deepEqual(result.errors, []);
    assert.equal(summarizeArtSystem(direction, manifest).assets, 47);
  });

  test('generation briefs combine visual DNA, emotional purpose, delivery, and avoid rules', () => {
    const prompt = buildPrompt(direction, manifest, 'relic-sunstone-lens-focal');
    assert.match(prompt, /Use case: stylized-concept/);
    assert.match(prompt, /genuinely transparent alpha/);
    assert.match(prompt, /Celebrate the decision and the crew/);
    assert.match(prompt, /direct imitation of a named artist/);
    assert.match(prompt, /1024x1024 PNG/);
  });

  test('product proof briefs reject invented interface imagery', () => {
    const prompt = buildPrompt(direction, manifest, 'gameplay-board-proof-one');
    assert.match(prompt, /do not use image generation/);
    assert.match(prompt, /Must come from the current build/);
  });

  test('composition plans expose ordered reusable parts and readiness', () => {
    const plan = buildCompositionPlan(direction, manifest, 'discovery-reveal');
    assert.match(plan, /BACKPLATE - Verdant Signal Terrain Base \[approved\]/);
    assert.match(plan, /FOCAL - Sunstone Lens Focal \[approved\]/);
    assert.match(plan, /Runtime data and UI copy must remain code-native/);
  });

  test('joy reviews require every gate and an evidence-weighted score of eight', () => {
    const review = createReviewTemplate(direction, manifest, 'fx-discovery-bloom', 'candidate.png');
    review.reviewer = 'Art review pair';
    review.scores = Object.fromEntries(direction.qualityGates.map((gate) => [gate.id, 4]));
    const passing = scoreReview(direction, review);
    assert.equal(passing.passed, true);
    assert.equal(passing.joyScore, 10);

    review.scores.recognition = 2;
    const failing = scoreReview(direction, review);
    assert.equal(failing.passed, false);
    assert.ok(failing.errors.some((error) => error.includes('recognition')));
  });

  test('character condition reviews require same-person relational evidence', () => {
    const asset = manifest.assets.find((item) => item.id === 'character-routekeeper-strained');
    const review = createReviewTemplate(direction, manifest, asset.id, 'candidate.png');
    review.reviewer = 'Character review pair';
    review.decision = 'approved';
    review.scores = Object.fromEntries(direction.qualityGates.map((gate) => [gate.id, 4]));
    review.characterIdentity.scores = Object.fromEntries(Object.keys(review.characterIdentity.scores).map((dimension) => [dimension, 4]));
    assert.equal(scoreReview(direction, review, { asset, manifest }).passed, true);
    review.characterIdentity.scores.samePerson = 2;
    assert.equal(scoreReview(direction, review, { asset, manifest }).passed, false);
  });

  test('character conditions require a matching canonical base and explicit identity locks', () => {
    const broken = structuredClone(manifest);
    const asset = broken.assets.find((item) => item.id === 'character-routekeeper-strained');
    asset.character.id = 'somebody-else';
    asset.prompt.identityLocks = [];
    const result = validateArtSystem(direction, broken, { repoRoot });
    assert.ok(result.errors.some((error) => error.includes('condition character id must match')));
    assert.ok(result.errors.some((error) => error.includes('five explicit identity locks')));
  });

  test('candidate validation enforces size, format, alpha, color space, and byte budget', () => {
    const asset = manifest.assets.find((item) => item.id === 'relic-sunstone-lens-focal');
    assert.deepEqual(validateImageAgainstAsset(asset, {
      width: 1024,
      height: 1024,
      format: 'png',
      channels: 'srgba',
      colorSpace: 'srgb',
      opaque: false,
      bytes: 800000,
    }), []);
    const failures = validateImageAgainstAsset(asset, {
      width: 512,
      height: 512,
      format: 'webp',
      channels: 'srgb',
      colorSpace: 'cmyk',
      opaque: true,
      bytes: 2000000,
    });
    assert.equal(failures.length, 6);
  });

  test('repository paths cannot escape the project', () => {
    assert.throws(() => resolveRepoPath(repoRoot, '../outside.png'), /escapes the repository/);
  });

  test('duplicate asset ids and output paths are rejected', () => {
    const broken = structuredClone(manifest);
    broken.assets.push(structuredClone(broken.assets[0]));
    const result = validateArtSystem(direction, broken, { repoRoot });
    assert.ok(result.errors.some((error) => error.includes('Duplicate asset id')));
    assert.ok(result.errors.some((error) => error.includes('duplicate output path')));
  });

  test('delegates generated material maps to the material-system registry', () => {
    const inspectManifestAsset = (filePath) => {
      const relativePath = path.relative(repoRoot, filePath).replaceAll('\\', '/');
      const asset = manifest.assets.find((item) => item.output.path === relativePath);
      assert.ok(asset, `Expected ${relativePath} to belong to a manifest asset`);
      return {
        width: asset.output.width,
        height: asset.output.height,
        format: asset.output.format,
        channels: asset.output.alpha ? 'srgba' : 'srgb',
        colorSpace: 'srgb',
        opaque: !asset.output.alpha,
        bytes: 1,
      };
    };
    const withoutDelegation = structuredClone(manifest);
    withoutDelegation.delegatedRoots = [];
    const validationOptions = { repoRoot, checkFiles: true, imageInspector: inspectManifestAsset };
    const unmanaged = validateArtSystem(direction, withoutDelegation, validationOptions);
    assert.ok(unmanaged.errors.some((error) => error.includes('app/public/images/art/materials/')));
    assert.deepEqual(validateArtSystem(direction, manifest, validationOptions).errors, []);
  });

  test('approved generated assets fail validation when their selected prompt drifts', () => {
    const changed = structuredClone(manifest);
    const asset = changed.assets.find((item) => item.id === 'relic-sunstone-lens-focal');
    asset.prompt.variationDirection = `${asset.prompt.variationDirection} Unreviewed change.`;
    const result = validateArtSystem(direction, changed, { repoRoot, checkFiles: false });
    assert.ok(result.errors.some((error) => error.includes('approved prompt fingerprint has drifted')));
  });
});
