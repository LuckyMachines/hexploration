import { useEffect, useMemo, useRef, useState } from 'react';
import { ACTION_LABELS, Action, PLAYER_COLORS, TILE_LABELS, Tile } from '../../lib/constants';
import { guestLocationArtwork } from '../../art-pipeline/finalArtCatalog';
import {
  CHARACTER_NEUTRAL_TEXTURE_PATHS,
  CHARACTER_TEXTURE_PATHS,
  deriveCharacterState,
  resolveCharacterVisual,
  resolvePlayerCharacter,
  runtimeImagePath,
} from '../../lib/characters';
import { buildBoardWorld, cameraPlan, seedForAlias, WORLD_TERRAIN } from './boardWorld';
import {
  nextPixelRatio,
  resolveBoardQuality,
  settleRendererWarmup,
  shouldUseAsyncShaderWarmup,
  shouldUseCompressedTextures,
} from './boardQuality';
import {
  MATERIAL_SYSTEM_VERSION,
  applySurfaceUvVariation,
  createSurfaceMaterial,
  loadSurfaceTextureSet,
  surfaceProfileForTile,
} from './surfaceCatalog';
import {
  createLightingSystem,
  disposeLightingSystem,
  resolveLightingRigId,
  setLightingRig,
  updateLightingSystem,
} from './lightingRigs';
import { attachBoardAssetRegistry, createBoardAssetRegistry } from './boardAssetRegistry';
import { resolveBoardBeat } from './boardBeatDirector';
import { cameraPresetAliases, clampBoardTarget, pointerExceededDragThreshold, resolvePickedAlias } from './boardInteraction';
import { boardLayerSignatures, baseTileTransform } from './boardSceneState';
import { deriveBoardViewModel } from './boardViewModel';
import { ENCOUNTER_TEXTURES, encounterTextureKey, encounterTextureKeysForTileTypes } from './encounterRoster';
import { bossPresentationFor, bossPresentationsForTileTypes } from './bossPresentation';
import { premiumBeatKey, presentationFrame } from './premiumPresentation';
import { DENSE_BOARD_LANDMARK_CAP, createTileGeometry, tileBatchId, tileFamilyFor, tileLandmarkRecipe, tileVariantFor } from './tileKit';
import runtimeModels from '../../art-pipeline/runtime-models.json';
const STATE_FX_TEXTURES = {
  discovery: '/images/art/fx/discovery-bloom.runtime.webp',
  danger: '/images/art/fx/redline-pressure.runtime.webp',
  route: '/images/art/fx/route-confirmation.runtime.webp',
  relic: '/images/art/fx/relic-awakening.runtime.webp',
};
const CUTOUT_PROP_TEXTURES = {
  [Tile.LANDING]: ['/images/art/props/landing-beacon.runtime.webp', '/images/art/props/survey-sled.runtime.webp'],
  [Tile.JUNGLE]: ['/images/art/props/glassroot-fronds.runtime.webp'],
  [Tile.PLAINS]: ['/images/art/props/lantern-moss.runtime.webp', '/images/art/props/field-cooklight.runtime.webp'],
  [Tile.DESERT]: ['/images/art/props/emberglass-shards.runtime.webp'],
  [Tile.MOUNTAIN]: ['/images/art/props/slate-spires.runtime.webp', '/images/art/props/storm-anchor.runtime.webp'],
  [Tile.RELIC]: ['/images/art/props/violet-reliquary.runtime.webp', '/images/art/props/tideglass-marker.runtime.webp'],
};
const CUTOUT_PROP_SCALES = {
  [Tile.LANDING]: [0.82, 1.08],
  [Tile.JUNGLE]: [1.08, 1.18],
  [Tile.PLAINS]: [1.18, 0.88],
  [Tile.DESERT]: [1, 1.1],
  [Tile.MOUNTAIN]: [1.18, 1.1],
  [Tile.RELIC]: [1.12, 1.14],
};
const CAMPSITE_PROP_TEXTURE = '/images/art/props/campsite-shelter.runtime.webp';
const SUNSTONE_LENS_TEXTURE = '/images/art/relics/sunstone-lens.runtime.webp';
const ATLAS_SPINDLE_TEXTURE = '/images/art/relics/atlas-spindle.runtime.webp';
const TIDEGLASS_CRADLE_TEXTURE = '/images/art/relics/tideglass-heart.runtime.webp';
const CAVERN_BACKPLATE = '/images/art/environments/glassroot-cavern.webp';
const EMBERGLASS_BACKPLATE = '/images/art/environments/emberglass-crossing.webp';
const ROUTE_FORK_TEXTURE = '/images/art/props/route-fork-marker.runtime.webp';
const LANDING_SKIFF_TEXTURE = '/images/art/props/landing-skiff.runtime.webp';
const LANDING_PAD_TEXTURE = '/images/art/tile-concepts/landing-pad-special.runtime.webp';
const runtimeModelPath = (assetId, lodId = 'lod2') => runtimeModels.assets
  .find((asset) => asset.id === assetId)?.models
  .find((model) => model.id === lodId)?.path;
const HERO_RELICS = Object.freeze([
  Object.freeze({
    id: 'sunstone-lens',
    modelPath: runtimeModelPath('relic-sunstone-lens-focal'),
    textureKey: 'sunstoneTexture',
    scale: 1.04,
    lightColor: '#f0a94f',
    emissive: '#6f2f0c',
  }),
  Object.freeze({
    id: 'tideglass-heart',
    modelPath: runtimeModelPath('relic-tideglass-heart'),
    textureKey: 'tideglassTexture',
    scale: 1.06,
    lightColor: '#73d8ab',
    emissive: '#174d39',
  }),
  Object.freeze({
    id: 'atlas-spindle',
    modelPath: runtimeModelPath('relic-atlas-spindle-focal'),
    textureKey: 'atlasTexture',
    scale: 1.28,
    lightColor: '#c8a2f0',
    emissive: '#472a63',
  }),
]);
const heroRelicForAlias = (alias = 'relic') => HERO_RELICS[seedForAlias(alias) % HERO_RELICS.length];
const WORLD_MOODS = Object.freeze({
  'glass-mist': {
    label: 'Glass mist',
    overlay: 'bg-[radial-gradient(circle_at_72%_18%,rgba(104,213,228,0.14),transparent_30%),linear-gradient(180deg,transparent_52%,rgba(5,8,6,0.78))]',
  },
  'rising-static': {
    label: 'Rising static',
    overlay: 'bg-[radial-gradient(circle_at_26%_28%,rgba(232,200,96,0.14),transparent_30%),linear-gradient(180deg,rgba(75,52,20,0.05),rgba(5,8,6,0.82))]',
  },
  'redline-storm': {
    label: 'Redline storm',
    overlay: 'bg-[radial-gradient(circle_at_58%_48%,rgba(239,98,87,0.17),transparent_28%),linear-gradient(180deg,transparent_54%,rgba(7,9,7,0.82))]',
  },
});

function disposeObject(object) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.filter(Boolean).forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    disposeObject(child);
  }
}

function cloneRuntimeModel(sourceModel) {
  const model = sourceModel.clone(true);
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry = object.geometry.clone();
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const clonedMaterials = sourceMaterials.map((sourceMaterial) => {
      const cloned = sourceMaterial.clone();
      for (const [key, value] of Object.entries(cloned)) {
        if (value?.isTexture) cloned[key] = value.clone();
      }
      return cloned;
    });
    object.material = Array.isArray(object.material) ? clonedMaterials : clonedMaterials[0];
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return model;
}

function addRuntimeModelProp(THREE, group, sourceModel, options = {}) {
  const model = options.disposableClone ? cloneRuntimeModel(sourceModel) : sourceModel.clone(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = (options.height || 0.9) / Math.max(0.001, size.y);
  model.scale.setScalar(scale);
  model.position.set(options.x || 0, options.y || 0, options.z || 0);
  model.rotation.y = options.rotationY || 0;
  model.name = options.name || 'runtime-model-prop';
  model.userData.kind = options.kind || 'runtime-model-prop';
  group.add(model);
  return model;
}

function material(THREE, color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0.08,
    emissive: options.emissive || '#000000',
    emissiveIntensity: options.emissiveIntensity || 0,
    transparent: Boolean(options.transparent),
    opacity: options.opacity ?? 1,
    depthWrite: options.depthWrite ?? true,
    flatShading: options.flatShading ?? true,
  });
}

function addCrystal(THREE, group, { x, z, height, color = '#8bd9d0', scale = 1 }) {
  const crystal = new THREE.Mesh(
    new THREE.ConeGeometry(0.11 * scale, height * scale, 5),
    material(THREE, color, {
      roughness: 0.34,
      metalness: 0.16,
      emissive: color,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.86,
    }),
  );
  crystal.position.set(x, height * scale * 0.5, z);
  crystal.rotation.y = (x + z) * 1.9;
  crystal.castShadow = true;
  group.add(crystal);
}

function addHeroRelicGeometry(THREE, group, seed) {
  const relic = new THREE.Group();
  relic.position.set(0.02, 0.08, 0.02);
  relic.userData.kind = 'hero-relic';
  relic.userData.seed = seed;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 32),
    new THREE.MeshBasicMaterial({ color: '#020303', transparent: true, opacity: 0.58, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1, 0.42, 1);
  shadow.position.y = 0.008;
  relic.add(shadow);

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 1),
    material(THREE, '#d2b8f2', {
      roughness: 0.16,
      metalness: 0.12,
      emissive: '#9060c0',
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.9,
    }),
  );
  core.position.y = 0.38;
  core.scale.set(0.76, 1.26, 0.76);
  core.castShadow = true;
  core.userData.kind = 'hero-relic-core';
  relic.add(core);

  const orbitMaterial = material(THREE, '#e8c860', {
    roughness: 0.28,
    metalness: 0.48,
    emissive: '#c4a64a',
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
  });
  for (let index = 0; index < 3; index += 1) {
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(0.25 + index * 0.035, 0.012, 6, 42), orbitMaterial.clone());
    orbit.position.y = 0.38;
    orbit.rotation.set(Math.PI / 2 + index * 0.48, index * 0.72, 0.25 + index * 0.33);
    orbit.userData.kind = 'hero-relic-orbit';
    orbit.userData.orbitIndex = index;
    relic.add(orbit);
  }

  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2 + (seed % 17) * 0.03;
    const rib = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.34, 4),
      material(THREE, index % 2 ? '#31372f' : '#45443a', { roughness: 0.76, metalness: 0.34 }),
    );
    rib.position.set(Math.cos(angle) * 0.25, 0.17, Math.sin(angle) * 0.25);
    rib.rotation.set(Math.sin(angle) * 0.34, -angle, Math.cos(angle) * 0.34);
    rib.castShadow = true;
    relic.add(rib);
  }

  const light = new THREE.PointLight('#b994e6', 1.05, 2.2, 2);
  light.position.set(0, 0.52, 0);
  relic.add(light);
  group.add(relic);
  return relic;
}

