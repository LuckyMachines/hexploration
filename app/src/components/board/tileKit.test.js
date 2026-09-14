import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import tileKitManifest from '../../art-pipeline/tile-kit.json';
import { Tile } from '../../lib/constants';
import {
  DENSE_BOARD_LANDMARK_CAP,
  TILE_FAMILIES,
  TILE_STATE_LAYERS,
  TILE_VARIANTS,
  createTileGeometry,
  tileBatchId,
  tileLandmarkRecipe,
  tileVariantIndex,
} from './tileKit';

describe('modular game tile kit', () => {
  it('defines six terrain families with three reusable forms each', () => {
    expect(Object.keys(TILE_FAMILIES)).toHaveLength(6);
    expect(TILE_VARIANTS.map((variant) => variant.id)).toEqual(['shelf', 'fracture', 'crown']);
    expect(DENSE_BOARD_LANDMARK_CAP).toBe(28);
    expect(tileKitManifest.runtime).toMatchObject({ families: 6, variantsPerFamily: 3 });
    expect(tileKitManifest.families).toHaveLength(6);
    expect(tileKitManifest.review.status).toBe('approved-reference');
  });

  it('selects a stable variant and landmark recipe from tile identity', () => {
    const first = tileVariantIndex(Tile.JUNGLE, 12345);
    const second = tileVariantIndex(Tile.JUNGLE, 12345);
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(3);
    expect(tileBatchId(Tile.JUNGLE, 12345)).toMatch(/^tile-1-(shelf|fracture|crown)$/);
    expect(tileLandmarkRecipe(Tile.JUNGLE, 12345)).toEqual(tileLandmarkRecipe(Tile.JUNGLE, 12345));
    for (const tileType of Object.keys(TILE_FAMILIES).map(Number)) {
      expect(new Set(Array.from({ length: 100 }, (_, seed) => tileVariantIndex(tileType, seed))).size).toBe(3);
    }
  });

  it('creates beveled geometry with distinct side and top material groups', () => {
    for (const [tileType, family] of Object.entries(TILE_FAMILIES)) {
      for (const variant of TILE_VARIANTS) {
        const geometry = createTileGeometry(THREE, variant, Number(tileType));
      expect(geometry.attributes.position.count).toBeGreaterThan(100);
      expect(geometry.groups).toHaveLength(2);
      expect(new Set(geometry.groups.map((group) => group.materialIndex))).toEqual(new Set([0, 1]));
      expect(geometry.boundingBox.min.y).toBeCloseTo(-0.5);
      expect(geometry.boundingBox.max.y).toBeCloseTo(0.5);
      expect(geometry.userData.variantId).toBe(variant.id);
      expect(geometry.userData.familyId).toBe(family.id);
      const position = geometry.attributes.position;
      const normal = geometry.attributes.normal;
      const sideVertexCount = 144;
      const outwardMean = Array.from({ length: sideVertexCount }, (_, index) => (
        position.getX(index) * normal.getX(index) + position.getZ(index) * normal.getZ(index)
      )).reduce((sum, value) => sum + value, 0) / sideVertexCount;
      expect(outwardMean).toBeGreaterThan(0.4);
      const topGroup = geometry.groups.find((group) => group.materialIndex === 1);
      const topNormalMean = Array.from({ length: topGroup.count }, (_, offset) => normal.getY(topGroup.start + offset))
        .reduce((sum, value) => sum + value, 0) / topGroup.count;
      expect(topNormalMean).toBeGreaterThan(0.99);
      geometry.dispose();
      }
    }
  });

  it('gives every terrain family its own grayscale-readable silhouette profile', () => {
    const signatures = Object.entries(TILE_FAMILIES).map(([tileType]) => {
      const geometry = createTileGeometry(THREE, 'shelf', Number(tileType));
      const position = geometry.attributes.position;
      const signature = Array.from({ length: position.count }, (_, index) => (
        `${position.getX(index).toFixed(3)},${position.getY(index).toFixed(3)},${position.getZ(index).toFixed(3)}`
      )).join('|');
      geometry.dispose();
      return signature;
    });
    expect(new Set(signatures).size).toBe(Object.keys(TILE_FAMILIES).length);
  });

  it('keeps every transient state out of the base-tile transform', () => {
    expect(Object.values(TILE_STATE_LAYERS).every((layer) => layer.mutatesBaseTransform === false)).toBe(true);
  });
});
