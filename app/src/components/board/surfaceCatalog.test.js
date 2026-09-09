import { describe, expect, it } from 'vitest';
import {
  MATERIAL_CHANNELS,
  MATERIAL_QUALITY_CONTRACT,
  SURFACE_PROFILES,
  materialAssetPath,
  materialTextureBudgetMiB,
  surfaceProfileForTile,
} from './surfaceCatalog';

describe('surface catalog', () => {
  it('defines a complete material bundle for every revealed tile type', () => {
    expect(SURFACE_PROFILES).toHaveLength(6);
    for (let tileType = 1; tileType <= 6; tileType += 1) {
      const profile = surfaceProfileForTile(tileType);
      expect(profile?.tileType).toBe(tileType);
      for (const channel of MATERIAL_CHANNELS) expect(materialAssetPath(profile, channel)).toMatch(`/materials/${profile.id}/${channel}.webp`);
    }
  });

  it('keeps the declared uncompressed material budget explicit', () => {
    expect(materialTextureBudgetMiB()).toBe(96);
    expect(materialTextureBudgetMiB()).toBeLessThanOrEqual(MATERIAL_QUALITY_CONTRACT.performance.maxMaterialTextureMiB);
  });
});