function addCutoutProp(THREE, group, tile, texture, seed, options = {}) {
  const prop = new THREE.Group();
  const [baseWidth, baseHeight] = options.scale || CUTOUT_PROP_SCALES[tile.tileType];
  const scaleVariation = 0.92 + (seed % 9) * 0.012;
  const mirror = options.mirror === false ? 1 : seed % 2 ? -1 : 1;
  const horizontalOffset = options.x ?? (((seed >> 5) & 7) / 7 - 0.5) * 0.18;
  const depthOffset = options.z ?? (((seed >> 9) & 7) / 7 - 0.5) * 0.12;

  if (!options.simplified) {
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.37, 24),
      new THREE.MeshBasicMaterial({ color: '#020503', transparent: true, opacity: 0.38, depthWrite: false }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.scale.set(baseWidth * 0.92, baseWidth * 0.36, 1);
    contactShadow.position.set(horizontalOffset, 0.012, depthOffset);
    prop.add(contactShadow);

    const backingTexture = texture.clone();
    backingTexture.needsUpdate = true;
    const backing = new THREE.Sprite(new THREE.SpriteMaterial({
      map: backingTexture,
      color: '#111913',
      transparent: true,
      opacity: 0.92,
      alphaTest: 0.08,
      depthWrite: false,
      toneMapped: true,
      fog: true,
    }));
    backing.center.set(0.5, 0.1);
    backing.position.set(horizontalOffset, 0.024, depthOffset);
    backing.scale.set(baseWidth * scaleVariation * 1.055 * mirror, baseHeight * scaleVariation * 1.055, 1);
    backing.renderOrder = 1;
    prop.add(backing);
  }

  const faceTexture = texture.clone();
  faceTexture.needsUpdate = true;
  const face = new THREE.Sprite(new THREE.SpriteMaterial({
    map: faceTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    alphaTest: 0.08,
    depthWrite: false,
    toneMapped: true,
    fog: true,
  }));
  face.center.set(0.5, 0.1);
  face.position.set(horizontalOffset, 0.028, depthOffset);
  face.scale.set(baseWidth * scaleVariation * mirror, baseHeight * scaleVariation, 1);
  face.renderOrder = 2;
  prop.add(face);
  prop.userData.face = face;
  prop.userData.baseRotationZ = 0;

  const lightColor = options.lightColor || (tile.tileType === Tile.RELIC ? '#b994e6' : '');
  if (lightColor && !options.simplified) {
    const relicLight = new THREE.PointLight(lightColor, options.lightIntensity || 0.72, 1.8, 2);
    relicLight.position.set(horizontalOffset, 0.42, depthOffset);
    prop.add(relicLight);
  }

  prop.userData.kind = options.kind || 'cutout-prop';
  prop.userData.persistent = Boolean(options.persistent);
  group.add(prop);
  return prop;
}

function addTerrainLandmarks(THREE, tile, mesh, propTexture, campsiteTexture, { simplified = false } = {}) {
  if (!tile.revealed || tile.tileType === Tile.NONE) return;
  const group = new THREE.Group();
  const seed = seedForAlias(tile.alias);
  const recipe = tileLandmarkRecipe(tile.tileType, seed);
  group.position.set(recipe?.offsetX || 0, tile.height / 2 + 0.02, recipe?.offsetZ || 0);
  group.rotation.y = recipe?.yaw || 0;
  group.scale.setScalar(recipe?.scale || 1);
  group.userData.tileRecipe = recipe;
  const offset = (shift) => (((seed >> shift) & 15) / 15 - 0.5) * 0.52;
  const cutoutProp = propTexture ? addCutoutProp(
    THREE,
    group,
    tile,
    propTexture,
    seed,
    tile.tileType === Tile.LANDING
      ? { x: -0.34, z: 0.12, mirror: false, persistent: true, lightColor: '#4c91db', lightIntensity: 0.58, simplified }
      : { simplified },
  ) : null;

  if (tile.tileType === Tile.RELIC && !simplified) {
    addHeroRelicGeometry(THREE, group, seed);
  }

  if (!propTexture && tile.tileType === Tile.JUNGLE) {
    for (let index = 0; index < 3; index += 1) {
      const height = 0.38 + ((seed >> (index * 3)) & 3) * 0.08;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.065, height, 5),
        material(THREE, '#263e2b', { roughness: 1 }),
      );
      trunk.position.set(offset(index * 4), height / 2, offset(index * 4 + 2));
      trunk.rotation.z = offset(index * 3 + 1) * 0.18;
      trunk.castShadow = true;
      group.add(trunk);
      addCrystal(THREE, group, {
        x: trunk.position.x,
        z: trunk.position.z,
        height: 0.22,
        color: '#6cc48d',
        scale: 0.72,
      });
    }
  }

  if (!propTexture && tile.tileType === Tile.PLAINS) {
    for (let index = 0; index < 5; index += 1) {
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.025, 0.2 + index * 0.025, 4),
        material(THREE, index % 2 ? '#9aa35c' : '#65783f', { roughness: 1 }),
      );
      blade.position.set(offset(index * 3), 0.1, offset(index * 3 + 1));
      blade.rotation.z = offset(index + 4) * 0.28;
      blade.castShadow = true;
      group.add(blade);
    }
  }

  if (!propTexture && tile.tileType === Tile.DESERT) {
    for (let index = 0; index < 3; index += 1) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.11 + index * 0.025, 0),
        material(THREE, index === 0 ? '#a7773b' : '#66502e', { roughness: 1 }),
      );
      rock.scale.y = 0.55 + index * 0.18;
      rock.position.set(offset(index * 4), 0.08, offset(index * 4 + 1));
      rock.rotation.set(offset(index) * 0.7, offset(index + 1) * 2, 0);
      rock.castShadow = true;
      group.add(rock);
    }
  }

  if (!propTexture && tile.tileType === Tile.MOUNTAIN) {
    for (let index = 0; index < 3; index += 1) {
      const height = 0.45 + index * 0.18;
      const peak = new THREE.Mesh(
        new THREE.ConeGeometry(0.22 - index * 0.025, height, 5),
        material(THREE, index === 2 ? '#879298' : '#4d565a', { roughness: 0.94 }),
      );
      peak.position.set((index - 1) * 0.18, height / 2, index === 1 ? -0.12 : 0.06);
      peak.rotation.y = index * 0.7;
      peak.castShadow = true;
      group.add(peak);
    }
  }

  if (!propTexture && tile.tileType === Tile.LANDING) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.035, 8, 32),
      material(THREE, '#69b7ef', { emissive: '#3a7cc4', emissiveIntensity: 1.4, roughness: 0.35 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.14, 0.5, 6),
      material(THREE, '#8ed7ff', { emissive: '#3a7cc4', emissiveIntensity: 1.8, roughness: 0.35 }),
    );
    beacon.position.y = 0.25;
    beacon.castShadow = true;
    group.add(beacon);
  }

  if (!propTexture && tile.tileType === Tile.RELIC) {
    const relic = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.29, 1),
      material(THREE, '#9cf6b2', {
        emissive: '#45d879',
        emissiveIntensity: 2.2,
        roughness: 0.18,
        metalness: 0.08,
        transparent: true,
        opacity: 0.9,
      }),
    );
    core.scale.set(0.72, 1.45, 0.72);
    core.position.y = 0.43;
    relic.add(core);
    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2;
      const shell = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.18, 0),
        material(THREE, '#242b25', { roughness: 0.96, metalness: 0.02 }),
      );
      shell.scale.set(0.7, 1.35, 0.52);
      shell.position.set(Math.cos(angle) * 0.29, 0.27, Math.sin(angle) * 0.29);
      shell.rotation.set(Math.sin(angle) * 0.35, -angle, Math.cos(angle) * 0.38);
      shell.castShadow = true;
      relic.add(shell);
    }
    const light = new THREE.PointLight('#54e88b', 1.8, 3.2, 2);
    light.position.set(0, 0.64, 0);
    relic.add(light);
    relic.userData.kind = 'relic';
    group.add(relic);
  }

  if (tile.hasCampsite && campsiteTexture) {
    addCutoutProp(THREE, group, tile, campsiteTexture, seed + 41, {
      scale: [0.86, 0.66],
      x: 0.32,
      z: -0.24,
      mirror: false,
      kind: 'campsite-cutout',
      lightColor: '#e8c860',
      lightIntensity: 0.45,
      simplified,
    });
  } else if (tile.hasCampsite) {
    const tent = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 0.34, 3),
      material(THREE, '#789d79', { roughness: 0.95 }),
    );
    tent.position.set(0.32, 0.17, -0.24);
    tent.rotation.y = Math.PI / 6;
    tent.castShadow = true;
    group.add(tent);
  }

  mesh.add(group);
  return cutoutProp;
}

function createPawn(THREE, color, isCurrent, standeeTexture, standeeProfile = {}) {
  const group = new THREE.Group();
  const visualScale = standeeProfile.visualScale || 1;
  const shadowWidth = standeeProfile.shadowWidth || 1;
  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 24),
    new THREE.MeshBasicMaterial({ color: '#010302', transparent: true, opacity: 0.62, depthWrite: false }),
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.scale.set(shadowWidth, 0.48, 1);
  contactShadow.position.y = 0.006;
  group.add(contactShadow);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.29, 0.12, 10),
    material(THREE, '#111712', { roughness: 0.8, metalness: 0.2 }),
  );
  base.position.y = 0.06;
  base.castShadow = true;
  group.add(base);

  if (standeeTexture) {
    const backingTexture = standeeTexture.clone();
    backingTexture.needsUpdate = true;
    const backing = new THREE.Sprite(new THREE.SpriteMaterial({
      map: backingTexture,
      color: '#101712',
      transparent: true,
      opacity: 0.94,
      alphaTest: 0.08,
      depthWrite: false,
      toneMapped: true,
      fog: true,
    }));
    backing.center.set(0.5, standeeProfile.footAnchor || 0.08);
    backing.position.y = 0.095;
    backing.scale.set(2.08 * visualScale, 2.36 * visualScale, 1);
    backing.renderOrder = 2;
    group.add(backing);

    const texture = standeeTexture.clone();
    texture.needsUpdate = true;
    const standee = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      alphaTest: 0.08,
      depthWrite: false,
      toneMapped: true,
      fog: true,
    }));
    standee.center.set(0.5, standeeProfile.footAnchor || 0.08);
    standee.position.y = 0.1;
    standee.scale.set(1.96 * visualScale, 2.22 * visualScale, 1);
    standee.renderOrder = 3;
    group.add(standee);
    group.userData.spriteLayers = [backing, standee];
  } else {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.16, 0.42, 8),
      material(THREE, color, { emissive: color, emissiveIntensity: isCurrent ? 0.55 : 0.18, roughness: 0.52 }),
    );
    body.position.y = 0.33;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 12, 8),
      material(THREE, '#d7d4bd', { roughness: 0.72 }),
    );
    head.position.y = 0.66;
    head.castShadow = true;
    group.add(head);
  }

  if (isCurrent) {
    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.025, 8, 32),
      material(THREE, color, { emissive: color, emissiveIntensity: 1.6, transparent: true, opacity: 0.82, depthWrite: false }),
    );
    aura.rotation.x = Math.PI / 2;
    aura.position.y = 0.05;
    aura.userData.kind = 'pulse';
    group.add(aura);

    const lantern = new THREE.PointLight(color, 0.42, 1.9, 2);
    lantern.position.set(0.18, 0.72, 0.12);
    lantern.userData.kind = 'character-lantern';
    group.add(lantern);
  }
  group.userData.kind = isCurrent ? 'current-pawn' : 'pawn';
  return group;
}

function addRoute(THREE, group, aliases, worldByAlias, color, opacity = 1, showWaypoints = true) {
  const points = aliases
    .map((alias) => worldByAlias.get(alias))
    .filter(Boolean)
    .map((tile) => new THREE.Vector3(tile.x, tile.height + 0.48, tile.z));
  if (points.length < 2) return;

  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
  const route = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(12, points.length * 10), 0.065, 8, false),
    material(THREE, color, {
      emissive: color,
      emissiveIntensity: 1.55,
      roughness: 0.32,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    }),
  );
  route.castShadow = true;
  group.add(route);
  if (showWaypoints) points.slice(1).forEach((point) => {
    const waypoint = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 10, 8),
      material(THREE, color, {
        emissive: color,
        emissiveIntensity: 1.8,
        roughness: 0.32,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 1,
      }),
    );
    waypoint.position.copy(point);
    group.add(waypoint);
  });
}

function playerSlotPosition(THREE, tile, slot, total) {
  const angle = (slot / Math.max(1, total)) * Math.PI * 2;
  const radius = total > 1 ? 0.28 : 0;
  return new THREE.Vector3(
    tile.x + Math.cos(angle) * radius,
    tile.height + 0.42,
    tile.z + Math.sin(angle) * radius,
  );
}

