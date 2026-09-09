import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import {
  buildCharacterPrompt,
  createCharacterReview,
  loadCharacterSystem,
  scoreCharacterReview,
  validateCharacterSystem,
} from './character-pipeline-utils.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { catalog } = loadCharacterSystem(repoRoot);

describe('character pipeline', () => {
  test('catalog declares four unique role and character pairings', () => {
    const result = validateCharacterSystem(catalog, { repoRoot, checkFiles: false });
    assert.deepEqual(result.errors, []);
    assert.equal(new Set(catalog.roles.map((role) => role.characterId)).size, 4);
  });

  test('catalog validation rejects a role-character pairing that does not point back', () => {
    const broken = structuredClone(catalog);
    broken.characters[0].roleId = 'medic';
    const result = validateCharacterSystem(broken, { repoRoot, checkFiles: false });
    assert.ok(result.errors.some((error) => error.includes('points back')));
  });

  test('condition briefs repeat every identity invariant', () => {
    const prompt = buildCharacterPrompt(catalog, 'routekeeper', 'strained');
    assert.match(prompt, /same person/i);
    assert.match(prompt, /square lantern/i);
    assert.match(prompt, /changing age or facial structure/i);
  });

  test('relational review cannot hide one identity failure behind a high average', () => {
    const review = createCharacterReview(catalog, 'routekeeper', 'strained', path.join(repoRoot, 'app/public/images/art/characters/routekeeper-strained.png'), repoRoot);
    review.reviewer = 'Character QA';
    review.decision = 'approved';
    review.characterIdentity.scores = Object.fromEntries(Object.keys(review.characterIdentity.scores).map((dimension) => [dimension, 4]));
    assert.equal(scoreCharacterReview(review).passed, true);
    review.characterIdentity.scores.samePerson = 2;
    assert.equal(scoreCharacterReview(review).passed, false);
  });
});
