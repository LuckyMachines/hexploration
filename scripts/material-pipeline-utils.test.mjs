import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAL_CHANNELS, materialOutputPaths, validateMaterialRuntimeEvidence, validateMaterialSystem } from './material-pipeline-utils.mjs';

const fixture = {
  version: '1.0.0',
  channels: Object.fromEntries(MATERIAL_CHANNELS.map((channel) => [channel, { colorSpace: channel === 'baseColor' ? 'srgb' : 'linear' }])),
  qualityTiers: {
    high: { pixelRatioCap: 2, shadowMapSize: 2048, anisotropy: 8, shadows: true, environment: true, normalMap: true, aoMap: true, heightMap: true, compressedTextures: true },
    balanced: { pixelRatioCap: 1.5, shadowMapSize: 1024, anisotropy: 4, shadows: true, environment: true, normalMap: true, aoMap: true, heightMap: false, compressedTextures: true },
    efficient: { pixelRatioCap: 1, shadowMapSize: 512, anisotropy: 2, shadows: false, environment: false, normalMap: false, aoMap: false, heightMap: false, compressedTextures: true },
  },
  lightingRigs: Object.fromEntries(['neutral', 'discovery', 'danger', 'recovery', 'relic'].map((rig) => [rig, {
    exposure: 1,
    environmentIntensity: 0.5,
    fog: { color: '#000000', density: 0.02 },
    hemisphere: { sky: '#ffffff', ground: '#000000', intensity: 1 },
    key: { color: '#ffffff', intensity: 1 },
    fill: { color: '#ffffff', intensity: 1 },
    rim: { color: '#ffffff', intensity: 1 },
  }])),
  materials: Array.from({ length: 6 }, (_, index) => ({
    id: `surface-${index + 1}`,
    tileType: index + 1,
    label: `Surface ${index + 1}`,
    source: `source-${index + 1}.webp`,
    directory: `output-${index + 1}`,
    story: ['base', 'deposit', 'signal'],
    tint: '#ffffff',
    sideTint: '#222222',
    roughness: 0.8,
    metalness: 0,
    bumpScale: 0.04,
    normalScale: 0.3,
    aoIntensity: 0.7,
    emissiveColor: '#ffffff',
    emissiveIntensity: 0.02,
    uv: { repeat: 1, jitter: 0.1, rotationSteps: 6 },
  })),
  qualityContract: {
    dimensions: [512, 512],
    maxBytesPerMap: 180000,
    maxEdgeMeanDifference: 4,
    minimumRelationalScore: 3,
    performance: { maxDrawCalls: 180, maxTextures: 96, maxFrameP95Ms: 24, maxMaterialTextureMiB: 96 },
    captureRigs: ['neutral', 'danger'],
    captureQualities: ['high', 'efficient'],
  },
};

test('validates a complete surface and lighting contract', () => {
  assert.deepEqual(validateMaterialSystem(fixture), []);
});

test('builds predictable top and side channel paths', () => {
  const profile = fixture.materials[0];
  assert.match(materialOutputPaths('C:/repo', profile).normal, /output-1[\\/]normal\.webp$/);
  assert.match(materialOutputPaths('C:/repo', profile, { side: true }).normal, /output-1[\\/]side-normal\.webp$/);
});

test('rejects incomplete lighting, material, tier, and capture references', () => {
  const invalid = structuredClone(fixture);
  invalid.lightingRigs.danger.fill.color = 'red';
  invalid.materials[0].normalScale = 3;
  invalid.qualityTiers.balanced.anisotropy = 16;
  invalid.qualityContract.captureRigs.push('celebration');
  const errors = validateMaterialSystem(invalid);
  assert.ok(errors.some((error) => error.includes('danger.fill')));
  assert.ok(errors.some((error) => error.includes('normalScale')));
  assert.ok(errors.some((error) => error.includes('anisotropy must decrease')));
  assert.ok(errors.some((error) => error.includes('unknown rig')));
});

test('accepts either an in-budget frame or a completed adaptive fallback', () => {
  const board = {
    materialSystemVersion: fixture.version,
    states: [
      { lens: 'ready', drawCalls: 120, textures: 60, triangles: 5000 },
      { lens: 'danger', drawCalls: 130, textures: 62, triangles: 6000 },
    ],
  };
  assert.deepEqual(validateMaterialRuntimeEvidence({ board, frame: { frameP95Ms: 20, pixelRatio: 1.5 } }, fixture), []);
  assert.deepEqual(validateMaterialRuntimeEvidence({ board, frame: { frameP95Ms: 100, pixelRatio: 1 } }, fixture), []);
  assert.match(validateMaterialRuntimeEvidence({ board, frame: { frameP95Ms: 40, pixelRatio: 1.5 } }, fixture)[0], /without reaching minimum pixel ratio/);
});
