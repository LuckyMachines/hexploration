import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLibraryReport,
  humanizeAssetId,
  matchesSelector,
  selectGroupAssets,
  validateLibraryContract,
} from './game-art-library-utils.mjs';

const manifest = {
  artDirectionVersion: '1.3.0',
  assets: [
    { id: 'encounter-one', name: 'One', family: 'encounter', assetType: 'transparent-focal', status: 'approved', output: { path: 'one.png', alpha: true } },
    { id: 'encounter-scene', name: 'Scene', family: 'encounter', assetType: 'feature-landscape', status: 'candidate', output: { path: 'scene.webp', alpha: false } },
  ],
};

const contract = {
  version: '1.0.0',
  artDirectionVersion: '1.3.0',
  groups: [
    { id: 'enemies', title: 'Enemies', description: 'Cutouts', target: 2, requiredAlpha: true, selectors: [{ families: ['encounter'], assetTypes: ['transparent-focal'] }] },
    { id: 'scenes', title: 'Scenes', description: 'Scenes', target: 1, selectors: [{ ids: ['encounter-scene'] }] },
  ],
};

test('selectors distinguish asset types inside one family', () => {
  assert.equal(matchesSelector(manifest.assets[0], contract.groups[0].selectors[0]), true);
  assert.equal(matchesSelector(manifest.assets[1], contract.groups[0].selectors[0]), false);
  assert.deepEqual(selectGroupAssets(manifest, contract.groups[0]).map((asset) => asset.id), ['encounter-one']);
});

test('validation reports coverage gaps without misclassifying assets', () => {
  const result = validateLibraryContract(contract, manifest, { fileExists: () => true });
  assert.deepEqual(result.errors, []);
  assert.match(result.warnings[0], /1\/2 target assets/);
  assert.match(result.warnings[1], /awaiting approval/);
});

test('report exposes coverage and missing output evidence', () => {
  const report = buildLibraryReport(contract, manifest, { fileExists: (path) => path !== 'scene.webp' });
  assert.equal(report.groups[0].targetMet, false);
  assert.deepEqual(report.groups[1].missing, ['encounter-scene']);
  assert.equal(report.totals.assets, 2);
  assert.equal(report.totals.ready, 1);
  assert.equal(report.score, 63);
});

test('asset ids become readable labels', () => {
  assert.equal(humanizeAssetId('character-signal-cartographer-focal.png'), 'Signal Cartographer');
});