function addRescueLink(THREE, group, tile, helperSlot, targetSlot, total) {
  const rescue = new THREE.Group();
  const start = playerSlotPosition(THREE, tile, helperSlot, total);
  const end = playerSlotPosition(THREE, tile, targetSlot, total);
  const midpoint = start.clone().lerp(end, 0.5);
  midpoint.y += 1.5;
  const curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
  const beam = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 32, 0.05, 8, false),
    material(THREE, '#b994e6', {
      emissive: '#9060c0',
      emissiveIntensity: 2.8,
      roughness: 0.25,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      depthTest: false,
    }),
  );
  beam.renderOrder = 50;
  rescue.add(beam);

  const relay = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.1, 0),
    material(THREE, '#d8c1f4', {
      emissive: '#9060c0',
      emissiveIntensity: 3.4,
      roughness: 0.18,
      depthWrite: false,
      depthTest: false,
    }),
  );
  relay.position.copy(midpoint);
  relay.renderOrder = 51;
  rescue.add(relay);

  [start, end].forEach((position, index) => {
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(index === 0 ? 0.085 : 0.12, 12, 10),
      material(THREE, index === 0 ? '#b994e6' : '#70ddad', {
        emissive: index === 0 ? '#9060c0' : '#40a080',
        emissiveIntensity: 3,
        roughness: 0.2,
        depthTest: false,
      }),
    );
    node.position.copy(position);
    node.renderOrder = 51;
    rescue.add(node);
  });

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.54, 0.025, 8, 48),
    material(THREE, '#70ddad', {
      emissive: '#40a080',
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.set(tile.x, tile.height + 0.12, tile.z);
  rescue.add(halo);
  rescue.userData.rescueHalo = halo;
  group.add(rescue);
  return rescue;
}

function resetDynamicLayer(context, layerId) {
  const layer = context.layers[layerId];
  for (const child of [...layer.children]) {
    layer.remove(child);
    const poolKey = child.userData?.poolKey;
    if (poolKey) {
      child.visible = false;
      if (!context.objectPools.has(poolKey)) context.objectPools.set(poolKey, []);
      context.objectPools.get(poolKey).push(child);
    } else disposeObject(child);
  }
  context.animated = context.animated.filter((entry) => entry.layer !== layerId);
}

function pooledObject(context, poolKey, create) {
  const pool = context.objectPools.get(poolKey);
  const object = pool?.pop() || create();
  object.userData.poolKey = poolKey;
  object.visible = true;
  return object;
}

function animateInLayer(context, layerId, entry) {
  context.animated.push({ ...entry, layer: layerId });
}

function buildAffordanceLayer(THREE, context, state) {
  const group = context.layers.affordances;
  const selected = new Set(state.selectedPath || []);
  const reachable = new Set(state.reachableAliases || []);
  for (const tile of context.worldByAlias.values()) {
    if (reachable.has(tile.alias)) {
      const reachableHalo = pooledObject(context, 'reachable-halo', () => new THREE.Mesh(
        new THREE.CylinderGeometry(0.76, 0.76, 0.016, 6),
        material(THREE, '#6bd0c4', { emissive: '#4ebcad', emissiveIntensity: 1.4, transparent: true, opacity: 0.16, depthWrite: false }),
      ));
      reachableHalo.scale.set(1, 1, 1);
      reachableHalo.position.set(tile.x, tile.height + 0.025, tile.z);
      reachableHalo.rotation.y = Math.PI / 6;
      group.add(reachableHalo);
    }
    if (selected.has(tile.alias)) {
      const selectedHalo = pooledObject(context, 'selected-halo', () => new THREE.Mesh(
        new THREE.TorusGeometry(0.66, 0.025, 8, 36),
        material(THREE, '#e8c860', { emissive: '#c4a64a', emissiveIntensity: 1.7, transparent: true, opacity: 0.78, depthWrite: false }),
      ));
      selectedHalo.scale.set(1, 1, 1);
      selectedHalo.rotation.x = Math.PI / 2;
      selectedHalo.position.set(tile.x, tile.height + 0.19, tile.z);
      group.add(selectedHalo);
    }
    if (tile.alias === state.intentAlias) {
      const invalid = tile.alias === state.invalidAlias;
      const color = invalid || state.isDanger ? '#ef6257' : '#8ad9d1';
      const ring = pooledObject(context, `intent-ring:${invalid ? 'invalid' : state.isDanger ? 'danger' : 'normal'}`, () => new THREE.Mesh(
        new THREE.TorusGeometry(invalid ? 0.78 : 0.75, invalid ? 0.045 : 0.028, 8, 42),
        material(THREE, color, { emissive: color, emissiveIntensity: 2, transparent: true, opacity: 0.84, depthWrite: false }),
      ));
      ring.scale.set(1, 1, 1);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(tile.x, tile.height + 0.18, tile.z);
      group.add(ring);
      animateInLayer(context, 'affordances', { object: ring, kind: 'pulse', baseY: ring.position.y });
    }
  }
}

function buildIntentLayer(THREE, context, state) {
  const group = context.layers.intent;
  const intentTile = context.worldByAlias.get(state.intentAlias);
  const useRouteForkModel = Boolean(context.routeForkModel && state.activeAction !== Action.HELP && !state.hasSubmitted && !state.isDanger && !state.isResolving);
  const isPreviewingNewStep = state.signals?.isPreviewing ?? ((state.previewPath?.length || 0) > (state.selectedPath?.length || 0));
  const stateFxKey = state.isDanger
    ? 'danger'
    : intentTile?.tileType === Tile.RELIC
      ? 'relic'
      : isPreviewingNewStep
        ? 'route'
        : 'discovery';
  const stateFxTexture = context.fxTextures[stateFxKey];
  if (intentTile && stateFxTexture) {
    const stateFx = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.66),
      new THREE.MeshBasicMaterial({ map: stateFxTexture.clone(), color: 0xffffff, transparent: true, opacity: state.isDanger ? 0.64 : 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    stateFx.material.map.needsUpdate = true;
    stateFx.rotation.x = -Math.PI / 2;
    stateFx.rotation.z = state.isDanger ? -0.42 : 0.18;
    stateFx.position.set(intentTile.x, intentTile.height + 0.235, intentTile.z);
    group.add(stateFx);
  }
  const isRouteForkEncounter = state.encounterId === 'echo-fork';
  const boss = bossPresentationFor(state.encounterId);
  const bossTileTexture = boss ? context.bossTileTextures[boss.id] : null;
  if (intentTile && bossTileTexture) {
    const bossTileMap = bossTileTexture.clone();
    bossTileMap.needsUpdate = true;
    const bossTile = new THREE.Sprite(new THREE.SpriteMaterial({ map: bossTileMap, color: 0xffffff, transparent: true, opacity: 0.9, alphaTest: 0.06, depthWrite: false, toneMapped: true, fog: true }));
    bossTile.name = `boss-arena:${boss.id}`;
    bossTile.userData.kind = 'boss-arena-tile';
    bossTile.center.set(0.5, 0.16);
    bossTile.position.set(intentTile.x, intentTile.height + 0.025, intentTile.z);
    bossTile.scale.set(2.08, 1.62, 1);
    bossTile.renderOrder = 1;
    group.add(bossTile);
  }
  const encounterKey = intentTile ? encounterTextureKey(intentTile, state.encounterId) : null;
  const encounterTexture = (state.isDanger || state.encounterId) && intentTile
    ? state.encounterId === 'echo-fork'
      ? useRouteForkModel ? null : context.routeForkTexture
      : context.encounterTextures[boss?.enemyTextureKey || encounterKey]
    : null;
  if (encounterTexture) {
    const encounterPreview = new THREE.Group();
    encounterPreview.position.set(intentTile.x, intentTile.height + 0.03, intentTile.z);
    addCutoutProp(THREE, encounterPreview, intentTile, encounterTexture, seedForAlias(intentTile.alias) + 67, {
      scale: boss?.standeeScale || (intentTile.tileType === Tile.DESERT ? [0.72, 0.58] : [0.82, 0.58]), x: boss ? 0.08 : 0.26, z: boss ? -0.12 : -0.18, mirror: false, persistent: true,
      lightColor: boss?.lightColor || (intentTile.tileType === Tile.DESERT ? '#e8a243' : '#8ad9d1'), lightIntensity: boss ? 0.72 : 0.36, kind: boss ? 'boss-preview' : 'encounter-preview',
    });
    group.add(encounterPreview);
    animateInLayer(context, 'intent', { object: encounterPreview, kind: 'encounter-preview', baseY: encounterPreview.position.y });
  }
  if (intentTile && isRouteForkEncounter && useRouteForkModel) {
    const encounterModel = new THREE.Group();
    encounterModel.position.set(intentTile.x, intentTile.height + 0.03, intentTile.z);
    addRuntimeModelProp(THREE, encounterModel, context.routeForkModel, {
      height: 0.78,
      x: 0.22,
      z: -0.14,
      rotationY: -0.32,
      name: 'route-fork-encounter:model',
      kind: 'route-fork-encounter',
      disposableClone: true,
    });
    group.add(encounterModel);
    animateInLayer(context, 'intent', { object: encounterModel, kind: 'encounter-preview', baseY: encounterModel.position.y });
  }
  if (intentTile && isPreviewingNewStep && (useRouteForkModel || context.routeForkTexture)) {
    const routeFork = new THREE.Group();
    routeFork.position.set(intentTile.x, intentTile.height + 0.03, intentTile.z);
    if (useRouteForkModel) {
      addRuntimeModelProp(THREE, routeFork, context.routeForkModel, {
        height: 0.68,
        x: -0.34,
        z: 0.16,
        rotationY: 0.28,
        name: 'route-fork-preview:model',
        kind: 'route-fork-preview',
        disposableClone: true,
      });
    } else {
      addCutoutProp(THREE, routeFork, intentTile, context.routeForkTexture, seedForAlias(intentTile.alias) + 89, {
        scale: [0.42, 0.72], x: -0.34, z: 0.16, mirror: false, persistent: true, lightColor: '#e8c860', lightIntensity: 0.28, kind: 'route-fork-preview',
      });
    }
    group.add(routeFork);
  }
  const relicIdentity = intentTile ? heroRelicForAlias(intentTile.alias) : null;
  const relicTexture = relicIdentity ? context[relicIdentity.textureKey] : null;
  if (intentTile && intentTile.tileType === Tile.RELIC && relicTexture) {
    const relicPreview = new THREE.Group();
    relicPreview.position.set(intentTile.x, intentTile.height + 0.025, intentTile.z);
    addCutoutProp(THREE, relicPreview, intentTile, relicTexture, seedForAlias(intentTile.alias), {
      scale: state.isResolving ? [0.76, 0.9] : [0.62, 0.76], mirror: false, persistent: true,
      lightColor: relicIdentity.lightColor, lightIntensity: state.isResolving ? 1.2 : 0.74, kind: `${relicIdentity.id}-preview`,
    });
    group.add(relicPreview);
    animateInLayer(context, 'intent', { object: relicPreview, kind: 'relic-preview', baseY: relicPreview.position.y });
  }
  if (intentTile && state.isResolving) {
    for (let index = 0; index < 3; index += 1) {
      const wave = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.022, 8, 48),
        material(THREE, state.isDanger ? '#ef6257' : '#e8c860', { emissive: state.isDanger ? '#d44040' : '#c4a64a', emissiveIntensity: 2.2, transparent: true, opacity: 0.72, depthWrite: false }),
      );
      wave.rotation.x = Math.PI / 2;
      wave.position.set(intentTile.x, intentTile.height + 0.2 + index * 0.012, intentTile.z);
      group.add(wave);
      animateInLayer(context, 'intent', { object: wave, kind: 'resolve-wave', baseY: wave.position.y, delay: index / 3 });
    }
  }
}

function buildRouteLayer(THREE, context, state) {
  const routeAliases = [state.currentLocation, ...(state.previewPath || state.selectedPath || [])].filter(Boolean);
  addRoute(THREE, context.layers.route, [...new Set(routeAliases)], context.worldByAlias, state.isDanger ? '#ef6257' : state.hasSubmitted ? '#55d692' : '#e8c860', state.hasSubmitted ? 1 : 0.82, !state.isComplete);
}

