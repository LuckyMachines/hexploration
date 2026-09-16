import { describe, expect, it } from 'vitest';
import runtimeModels from '../../art-pipeline/runtime-models.json';
import { approvedRuntimeModelPath } from './runtimeModelCatalog';

describe('runtime model approval boundary', () => {
  it('returns only explicitly approved promoted models', () => {
    expect(approvedRuntimeModelPath(runtimeModels, 'prop-landing-beacon')).toBe('/models/prop-landing-beacon-lod2.glb');
    expect(approvedRuntimeModelPath(runtimeModels, 'prop-campsite-shelter')).toBeUndefined();
    expect(approvedRuntimeModelPath(runtimeModels, 'relic-tideglass-heart')).toBeUndefined();
  });

  it('rejects registry entries that are not approved', () => {
    const registry = { assets: [{ id: 'unsafe', reviewDecision: 'rejected', models: [{ id: 'lod2', path: '/unsafe.glb' }] }] };
    expect(approvedRuntimeModelPath(registry, 'unsafe')).toBeUndefined();
  });
});