function buildAssistanceLayer(THREE, context, state) {
  if (state.activeAction !== Action.HELP) return;
  const rescueEntry = Object.entries(state.playerLocationMap || {}).find(([, indices]) => indices?.includes(state.currentPlayerIndex) && indices.length > 1);
  if (!rescueEntry) return;
  const [alias, indices] = rescueEntry;
  const tile = context.worldByAlias.get(alias);
  const helperSlot = indices.indexOf(state.currentPlayerIndex);
  const targetSlot = indices.findIndex((playerIndex) => playerIndex !== state.currentPlayerIndex);
  if (tile && helperSlot >= 0 && targetSlot >= 0) {
    const rescue = addRescueLink(THREE, context.layers.assistance, tile, helperSlot, targetSlot, indices.length);
    animateInLayer(context, 'assistance', { object: rescue, kind: 'rescue-link', baseY: rescue.position.y });
  }
}

function buildPartyLayer(THREE, context, state) {
  Object.entries(state.playerLocationMap || {}).forEach(([alias, indices]) => {
    const tile = context.worldByAlias.get(alias);
    if (!tile) return;
    indices.forEach((playerIndex, index) => {
      const player = state.crew?.[playerIndex] || {};
      const character = resolvePlayerCharacter(player, playerIndex);
      const characterState = deriveCharacterState({ player, isCurrent: playerIndex === state.currentPlayerIndex, activeAction: state.activeAction, lowStats: state.lowStats, isResolving: state.isResolving, hasArtifact: Boolean(player.hasArtifact || player.inventory?.artifact) });
      const presentation = resolveCharacterVisual({ characterId: character.id, state: characterState });
      const stateTexture = context.characterTextures[presentation.path];
      const standeeTexture = stateTexture || context.characterTextures[runtimeImagePath(character.assets.neutral)];
      const pawn = createPawn(THREE, PLAYER_COLORS[playerIndex] || PLAYER_COLORS[0], playerIndex === state.currentPlayerIndex, standeeTexture, character.standee);
      pawn.userData.characterId = character.id;
      pawn.userData.characterState = stateTexture ? presentation.resolvedState : 'neutral';
      const angle = (index / Math.max(1, indices.length)) * Math.PI * 2;
      const radius = indices.length > 1 ? (tile.tileType === Tile.RELIC ? 0.54 : 0.42) : 0;
      pawn.position.set(tile.x + Math.cos(angle) * radius, tile.height + 0.04, tile.z + Math.sin(angle) * radius);
      pawn.rotation.y = -0.45;
      context.layers.party.add(pawn);
      const intentTile = state.isResolving ? context.worldByAlias.get(state.intentAlias) : null;
      const from = pawn.position.clone();
      const to = intentTile
        ? new THREE.Vector3(intentTile.x + Math.cos(angle) * radius, intentTile.height + 0.04, intentTile.z + Math.sin(angle) * radius)
        : from.clone();
      animateInLayer(context, 'party', {
        object: pawn,
        kind: playerIndex === state.currentPlayerIndex ? 'current-pawn' : 'pawn',
        baseY: pawn.position.y,
        from,
        to,
        travel: Boolean(intentTile && intentTile.alias !== tile.alias),
      });
    });
  });
}

function addDynamicWorld(THREE, context, state) {
  context.isResolving = Boolean(state.isResolving);
  if (context.particles) context.particles.visible = !state.isComplete;
  const showDetailedLandmarks = state.activeAction !== Action.HELP && !state.hasSubmitted && !state.isDanger && !state.isResolving && !state.isComplete;
  context.landingBeaconModels?.forEach(({ model, fallbacks }) => {
    model.visible = showDetailedLandmarks;
    fallbacks.forEach((fallback) => { fallback.visible = !showDetailedLandmarks; });
  });
  context.campsiteModels?.forEach(({ model, fallbacks }) => {
    model.visible = showDetailedLandmarks;
    fallbacks.forEach((fallback) => { fallback.visible = !showDetailedLandmarks; });
  });
  setLightingRig(THREE, context.lighting, resolveLightingRigId(state), { immediate: context.reducedMotion });
  const beat = resolveBoardBeat(state);
  const beatKey = premiumBeatKey(state, beat);
  context.renderer.domElement.dataset.boardBeat = beat.id;
  context.renderer.domElement.dataset.cameraSuggestion = beat.camera.suggestion;
  if (context.beatKey !== beatKey) {
    context.presentation = {
      beat,
      key: beatKey,
      startedAt: performance.now(),
      resolving: Boolean(state.isResolving),
    };
    context.handlers.current.onBeat?.(beat);
  }
  context.beatId = beat.id;
  context.beatKey = beatKey;
  const occupiedAliases = new Set(Object.entries(state.playerLocationMap || {}).filter(([, playerIndices]) => playerIndices?.length).map(([alias]) => alias));
  const activeBoss = bossPresentationFor(state.encounterId);
  context.propLandmarks.forEach((prop, alias) => {
    prop.visible = !(activeBoss && alias === state.intentAlias) && (prop.userData.persistent || !occupiedAliases.has(alias));
  });
  const nextSignatures = boardLayerSignatures(state);
  const builders = {
    affordances: buildAffordanceLayer,
    intent: buildIntentLayer,
    route: buildRouteLayer,
    assistance: buildAssistanceLayer,
    party: buildPartyLayer,
  };
  for (const [layerId, builder] of Object.entries(builders)) {
    if (context.layerSignatures[layerId] === nextSignatures[layerId]) continue;
    resetDynamicLayer(context, layerId);
    builder(THREE, context, state);
  }
  context.layerSignatures = nextSignatures;
  context.state = state;
}

function createWorld(THREE, OrbitControls, RoomEnvironment, KTX2Loader, GLTFLoader, mount, world, initialState, handlers, performanceMode) {
  const requestedQuality = resolveBoardQuality({
    mode: performanceMode,
    deviceMemory: navigator.deviceMemory ?? 8,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 8,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches || false,
    viewportWidth: mount.clientWidth || window.innerWidth,
  });
  const renderer = new THREE.WebGLRenderer({
    antialias: requestedQuality.mode !== 'efficient',
    alpha: true,
    powerPreference: requestedQuality.mode === 'efficient' ? 'low-power' : 'high-performance',
  });
  const quality = {
    ...requestedQuality,
    anisotropy: Math.min(requestedQuality.anisotropy, renderer.capabilities.getMaxAnisotropy()),
    compressedTextures: shouldUseCompressedTextures({
      requested: requestedQuality.compressedTextures,
      production: import.meta.env.PROD,
    }),
  };
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'block h-full w-full cursor-grab';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.dataset.boardQuality = quality.mode;
  renderer.domElement.dataset.materialSystemVersion = MATERIAL_SYSTEM_VERSION;
  renderer.domElement.dataset.contextLosses = '0';
  renderer.domElement.dataset.contextRestored = 'false';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x09100c, 0.035);
  const baseCameraFov = 34;
  const camera = new THREE.PerspectiveCamera(baseCameraFov, 1, 0.1, 180);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    && !document.documentElement.classList.contains('ux-reduced-motion');
  controls.dampingFactor = 0.075;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.rotateSpeed = 0.55;
  controls.panSpeed = 0.7;
  controls.zoomSpeed = 0.85;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  const boardGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  const layers = Object.fromEntries(['affordances', 'intent', 'route', 'party', 'assistance'].map((id) => {
    const group = new THREE.Group();
    group.name = `board-layer:${id}`;
    dynamicGroup.add(group);
    return [id, group];
  }));
  scene.add(boardGroup, dynamicGroup);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(world.radius * 2.8, 64),
    material(THREE, '#0a120d', { roughness: 1, transparent: true, opacity: 0.58 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.23;
  floor.receiveShadow = true;
  scene.add(floor);

  const lighting = createLightingSystem(THREE, { renderer, scene, world, quality, RoomEnvironment });

  const tileMeshes = [];
  const propLandmarks = new Map();
  const tileAnchors = new Map();
  const worldByAlias = new Map(world.cells.map((tile) => [tile.alias, tile]));
  const usedTileTypes = new Set(world.cells.filter((tile) => tile.revealed).map((tile) => tile.tileType));
  const hasCampsite = world.cells.some((tile) => tile.hasCampsite);
  let resolveTextures;
  const texturesReady = new Promise((resolve) => { resolveTextures = resolve; });
  const loadingManager = new THREE.LoadingManager(() => resolveTextures());
  const assetRegistry = attachBoardAssetRegistry(loadingManager, createBoardAssetRegistry());
  const textureLoader = new THREE.TextureLoader(loadingManager);
  const modelLoader = new GLTFLoader(loadingManager);
  const compressedTextureLoader = quality.compressedTextures
    ? new KTX2Loader(loadingManager).setTranscoderPath('/basis/').detectSupport(renderer)
    : null;
  const surfaceLoader = compressedTextureLoader || textureLoader;
  const surfaceTextureSets = new Map([...usedTileTypes].map((tileType) => {
    const profile = surfaceProfileForTile(tileType);
    if (!profile) return [tileType, null];
    return [tileType, {
      top: loadSurfaceTextureSet(THREE, surfaceLoader, profile, quality),
      side: loadSurfaceTextureSet(THREE, surfaceLoader, profile, quality, { side: true }),
    }];
  }).filter(([, textureSet]) => textureSet));
  const fxTextures = Object.fromEntries(Object.entries(STATE_FX_TEXTURES).map(([keyName, texturePath]) => {
    const texture = textureLoader.load(texturePath);
    texture.colorSpace = THREE.SRGBColorSpace;
    return [keyName, texture];
  }));
  const guestCharacterPaths = [...new Set((initialState.crew || []).flatMap((player, index) => {
    const character = resolvePlayerCharacter(player, index);
    return quality.mode === 'efficient'
      ? [runtimeImagePath(character.assets.neutral)]
      : [runtimeImagePath(character.assets.neutral), ...Object.values(character.assets.states || {}).map(runtimeImagePath)];
  }))];
  const characterTexturePaths = initialState.source?.kind === 'guest' && guestCharacterPaths.length
    ? guestCharacterPaths
    : quality.mode === 'efficient'
      ? CHARACTER_NEUTRAL_TEXTURE_PATHS
      : CHARACTER_TEXTURE_PATHS;
  const characterTextures = Object.fromEntries(characterTexturePaths.map((texturePath) => {
    const texture = textureLoader.load(texturePath);
    texture.colorSpace = THREE.SRGBColorSpace;
    return [texturePath, texture];
  }));
  const relevantBosses = bossPresentationsForTileTypes(usedTileTypes);
  const encounterTextureKeys = encounterTextureKeysForTileTypes(usedTileTypes);
  relevantBosses.forEach((boss) => encounterTextureKeys.add(boss.enemyTextureKey));
  const encounterTextures = quality.mode === 'efficient' ? {} : Object.fromEntries(
    [...encounterTextureKeys].map((keyName) => [keyName, textureLoader.load(ENCOUNTER_TEXTURES[keyName])]),
  );
  Object.values(encounterTextures).filter(Boolean).forEach((texture) => { texture.colorSpace = THREE.SRGBColorSpace; });
  const routeForkTexture = quality.mode === 'efficient' ? null : textureLoader.load(ROUTE_FORK_TEXTURE);
  if (routeForkTexture) routeForkTexture.colorSpace = THREE.SRGBColorSpace;
  const bossTileTextures = quality.mode === 'efficient' ? {} : Object.fromEntries(relevantBosses.map((boss) => {
    const texture = textureLoader.load(boss.tileTexture);
    texture.colorSpace = THREE.SRGBColorSpace;
    return [boss.id, texture];
  }));
  const landingSkiffTexture = usedTileTypes.has(Tile.LANDING) ? textureLoader.load(LANDING_SKIFF_TEXTURE) : null;
  if (landingSkiffTexture) landingSkiffTexture.colorSpace = THREE.SRGBColorSpace;
  const landingPadTexture = usedTileTypes.has(Tile.LANDING) && quality.mode !== 'efficient' ? textureLoader.load(LANDING_PAD_TEXTURE) : null;
  if (landingPadTexture) landingPadTexture.colorSpace = THREE.SRGBColorSpace;
  const propTextures = new Map(Object.entries(CUTOUT_PROP_TEXTURES).filter(([tileType]) => usedTileTypes.has(Number(tileType))).map(([tileType, texturePaths]) => {
    const textures = texturePaths.map((texturePath) => {
      const texture = textureLoader.load(texturePath);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    });
    return [Number(tileType), textures];
  }));
  const campsiteTexture = hasCampsite ? textureLoader.load(CAMPSITE_PROP_TEXTURE) : null;
  if (campsiteTexture) campsiteTexture.colorSpace = THREE.SRGBColorSpace;
  const sunstoneTexture = usedTileTypes.has(Tile.RELIC) ? textureLoader.load(SUNSTONE_LENS_TEXTURE) : null;
  if (sunstoneTexture) sunstoneTexture.colorSpace = THREE.SRGBColorSpace;
  const atlasTexture = usedTileTypes.has(Tile.RELIC) ? textureLoader.load(ATLAS_SPINDLE_TEXTURE) : null;
  if (atlasTexture) atlasTexture.colorSpace = THREE.SRGBColorSpace;
  const tideglassTexture = usedTileTypes.has(Tile.RELIC) ? textureLoader.load(TIDEGLASS_CRADLE_TEXTURE) : null;
  if (tideglassTexture) tideglassTexture.colorSpace = THREE.SRGBColorSpace;
  const context = {
    renderer,
    scene,
    camera,
    boardGroup,
    dynamicGroup,
    layers,
    tileMeshes,
    propLandmarks,
    tileAnchors,
    worldByAlias,
    lighting,
    surfaceTextureSets,
    fxTextures,
    characterTextures,
    encounterTextures,
    bossTileTextures,
    routeForkTexture,
    landingSkiffTexture,
    landingPadTexture,
    routeForkModel: null,
    landingBeaconModels: [],
    campsiteModels: [],
    propTextures,
    campsiteTexture,
    sunstoneTexture,
    atlasTexture,
    tideglassTexture,
    controls,
    animated: [],
    objectPools: new Map(),
    layerSignatures: {},
    assetRegistry,
    handlers,
    beatId: '',
    beatKey: '',
    presentation: null,
    ambientObjects: [],
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('ux-reduced-motion'),
  };

  const terrainBatches = new Map();
  world.cells.forEach((tile) => {
    const key = tileBatchId(tile.tileType, seedForAlias(tile.alias), tile.revealed);
    if (!terrainBatches.has(key)) terrainBatches.set(key, []);
    terrainBatches.get(key).push(tile);
  });
  const matrixHelper = new THREE.Object3D();
  const tileTransformEvidence = [];
  const simplifiedLandmarks = world.cells.length > 32;
  const landmarkCap = simplifiedLandmarks ? DENSE_BOARD_LANDMARK_CAP : world.cells.length;
  const eligibleLandmarks = world.cells.filter((tile) => tile.revealed && tile.tileType !== Tile.NONE);
  const landmarkAliases = new Set();
  const prioritizeLandmark = (alias) => {
    if (alias && eligibleLandmarks.some((tile) => tile.alias === alias)) landmarkAliases.add(alias);
  };
  prioritizeLandmark(initialState.currentLocation);
  prioritizeLandmark(initialState.intentAlias);
  prioritizeLandmark(initialState.landingSite);
  Object.keys(initialState.playerLocationMap || {}).forEach(prioritizeLandmark);
  eligibleLandmarks.filter((tile) => tile.hasCampsite).forEach((tile) => prioritizeLandmark(tile.alias));
  [...new Set(eligibleLandmarks.map((tile) => tile.tileType))].forEach((tileType) => prioritizeLandmark(eligibleLandmarks.find((tile) => tile.tileType === tileType)?.alias));
  eligibleLandmarks
    .filter((tile) => !landmarkAliases.has(tile.alias))
    .sort((left, right) => seedForAlias(left.alias) - seedForAlias(right.alias))
    .slice(0, Math.max(0, landmarkCap - landmarkAliases.size))
    .forEach((tile) => landmarkAliases.add(tile.alias));
  for (const [batchId, tiles] of terrainBatches) {
    const sample = tiles[0];
    const terrain = WORLD_TERRAIN[sample.revealed ? sample.tileType : Tile.NONE] || WORLD_TERRAIN[Tile.NONE];
    const profile = sample.revealed ? surfaceProfileForTile(sample.tileType) : null;
    const textureSet = profile ? surfaceTextureSets.get(sample.tileType) : null;
    const seed = seedForAlias(sample.alias);
    const variant = tileVariantFor(sample.tileType, seed);
    const side = profile
      ? createSurfaceMaterial(THREE, profile, textureSet?.side, quality, { seed, side: true })
      : material(THREE, terrain.side, { roughness: 0.98, metalness: 0 });
    const top = profile
      ? createSurfaceMaterial(THREE, profile, textureSet?.top, quality, { seed })
      : material(THREE, terrain.top, { roughness: 0.94, metalness: 0, emissive: terrain.emissive, emissiveIntensity: 0.012, transparent: true, opacity: 0.68 });
    const geometry = profile
      ? createTileGeometry(THREE, variant, tileFamilyFor(sample.tileType))
      : new THREE.CylinderGeometry(0.94, 0.88, 1, 6, 1, false);
    applySurfaceUvVariation(geometry, profile, seed);
    const mesh = new THREE.InstancedMesh(geometry, [side, top, side], tiles.length);
    mesh.name = `terrain-batch:${batchId}`;
    mesh.castShadow = sample.revealed;
    mesh.receiveShadow = true;
    mesh.userData.aliasByInstance = tiles.map((tile) => tile.alias);
    mesh.userData.tiles = tiles;
    mesh.userData.surfaceId = profile?.id || 'unknown';
    mesh.userData.tileVariant = variant?.id || 'fog';
    tiles.forEach((tile, index) => {
      const transform = baseTileTransform(tile);
      matrixHelper.position.set(transform.x, transform.y, transform.z);
      matrixHelper.rotation.set(0, transform.rotationY, 0);
      matrixHelper.scale.set(transform.scaleX, transform.scaleY, transform.scaleZ);
      matrixHelper.updateMatrix();
      mesh.setMatrixAt(index, matrixHelper.matrix);
      tileTransformEvidence.push([tile.alias, transform.x, transform.y, transform.z, transform.rotationY, transform.scaleX, transform.scaleY, transform.scaleZ]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    boardGroup.add(mesh);
    tileMeshes.push(mesh);

    tiles.forEach((tile) => {
      const anchor = new THREE.Group();
      anchor.position.set(tile.x, tile.height / 2, tile.z);
      anchor.rotation.y = Math.PI / 6;
      const propLandmark = landmarkAliases.has(tile.alias)
        ? addTerrainLandmarks(THREE, tile, anchor, (() => {
          const variants = propTextures.get(tile.tileType) || [];
          return variants[seedForAlias(tile.alias) % Math.max(1, variants.length)] || null;
        })(), campsiteTexture, { simplified: simplifiedLandmarks })
        : null;
      if (propLandmark) propLandmarks.set(tile.alias, propLandmark);
      tileAnchors.set(tile.alias, anchor);
      boardGroup.add(anchor);
    });
  }

  const landingTile = worldByAlias.get(initialState.landingSite)
    || world.cells.find((tile) => tile.revealed && tile.tileType === Tile.LANDING);
  const landingAnchor = landingTile ? tileAnchors.get(landingTile.alias) : null;
  if (landingTile && landingAnchor && landingPadTexture) {
    const landingPadMap = landingPadTexture.clone();
    landingPadMap.needsUpdate = true;
    const landingPad = new THREE.Sprite(new THREE.SpriteMaterial({ map: landingPadMap, color: 0xffffff, transparent: true, opacity: 0.86, alphaTest: 0.05, depthWrite: false, toneMapped: true, fog: true }));
    landingPad.name = `landing-pad:${landingTile.alias}`;
    landingPad.userData.kind = 'landing-pad-tile';
    landingPad.center.set(0.5, 0.16);
    landingPad.position.y = landingTile.height / 2 + 0.025;
    landingPad.scale.set(1.72, 1.4, 1);
    landingPad.renderOrder = 1;
    landingAnchor.add(landingPad);
  }
  if (landingTile && landingAnchor && landingSkiffTexture) {
    const landingSkiff = new THREE.Group();
    landingSkiff.position.set(0, landingTile.height / 2 + 0.035, 0);
    addCutoutProp(THREE, landingSkiff, landingTile, landingSkiffTexture, seedForAlias(`${landingTile.alias}:landing-skiff`), {
      scale: [1.95, 1.28], x: 0.06, z: -0.08, mirror: false, persistent: true,
      lightColor: '#8ad9d1', lightIntensity: 0.62, kind: 'landing-skiff',
    });
    landingAnchor.add(landingSkiff);
  }

  const landingBeaconModelPath = runtimeModelPath('prop-landing-beacon');
  if (landingBeaconModelPath && usedTileTypes.has(Tile.LANDING) && !simplifiedLandmarks) {
    modelLoader.load(landingBeaconModelPath, ({ scene: sourceModel }) => {
      const landingTiles = world.cells.filter((tile) => tile.revealed && tile.tileType === Tile.LANDING && landmarkAliases.has(tile.alias));
      landingTiles.forEach((tile) => {
        const anchor = tileAnchors.get(tile.alias);
        if (!anchor) return;
        const fallbacks = [];
        anchor.traverse((object) => {
          if (object.userData?.kind === 'cutout-prop') {
            object.visible = false;
            fallbacks.push(object);
          }
        });
        const model = addRuntimeModelProp(THREE, anchor, sourceModel, {
          height: 0.96,
          x: -0.34,
          y: tile.height / 2 + 0.02,
          z: 0.12,
          rotationY: -0.18,
          name: `landing-beacon:model:${tile.alias}`,
          kind: 'landing-beacon-model',
        });
        context.landingBeaconModels.push({ model, fallbacks });
      });
      renderer.domElement.dataset.landingBeaconModel = 'lod2';
      addDynamicWorld(THREE, context, context.state || initialState);
      requestRender();
    }, undefined, () => {
      renderer.domElement.dataset.landingBeaconModel = 'cutout-fallback';
    });
  }

  const routeForkModelPath = runtimeModelPath('prop-route-fork-marker');
  if (routeForkModelPath) {
    modelLoader.load(routeForkModelPath, ({ scene: sourceModel }) => {
      context.routeForkModel = sourceModel;
      renderer.domElement.dataset.routeForkModel = 'lod2';
      addDynamicWorld(THREE, context, context.state || initialState);
      requestRender();
    }, undefined, () => {
      renderer.domElement.dataset.routeForkModel = 'cutout-fallback';
    });
  }

  const campsiteModelPath = runtimeModelPath('prop-campsite-shelter');
  if (campsiteModelPath && hasCampsite && !simplifiedLandmarks && quality.mode === 'high') {
    modelLoader.load(campsiteModelPath, ({ scene: sourceModel }) => {
      const campsiteTiles = world.cells.filter((tile) => tile.revealed && tile.hasCampsite && landmarkAliases.has(tile.alias));
      campsiteTiles.forEach((tile) => {
        const anchor = tileAnchors.get(tile.alias);
        if (!anchor) return;
        const fallbacks = [];
        anchor.traverse((object) => {
          if (object.userData?.kind === 'campsite-cutout') {
            object.visible = false;
            fallbacks.push(object);
          }
        });
        const model = addRuntimeModelProp(THREE, anchor, sourceModel, {
          height: 0.66,
          x: 0.32,
          y: tile.height / 2 + 0.02,
          z: -0.24,
          rotationY: -0.12,
          name: `campsite-shelter:model:${tile.alias}`,
          kind: 'campsite-shelter-model',
        });
        context.campsiteModels.push({ model, fallbacks });
      });
      renderer.domElement.dataset.campsiteModel = 'lod2';
      addDynamicWorld(THREE, context, context.state || initialState);
      requestRender();
    }, undefined, () => {
      renderer.domElement.dataset.campsiteModel = 'cutout-fallback';
    });
  } else if (hasCampsite) {
    renderer.domElement.dataset.campsiteModel = 'cutout-quality-fallback';
  }

  const relicTiles = world.cells.filter((tile) => tile.revealed && tile.tileType === Tile.RELIC);
  const heroTile = relicTiles.find((tile) => [initialState.intentAlias, initialState.currentLocation].includes(tile.alias)) || relicTiles[0];
  const heroRelic = heroRelicForAlias(heroTile?.alias);
  const heroModelId = heroRelic.id;
  const heroModelPath = heroRelic.modelPath;
  if (heroModelPath && heroTile && quality.mode !== 'efficient') {
    modelLoader.load(heroModelPath, ({ scene: sourceModel }) => {
      sourceModel.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
        const refinedMaterials = sourceMaterials.map((sourceMaterial) => {
          const refined = sourceMaterial.clone();
          if ('roughness' in refined) refined.roughness = Math.max(0.46, refined.roughness || 0);
          if ('metalness' in refined) refined.metalness = Math.min(0.32, refined.metalness || 0);
          if ('envMapIntensity' in refined) refined.envMapIntensity = 0.72;
          if (refined.emissive?.set) {
            refined.emissive.set(heroRelic.emissive);
            refined.emissiveIntensity = Math.max(0.28, refined.emissiveIntensity || 0);
          }
          return refined;
        });
        object.material = Array.isArray(object.material) ? refinedMaterials : refinedMaterials[0];
      });
      [heroTile].filter(Boolean).forEach((tile) => {
        const anchor = tileAnchors.get(tile.alias);
        if (!anchor) return;
        anchor.traverse((object) => {
          if (['cutout-prop', 'hero-relic'].includes(object.userData?.kind)) object.visible = false;
        });
        const model = sourceModel.clone(true);
        const modelBaseY = tile.height / 2 + 0.08;
        model.name = `hero-relic:${heroModelId}`;
        model.userData.kind = 'trellis-hero-relic';
        model.userData.baseRotationY = -Math.PI * 0.12;
        model.userData.baseY = modelBaseY;
        model.position.set(0, modelBaseY + 0.025, -0.08);
        model.rotation.y = model.userData.baseRotationY;
        model.scale.setScalar(heroRelic.scale);
        anchor.add(model);
        const light = new THREE.PointLight(heroRelic.lightColor, 1.7, 2.8, 2);
        light.position.set(0, tile.height / 2 + 0.58, -0.02);
        anchor.add(light);
        context.ambientObjects.push(model);
        renderer.domElement.dataset.heroModel = heroModelId;
        requestRender();
      });
    }, undefined, () => {
      renderer.domElement.dataset.heroModel = 'procedural-fallback';
    });
  }
  renderer.domElement.dataset.tileTransformHash = JSON.stringify(tileTransformEvidence);
  boardGroup.traverse((object) => {
    if (object.userData?.kind === 'hero-relic'
      || object.userData?.kind === 'hero-relic-core'
      || object.userData?.kind === 'hero-relic-orbit') {
      context.ambientObjects.push(object);
    }
  });

  const particlesGeometry = new THREE.BufferGeometry();
  const particleCount = Math.max(32, Math.round(Math.min(220, world.cells.length * 3) * quality.particleScale));
  const positions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index += 1) {
    const seed = seedForAlias(`mist-${index}`);
    positions[index * 3] = ((seed & 255) / 255 - 0.5) * world.width * 1.3;
    positions[index * 3 + 1] = 0.3 + (((seed >> 8) & 255) / 255) * 3.8;
    positions[index * 3 + 2] = (((seed >> 16) & 255) / 255 - 0.5) * world.depth * 1.2;
  }
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    particlesGeometry,
    new THREE.PointsMaterial({ color: 0x9adbd2, size: 0.035, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  scene.add(particles);
  context.particles = particles;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const drag = { pointerId: null, startX: 0, startY: 0, moved: false };
  let suppressClickUntil = 0;
  const pick = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return resolvePickedAlias(raycaster.intersectObjects(tileMeshes, false)[0]);
  };
  const onPointerDown = (event) => {
    drag.pointerId = event.pointerId;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.moved = false;
  };
  const onPointerMove = (event) => {
    if (drag.pointerId === event.pointerId && event.buttons) {
      drag.moved = drag.moved || pointerExceededDragThreshold({ x: drag.startX, y: drag.startY }, { x: event.clientX, y: event.clientY });
      if (drag.moved) {
        renderer.domElement.style.cursor = 'grabbing';
        handlers.current.onTileHover?.(null);
        return;
      }
    }
    const alias = pick(event);
    renderer.domElement.style.cursor = alias ? 'pointer' : 'grab';
    handlers.current.onTileHover?.(alias || null);
  };
  const onPointerLeave = () => {
    handlers.current.onTileHover?.(null);
  };
  const onPointerUp = (event) => {
    if (drag.pointerId !== event.pointerId) return;
    if (drag.moved) suppressClickUntil = performance.now() + 250;
    drag.pointerId = null;
    drag.moved = false;
    renderer.domElement.style.cursor = 'grab';
  };
  const onClick = (event) => {
    if (performance.now() < suppressClickUntil) return;
    const alias = pick(event);
    if (alias) handlers.current.onTileClick?.(alias);
  };
  const onContextMenu = (event) => event.preventDefault();
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerUp);
  renderer.domElement.addEventListener('pointerleave', onPointerLeave);
  renderer.domElement.addEventListener('click', onClick);
  renderer.domElement.addEventListener('contextmenu', onContextMenu);
  let pageVisible = !document.hidden;
  let boardVisible = true;
  let disposed = false;
  let requestRender = () => {};
  let cameraInitialized = false;
  let defaultView = null;
  let lastCameraView = 'default';
  let constrainingTarget = false;
  const cameraPose = () => [camera.position.x, camera.position.y, camera.position.z, controls.target.x, controls.target.y, controls.target.z]
    .map((value) => value.toFixed(3))
    .join(',');
  const isDefaultCameraView = () => defaultView
    && camera.position.distanceToSquared(defaultView.position) < 0.0001
    && controls.target.distanceToSquared(defaultView.target) < 0.0001;
  const onControlsChange = () => {
    if (!cameraInitialized || constrainingTarget) return;
    const constrainedTarget = controls.target.clone();
    const constrained = clampBoardTarget(constrainedTarget, world);
    constrainedTarget.set(constrained.x, constrained.y, constrained.z);
    if (!constrainedTarget.equals(controls.target)) {
      constrainingTarget = true;
      camera.position.add(constrainedTarget.clone().sub(controls.target));
      controls.target.copy(constrainedTarget);
      constrainingTarget = false;
    }
    renderer.domElement.dataset.cameraPose = cameraPose();
    const cameraView = isDefaultCameraView() ? 'default' : 'custom';
    if (cameraView !== lastCameraView) {
      lastCameraView = cameraView;
      handlers.current.onCameraChange?.(cameraView);
    }
    requestRender();
  };
  controls.addEventListener('change', onControlsChange);
  let contextLosses = 0;
  const onContextLost = (event) => {
    event.preventDefault();
    contextLosses += 1;
    renderer.domElement.dataset.contextLosses = String(contextLosses);
    handlers.current.onContextLost?.();
  };
  const onContextRestored = () => {
    renderer.domElement.dataset.contextRestored = 'true';
    handlers.current.onContextRestored?.();
    requestRender();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

  const resize = () => {
    const width = Math.max(1, mount.clientWidth);
    const height = Math.max(1, mount.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const plan = cameraPlan(world, camera.aspect);
    controls.minDistance = Math.max(3, plan.distance * 0.48);
    controls.maxDistance = plan.distance * 1.8;
    defaultView = {
      position: new THREE.Vector3(...plan.position),
      target: new THREE.Vector3(...plan.target),
    };
    if (!cameraInitialized) {
      camera.position.copy(defaultView.position);
      controls.target.copy(defaultView.target);
      camera.lookAt(defaultView.target);
      cameraInitialized = true;
      controls.update();
      renderer.domElement.dataset.cameraPose = cameraPose();
    }
    camera.near = Math.max(0.1, plan.distance / 60);
    camera.far = plan.distance * 6;
    camera.updateProjectionMatrix();
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  resize();

  addDynamicWorld(THREE, context, initialState);
  const clock = new THREE.Clock();
  const frameSamples = [];
  const renderSamples = [];
  const cameraRight = new THREE.Vector3();
  let currentPixelRatio = renderer.getPixelRatio();
  let adaptiveEffectsReduced = false;
  renderer.domElement.dataset.pixelRatio = currentPixelRatio.toFixed(2);
  let frame = 0;
  const animate = () => {
    frame = 0;
    if (disposed || !pageVisible || !boardVisible) return;
    const delta = Math.min(0.1, clock.getDelta());
    const elapsed = clock.elapsedTime;
    const lightingMoving = updateLightingSystem(lighting, delta);
    const presentation = context.presentation
      ? presentationFrame({
        startedAt: context.presentation.startedAt,
        now: performance.now(),
        resolving: context.presentation.resolving && !context.reducedMotion,
      })
      : presentationFrame();
    renderer.domElement.dataset.presentationStage = presentation.stage;
    renderer.domElement.dataset.presentationProgress = presentation.progress.toFixed(3);
    cameraRight.setFromMatrixColumn(camera.matrix, 0).setY(0).normalize();
    lighting.rim.position.set(
      controls.target.x + cameraRight.x * world.radius * 0.82,
      world.radius * 0.72,
      controls.target.z + cameraRight.z * world.radius * 0.82,
    );
    if (!context.reducedMotion) {
      particles.rotation.y = elapsed * 0.012;
      particles.position.y = Math.sin(elapsed * 0.22) * 0.045;
      particles.material.opacity = 0.25 + presentation.impactPulse * 0.16;
      context.propLandmarks.forEach((prop, alias) => {
        const seed = seedForAlias(alias);
        prop.rotation.z = Math.sin(elapsed * (0.38 + (seed % 5) * 0.035) + seed) * 0.012;
        if (prop.userData.face) prop.userData.face.material.rotation = Math.sin(elapsed * 0.46 + seed) * 0.006;
      });
      context.ambientObjects.forEach((object, index) => {
        if (object.userData.kind === 'hero-relic') {
          object.rotation.y = elapsed * 0.18 + index * 0.2;
          object.position.y = 0.08 + Math.sin(elapsed * 1.25 + index) * 0.025;
        } else if (object.userData.kind === 'hero-relic-core') {
          const glow = 1 + Math.sin(elapsed * 2.1 + index) * 0.055;
          object.scale.set(0.76 * glow, 1.26 * glow, 0.76 * glow);
        } else if (object.userData.kind === 'hero-relic-orbit') {
          object.rotation.z += delta * (0.16 + object.userData.orbitIndex * 0.035);
        } else if (object.userData.kind === 'trellis-hero-relic') {
          object.rotation.y = object.userData.baseRotationY + Math.sin(elapsed * 0.42 + index) * 0.11;
          object.position.y = object.userData.baseY + Math.sin(elapsed * 1.05 + index) * 0.025;
        }
      });
      context.animated.forEach(({ object, kind, baseY, delay = 0, from, to, travel }, index) => {
        if (kind === 'pulse') {
          const pulse = 1 + Math.sin(elapsed * 2.5 + index) * 0.035;
          object.scale.setScalar(pulse);
        } else if (kind === 'resolve-wave') {
          const phase = (elapsed * 0.72 + delay) % 1;
          object.scale.setScalar(0.82 + phase * 0.72);
          object.material.opacity = (1 - phase) * 0.72;
        } else if (travel && from && to && context.isResolving) {
          object.position.lerpVectors(from, to, presentation.travel);
          object.position.y += presentation.lift + Math.sin(elapsed * 7 + index) * 0.014;
          object.scale.set(2 - presentation.squash, presentation.squash, 2 - presentation.squash);
          const layers = object.userData.spriteLayers || [];
          layers.forEach((layer, layerIndex) => {
            layer.material.rotation = Math.sin(Math.PI * presentation.travel) * (layerIndex ? -0.026 : -0.014);
          });
        } else {
          object.position.y = baseY + Math.sin(elapsed * 1.7 + index) * (kind === 'current-pawn' ? 0.035 : 0.018);
          object.scale.setScalar(1);
          const layers = object.userData.spriteLayers || [];
          layers.forEach((layer, layerIndex) => {
            layer.material.rotation = Math.sin(elapsed * 0.72 + index * 0.8) * (layerIndex ? 0.007 : 0.004);
          });
        }
      });
    }
    const nextFov = context.reducedMotion ? baseCameraFov : baseCameraFov - presentation.lensPulse * 1.4;
    if (Math.abs(camera.fov - nextFov) > 0.001) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
    controls.update();
    const renderStarted = performance.now();
    renderer.render(scene, camera);
    renderSamples.push(performance.now() - renderStarted);
    if (renderSamples.length > 120) renderSamples.shift();
    renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
    renderer.domElement.dataset.triangles = String(renderer.info.render.triangles);
    renderer.domElement.dataset.textures = String(renderer.info.memory.textures);
    renderer.domElement.dataset.lightingRig = lighting.activeRigId;
    if (renderSamples.length >= 30) {
      const orderedRender = [...renderSamples].sort((a, b) => a - b);
      renderer.domElement.dataset.renderP95 = orderedRender[Math.floor(orderedRender.length * 0.95)].toFixed(2);
    }
    const assetEvidence = assetRegistry.snapshot();
    renderer.domElement.dataset.assetExpected = String(assetEvidence.expected);
    renderer.domElement.dataset.assetLoaded = String(assetEvidence.loaded);
    renderer.domElement.dataset.assetLoading = String(assetEvidence.loading);
    renderer.domElement.dataset.assetFailures = String(assetEvidence.failed);
    renderer.domElement.dataset.assetFailureList = JSON.stringify(assetEvidence.failures);
    renderer.domElement.dataset.assetBytes = String(assetEvidence.transferredBytes);
    if (quality.dynamicResolution && !context.reducedMotion && delta > 0) {
      frameSamples.push(delta * 1000);
      if (frameSamples.length >= 120) {
        const ordered = [...frameSamples].sort((a, b) => a - b);
        const p95 = ordered[Math.floor(ordered.length * 0.95)];
        renderer.domElement.dataset.frameP95 = p95.toFixed(2);
        const nextRatio = nextPixelRatio({ current: currentPixelRatio, frameP95Ms: p95, maximum: quality.pixelRatioCap });
        if (nextRatio !== currentPixelRatio) {
          currentPixelRatio = nextRatio;
          renderer.setPixelRatio(currentPixelRatio);
          renderer.domElement.dataset.pixelRatio = currentPixelRatio.toFixed(2);
          resize();
        }
        if (p95 > 48 && currentPixelRatio === 1 && !adaptiveEffectsReduced) {
          adaptiveEffectsReduced = true;
          renderer.shadowMap.enabled = false;
          particles.visible = false;
          lighting.key.castShadow = false;
          renderer.domElement.dataset.adaptiveMode = 'efficient-effects';
        }
        frameSamples.length = 0;
      }
    }
    if (!context.reducedMotion || lightingMoving) frame = window.requestAnimationFrame(animate);
  };
  requestRender = () => {
    if (disposed || !pageVisible || !boardVisible || frame) return;
    frame = window.requestAnimationFrame(animate);
  };
  const onVisibilityChange = () => {
    pageVisible = !document.hidden;
    if (!pageVisible && frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    if (pageVisible) requestRender();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  const visibilityObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([entry]) => {
      boardVisible = Boolean(entry?.isIntersecting);
      if (!boardVisible && frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      if (boardVisible) requestRender();
    }, { rootMargin: '120px' })
    : null;
  visibilityObserver?.observe(mount);
  requestRender();
  const steadyStateReady = texturesReady.then(async () => {
    let warmupStatus;
    if (shouldUseAsyncShaderWarmup(navigator.userAgent)) {
      warmupStatus = await settleRendererWarmup(() => renderer.compileAsync?.(scene, camera));
    } else {
      try {
        renderer.compile(scene, camera);
        warmupStatus = 'synchronous';
      } catch {
        warmupStatus = 'failed';
      }
    }
    renderer.domElement.dataset.shaderWarmup = warmupStatus;
    try {
      renderer.render(scene, camera);
    } catch {
      // A compiled warm-up is an optimization; the loaded fallback is still usable.
    }
    renderSamples.length = 0;
    frameSamples.length = 0;
    delete renderer.domElement.dataset.renderP95;
    delete renderer.domElement.dataset.frameP95;
  });

  return {
    ...context,
    ready: steadyStateReady,
    cameraAction: (action) => {
      if (!cameraInitialized || !defaultView) return;
      if (action === 'reset') {
        camera.position.copy(defaultView.position);
        controls.target.copy(defaultView.target);
      } else if (['overview', 'party', 'intent'].includes(action)) {
        const state = context.state || initialState;
        const aliases = cameraPresetAliases(action, state);
        const targets = aliases.map((alias) => context.worldByAlias.get(alias)).filter(Boolean);
        const target = targets.length
          ? targets.reduce((sum, tile) => sum.add(new THREE.Vector3(tile.x, tile.height * 0.35, tile.z)), new THREE.Vector3()).multiplyScalar(1 / targets.length)
          : defaultView.target.clone();
        const distance = action === 'overview' ? defaultView.position.distanceTo(defaultView.target) * 1.18 : defaultView.position.distanceTo(defaultView.target) * 0.78;
        const direction = camera.position.clone().sub(controls.target).normalize();
        controls.target.copy(target);
        camera.position.copy(target).add(direction.multiplyScalar(THREE.MathUtils.clamp(distance, controls.minDistance, controls.maxDistance)));
      } else {
        const offset = camera.position.clone().sub(controls.target);
        if (action === 'rotate-left' || action === 'rotate-right') {
          offset.applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            action === 'rotate-left' ? Math.PI / 12 : -Math.PI / 12,
          );
        } else if (action === 'zoom-in' || action === 'zoom-out') {
          const factor = action === 'zoom-in' ? 0.82 : 1.22;
          offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
        } else if (action.startsWith('pan-')) {
          const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).setY(0).normalize();
          const forward = controls.target.clone().sub(camera.position).setY(0).normalize();
          const distance = offset.length() * 0.07;
          const direction = action === 'pan-left'
            ? right.multiplyScalar(-1)
            : action === 'pan-right'
              ? right
              : action === 'pan-up'
                ? forward
                : forward.multiplyScalar(-1);
          const delta = direction.multiplyScalar(distance);
          camera.position.add(delta);
          controls.target.add(delta);
        }
        camera.position.copy(controls.target).add(offset);
      }
      camera.lookAt(controls.target);
      controls.update();
      renderer.domElement.dataset.cameraPose = cameraPose();
      requestRender();
    },
    replayPresentation: () => {
      if (!context.presentation) return;
      context.presentation.startedAt = performance.now();
      requestRender();
    },
    update: (state) => {
      addDynamicWorld(THREE, context, state);
      requestRender();
    },
    dispose: () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      visibilityObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      disposeLightingSystem(lighting);
      disposeObject(scene);
      context.objectPools.forEach((pool) => pool.forEach((object) => disposeObject(object)));
      context.objectPools.clear();
      surfaceTextureSets.forEach((textureSet) => {
        Object.values(textureSet.top).forEach((texture) => texture.dispose());
        Object.values(textureSet.side).forEach((texture) => texture.dispose());
      });
      Object.values(fxTextures).forEach((texture) => texture.dispose());
      Object.values(characterTextures).forEach((texture) => texture.dispose());
      Object.values(encounterTextures).filter(Boolean).forEach((texture) => texture.dispose());
      Object.values(bossTileTextures).filter(Boolean).forEach((texture) => texture.dispose());
      routeForkTexture?.dispose();
      landingSkiffTexture?.dispose();
      landingPadTexture?.dispose();
      propTextures.forEach((textures) => textures.forEach((texture) => texture.dispose()));
      campsiteTexture?.dispose();
      sunstoneTexture?.dispose();
      atlasTexture?.dispose();
      tideglassTexture?.dispose();
      compressedTextureLoader?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

function CameraGlyph({ kind }) {
  if (kind === 'zoom-in' || kind === 'zoom-out') {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="8.5" cy="8.5" r="5" />
        <path d="m12.2 12.2 4 4M6 8.5h5" />
        {kind === 'zoom-in' && <path d="M8.5 6v5" />}
      </svg>
    );
  }
  if (kind === 'reset') {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="10" cy="10" r="3" />
        <path d="M10 2v3M10 15v3M2 10h3M15 10h3" />
      </svg>
    );
  }
  if (kind.startsWith('pan-')) {
    const paths = {
      'pan-up': 'M10 16V4m-4 4 4-4 4 4',
      'pan-right': 'M4 10h12m-4-4 4 4-4 4',
      'pan-down': 'M10 4v12m-4-4 4 4 4-4',
      'pan-left': 'M16 10H4m4-4-4 4 4 4',
    };
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d={paths[kind]} />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d={kind === 'rotate-left' ? 'M7 5 3.5 8.5 7 12' : 'm13 5 3.5 3.5L13 12'} />
      <path d={kind === 'rotate-left' ? 'M4 8.5h6a6 6 0 1 1-5.2 9' : 'M16 8.5h-6a6 6 0 1 0 5.2 9'} />
    </svg>
  );
}

const CAMERA_BUTTON_CLASS = 'grid h-11 min-w-11 place-items-center rounded border border-white/10 bg-exp-dark/80 px-2 text-exp-text-dim shadow-sm transition-colors hover:border-compass/45 hover:bg-exp-surface hover:text-compass-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass/70 disabled:cursor-default disabled:opacity-40';

export default function ThreeBoard({
  viewModel = null,
  cells = [],
  currentLocation = '',
  intentAlias = '',
  selectedPath = [],
  previewPath = [],
  reachableAliases = [],
  landingSite = '',
  playerLocationMap = {},
  crew = [],
  currentPlayerIndex = 0,
  activeAction,
  hasSubmitted = false,
  isResolving = false,
  isDanger = false,
  isComplete = false,
  lowStats = false,
  invalidAlias = '',
  phase,
  performanceMode = 'auto',
  onTileClick,
  onTileHover,
  onReady,
  onUnavailable,
  onBeat,
  ariaLabel,
  className = '',
}) {
  const mountRef = useRef(null);
  const worldRef = useRef(null);
  const handlersRef = useRef({ onTileClick, onTileHover, onBeat });
  const stateRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [cameraView, setCameraView] = useState('default');
  const [cameraControlsOpen, setCameraControlsOpen] = useState(false);
  const state = useMemo(() => deriveBoardViewModel(viewModel || {
    cells,
    currentLocation,
    intentAlias,
    selectedPath,
    previewPath,
    reachableAliases,
    landingSite,
    playerLocationMap,
    crew,
    currentPlayerIndex,
    activeAction,
    hasSubmitted,
    isResolving,
    isDanger,
    isComplete,
    lowStats,
    invalidAlias,
    phase,
  }), [activeAction, cells, crew, currentLocation, currentPlayerIndex, hasSubmitted, intentAlias, invalidAlias, isComplete, isDanger, isResolving, landingSite, lowStats, phase, playerLocationMap, previewPath, reachableAliases, selectedPath, viewModel]);
  const cellsKey = useMemo(
    () => state.cells.map((cell) => `${cell.alias}:${cell.revealed ? cell.tileType : 'fog'}:${cell.hasCampsite ? 1 : 0}`).join('|'),
    [state.cells],
  );

  handlersRef.current = {
    onTileClick,
    onTileHover,
    onBeat,
    onCameraChange: setCameraView,
    onContextLost: () => {
      setStatus('unavailable');
      onUnavailable?.();
    },
    onContextRestored: () => setStatus('ready'),
  };
  stateRef.current = state;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
      setStatus('unavailable');
      onUnavailable?.();
      return undefined;
    }

    let disposed = false;
    let worldInstance;
    setStatus('loading');
    setCameraView('default');
    Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/environments/RoomEnvironment.js'),
      import('three/addons/loaders/KTX2Loader.js'),
      import('three/addons/loaders/GLTFLoader.js'),
    ]).then(([THREE, { OrbitControls }, { RoomEnvironment }, { KTX2Loader }, { GLTFLoader }]) => {
      if (disposed || !mountRef.current) return;
      try {
        worldInstance = createWorld(THREE, OrbitControls, RoomEnvironment, KTX2Loader, GLTFLoader, mount, buildBoardWorld(stateRef.current.cells), stateRef.current, handlersRef, performanceMode);
        worldRef.current = worldInstance;
        worldInstance.ready.then(() => {
          if (disposed || worldRef.current !== worldInstance) return;
          worldInstance.update(stateRef.current);
          if (stateRef.current.isResolving) worldInstance.replayPresentation();
          setStatus('ready');
          onReady?.();
        });
      } catch (error) {
        console.error('ThreeBoard initialization failed', error);
        mount.dataset.rendererError = error instanceof Error ? error.message : String(error);
        setStatus('unavailable');
        onUnavailable?.();
      }
    }).catch((error) => {
      if (!disposed) {
        console.error('ThreeBoard dependency loading failed', error);
        mount.dataset.rendererError = error instanceof Error ? error.message : String(error);
        setStatus('unavailable');
        onUnavailable?.();
      }
    });

    return () => {
      disposed = true;
      worldInstance?.dispose();
      if (worldRef.current === worldInstance) worldRef.current = null;
    };
  }, [cellsKey, performanceMode]);

  useEffect(() => {
    worldRef.current?.update(state);
  }, [state]);

  const intentCell = state.cells.find((cell) => cell.alias === state.intentAlias);
  const anchoredCell = state.cells.find((cell) => cell.alias === state.currentLocation)
    || state.cells.find((cell) => cell.alias === state.landingSite)
    || intentCell;
  const terrainLabel = intentCell?.revealed ? TILE_LABELS[intentCell.tileType] : 'Uncharted';
  const worldMood = WORLD_MOODS[state.source.weather] || WORLD_MOODS[state.isDanger ? 'redline-storm' : 'glass-mist'];
  const terrainBackplate = anchoredCell?.revealed && anchoredCell.tileType === Tile.DESERT
    ? EMBERGLASS_BACKPLATE
    : CAVERN_BACKPLATE;
  const bossPresentation = bossPresentationFor(state.encounterId);
  const backplate = bossPresentation?.sceneTexture || guestLocationArtwork(state.source.locationName, terrainBackplate);

  return (
    <div
      ref={mountRef}
      className={`three-board-world relative h-full w-full overflow-hidden rounded-xl ${className}`}
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(7,11,8,0.25), rgba(7,11,8,0.9)), url('${backplate}')`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
      role={ariaLabel ? 'region' : undefined}
      aria-label={ariaLabel}
      data-renderer-state={status}
      data-camera-view={cameraView}
      data-board-phase={state.phase}
      data-world-chapter={state.source.chapter || 'untracked'}
      data-world-weather={state.source.weather || 'glass-mist'}
      data-world-intensity={state.source.intensity}
      data-board-encounter={state.encounterId || 'none'}
      data-board-boss={bossPresentation?.id || 'none'}
      data-premium-presentation="true"
      data-view-model-version={state.schemaVersion}
      data-testid="three-board-world"
    >
      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[radial-gradient(circle_at_50%_46%,rgba(76,145,219,0.12),transparent_28%),rgba(5,8,6,0.88)] backdrop-blur-[2px]" role="status" aria-live="polite">
          <div className="rounded border border-blueprint/30 bg-exp-dark/75 px-4 py-3 text-center shadow-[0_0_50px_rgba(76,145,219,0.12)]">
            <p className="font-mono text-[9px] uppercase tracking-[0.26em] text-blueprint">World answering</p>
            <p className="mt-2 font-display text-base uppercase tracking-[0.14em] text-exp-text">Knitting the revealed terrain</p>
          </div>
        </div>
      )}
      <div className={`three-board-color-grade pointer-events-none absolute inset-0 z-10 ${worldMood.overlay}`} />
      <div className={`three-board-weather pointer-events-none absolute inset-0 z-10 three-board-weather-${state.source.weather || 'glass-mist'}`} style={{ '--world-intensity': state.source.intensity / 100 }} />
      <div className="three-board-vignette pointer-events-none absolute inset-0 z-[11]" />
      <div className="three-board-grain pointer-events-none absolute inset-0 z-[12] opacity-[0.09]" />
      <div className="pointer-events-none absolute left-3 top-3 z-20 rounded border border-white/10 bg-exp-dark/70 px-2.5 py-2 backdrop-blur-sm">
        <p className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.25em] text-exp-text-dim"><span className={`h-1.5 w-1.5 rounded-full ${state.isDanger ? 'bg-signal-red' : state.isResolving ? 'bg-compass' : 'bg-oxide-green'}`} />{worldMood.label}</p>
        <p className="mt-1 font-display text-sm uppercase tracking-[0.12em] text-exp-text">
          {state.source.locationName || (state.isDanger ? 'Redline terrain' : state.isResolving ? 'World resolving' : state.isComplete ? 'World settled' : 'Expedition world')}
        </p>
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-20 rounded border border-white/10 bg-exp-dark/70 px-2.5 py-2 text-right backdrop-blur-sm">
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-exp-text-dim">Focus</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-compass-bright">
          {state.intentAlias || state.currentLocation || state.landingSite || 'Scanning'} / {terrainLabel}
        </p>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[72%] rounded border border-white/10 bg-exp-dark/75 px-2.5 py-2 backdrop-blur-sm">
        <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-exp-text-dim">
          {ACTION_LABELS[state.activeAction] || 'Survey'} / {state.hasSubmitted ? 'committed' : 'choose a reachable tile'}
        </p>
        <p className="mt-1 hidden font-mono text-[9px] tracking-[0.08em] text-exp-text sm:block">
          {state.isDanger ? 'Storm pressure is changing the light.' : state.isResolving ? 'Intent is moving through the world.' : state.isComplete ? 'The route is now a memory.' : 'The crew is listening for the next signal.'}
        </p>
      </div>
      {status === 'ready' && (
        <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1.5" data-testid="board-camera-controls">
          {!cameraControlsOpen && (
            <p className="pointer-events-none hidden rounded border border-white/10 bg-exp-dark/75 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-exp-text-dim backdrop-blur-sm sm:block">
              Drag orbit / right-drag pan / scroll zoom
            </p>
          )}
          {cameraControlsOpen && (
            <div className="rounded-md border border-white/10 bg-exp-dark/65 p-1 backdrop-blur-sm" role="group" aria-label="Map camera controls">
              <div className="grid grid-cols-3 gap-1">
                {[
                  ['rotate-left', 'Rotate camera left'],
                  ['pan-up', 'Pan camera forward'],
                  ['rotate-right', 'Rotate camera right'],
                  ['pan-left', 'Pan camera left'],
                  ['reset', 'Reset camera view'],
                  ['pan-right', 'Pan camera right'],
                  ['zoom-out', 'Zoom camera out'],
                  ['pan-down', 'Pan camera backward'],
                  ['zoom-in', 'Zoom camera in'],
                ].map(([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    className={CAMERA_BUTTON_CLASS}
                    aria-label={label}
                    title={label}
                    disabled={action === 'reset' && cameraView === 'default'}
                    onClick={() => worldRef.current?.cameraAction(action)}
                  >
                    <CameraGlyph kind={action} />
                  </button>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {[['overview', 'Overview'], ['party', 'Party'], ['intent', 'Intent']].map(([action, label]) => (
                  <button key={action} type="button" className={`${CAMERA_BUTTON_CLASS} font-mono text-[8px] uppercase tracking-[0.08em]`} aria-label={`${label} camera preset`} onClick={() => worldRef.current?.cameraAction(action)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            className={`${CAMERA_BUTTON_CLASS} flex gap-2 px-3 font-mono text-[9px] uppercase tracking-[0.16em] ${cameraControlsOpen ? 'border-compass/40 text-compass-bright' : ''}`}
            aria-expanded={cameraControlsOpen}
            aria-label={`${cameraControlsOpen ? 'Close' : 'Open'} camera controls`}
            onClick={() => setCameraControlsOpen((open) => !open)}
          >
            <CameraGlyph kind="reset" />
            Camera
          </button>
          <span className="sr-only" aria-live="polite">Camera view: {cameraView}</span>
        </div>
      )}
      {state.isResolving && (
        <div
          className="three-board-resolution pointer-events-none absolute inset-0 z-[15] overflow-hidden"
          data-testid="board-resolution-ritual"
          role="status"
          aria-live="polite"
        >
          <div className="three-board-resolution-sweep absolute inset-y-0 left-[-36%] w-[36%] bg-gradient-to-r from-transparent via-compass/20 to-transparent mix-blend-screen" />
          <div className="three-board-impact-flare absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-compass/10 blur-2xl" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-exp-dark/95 via-exp-dark/45 to-transparent px-4 pb-14 pt-20 text-center">
            <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-compass-bright">Route committed</p>
            <p className="mt-1 font-display text-base uppercase tracking-[0.13em] text-exp-text">The world is answering</p>
            <div className="mx-auto mt-3 flex max-w-xs items-center justify-center gap-2 font-mono text-[8px] uppercase tracking-[0.16em] text-exp-text-dim" aria-hidden="true">
              <span className="three-board-stage three-board-stage-1">Anticipate</span><span>/</span>
              <span className="three-board-stage three-board-stage-2">Cross</span><span>/</span>
              <span className="three-board-stage three-board-stage-3">Impact</span><span>/</span>
              <span className="three-board-stage three-board-stage-4">Settle</span>
            </div>
          </div>
        </div>
      )}
      {state.isDanger && !state.isResolving && (
        <div className="three-board-danger-frame pointer-events-none absolute inset-0 z-[14]" role="status" aria-live="polite">
          <div className="absolute inset-x-0 top-0 h-px bg-signal-red/80 shadow-[0_0_24px_rgba(239,98,87,0.72)]" />
          <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded border border-signal-red/45 bg-exp-dark/80 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.24em] text-signal-red backdrop-blur-sm">Storm pressure rising</p>
        </div>
      )}
      {state.encounterId && !state.isDanger && !state.isResolving && (
        <div className="pointer-events-none absolute inset-0 z-[14]" role="status" aria-live="polite">
          <div className="absolute inset-x-[18%] top-0 h-px bg-compass/80 shadow-[0_0_24px_rgba(232,200,96,0.58)]" />
          <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded border border-compass/45 bg-exp-dark/80 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.24em] text-compass-bright backdrop-blur-sm">
            {bossPresentation ? `Apex encounter / ${bossPresentation.label}` : 'Landmark decision'}
          </p>
        </div>
      )}
      {state.isComplete && (
        <div className="three-board-extraction pointer-events-none absolute inset-0 z-[14]" role="status" aria-live="polite">
          <div className="three-board-extraction-light absolute left-1/2 top-1/2 h-[70%] w-[42%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse,rgba(112,221,173,0.22),transparent_66%)]" />
          <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded border border-oxide-green/45 bg-exp-dark/80 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.24em] text-oxide-green backdrop-blur-sm">Expedition memory secured</p>
        </div>
      )}
      {status === 'ready' && onTileClick && (
        <div className="sr-only" aria-label="Board tile controls">
          {state.cells.map((cell) => (
            <button key={cell.alias} type="button" onClick={() => onTileClick?.(cell.alias)} onFocus={() => onTileHover?.(cell.alias)}>
              {cell.alias} {cell.revealed ? TILE_LABELS[cell.tileType] : 'Uncharted'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
