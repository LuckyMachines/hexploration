import { useEffect, useMemo, useRef, useState } from 'react';
import { ACTION_LABELS, Action, PLAYER_COLORS, TILE_LABELS, Tile } from '../../lib/constants';
import {
  CHARACTER_NEUTRAL_TEXTURE_PATHS,
  CHARACTER_TEXTURE_PATHS,
  deriveCharacterState,
  resolveCharacterVisual,
  resolvePlayerCharacter,
} from '../../lib/characters';
import { buildBoardWorld, cameraPlan, seedForAlias, WORLD_TERRAIN } from './boardWorld';
import { nextPixelRatio, resolveBoardQuality } from './boardQuality';
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
const STATE_FX_TEXTURES = {
  discovery: '/images/art/fx/discovery-bloom.png',
  danger: '/images/art/fx/redline-pressure.png',
};
const CUTOUT_PROP_TEXTURES = {
  [Tile.LANDING]: '/images/art/props/landing-beacon.png',
  [Tile.JUNGLE]: '/images/art/props/glassroot-fronds.png',
  [Tile.PLAINS]: '/images/art/props/lantern-moss.png',
  [Tile.DESERT]: '/images/art/props/emberglass-shards.png',
  [Tile.MOUNTAIN]: '/images/art/props/slate-spires.png',
  [Tile.RELIC]: '/images/art/props/violet-reliquary.png',
};
const CUTOUT_PROP_SCALES = {
  [Tile.LANDING]: [0.82, 1.08],
  [Tile.JUNGLE]: [1.08, 1.18],
  [Tile.PLAINS]: [1.18, 0.88],
  [Tile.DESERT]: [1, 1.1],
  [Tile.MOUNTAIN]: [1.18, 1.1],
  [Tile.RELIC]: [1.12, 1.14],
};
const CAMPSITE_PROP_TEXTURE = '/images/art/props/campsite-shelter.png';
const ATLAS_SPINDLE_TEXTURE = '/images/art/relics/atlas-spindle.png';
const TIDEGLASS_CRADLE_TEXTURE = '/images/art/relics/tideglass-heart.png';
const CAVERN_BACKPLATE = '/images/art/environments/glassroot-cavern.webp';
const EMBERGLASS_BACKPLATE = '/images/art/environments/emberglass-crossing.webp';
const ENCOUNTER_TEXTURES = {
  glassrootGrazer: '/images/art/encounters/glassroot-stalker.png',
  emberglassScuttler: '/images/art/encounters/emberglass-mimic.png',
};
const ROUTE_FORK_TEXTURE = '/images/art/props/route-fork-marker.png';

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

function addCutoutProp(THREE, group, tile, texture, seed, options = {}) {
  const prop = new THREE.Group();
  const [baseWidth, baseHeight] = options.scale || CUTOUT_PROP_SCALES[tile.tileType];
  const scaleVariation = 0.92 + (seed % 9) * 0.012;
  const mirror = options.mirror === false ? 1 : seed % 2 ? -1 : 1;
  const horizontalOffset = options.x ?? (((seed >> 5) & 7) / 7 - 0.5) * 0.18;
  const depthOffset = options.z ?? (((seed >> 9) & 7) / 7 - 0.5) * 0.12;

  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.37, 24),
    new THREE.MeshBasicMaterial({
      color: '#020503',
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
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

  const lightColor = options.lightColor || (tile.tileType === Tile.RELIC ? '#b994e6' : '');
  if (lightColor) {
    const relicLight = new THREE.PointLight(lightColor, options.lightIntensity || 0.72, 1.8, 2);
    relicLight.position.set(horizontalOffset, 0.42, depthOffset);
    prop.add(relicLight);
  }

  prop.userData.kind = options.kind || 'cutout-prop';
  prop.userData.persistent = Boolean(options.persistent);
  group.add(prop);
  return prop;
}

function addTerrainLandmarks(THREE, tile, mesh, propTexture, campsiteTexture) {
  if (!tile.revealed || tile.tileType === Tile.NONE) return;
  const group = new THREE.Group();
  group.position.y = tile.height / 2 + 0.02;
  const seed = seedForAlias(tile.alias);
  const offset = (shift) => (((seed >> shift) & 15) / 15 - 0.5) * 0.52;
  const cutoutProp = propTexture ? addCutoutProp(
    THREE,
    group,
    tile,
    propTexture,
    seed,
    tile.tileType === Tile.LANDING
      ? { x: -0.34, z: 0.12, mirror: false, persistent: true, lightColor: '#4c91db', lightIntensity: 0.58 }
      : {},
  ) : null;

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

  const baseRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.235, 0.018, 8, 28),
    material(THREE, color, {
      emissive: color,
      emissiveIntensity: isCurrent ? 1.5 : 0.45,
      transparent: true,
      opacity: isCurrent ? 0.92 : 0.62,
      depthWrite: false,
      roughness: 0.38,
    }),
  );
  baseRim.rotation.x = Math.PI / 2;
  baseRim.position.y = 0.125;
  group.add(baseRim);

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
  }
  group.userData.kind = isCurrent ? 'current-pawn' : 'pawn';
  return group;
}

function addRoute(THREE, group, aliases, worldByAlias, color, opacity = 1) {
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
  points.slice(1).forEach((point) => {
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
  midpoint.y += 0.48;
  const curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
  const beam = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 28, 0.035, 8, false),
    material(THREE, '#b994e6', {
      emissive: '#9060c0',
      emissiveIntensity: 2.8,
      roughness: 0.25,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
  );
  rescue.add(beam);

  [start, end].forEach((position, index) => {
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(index === 0 ? 0.085 : 0.12, 12, 10),
      material(THREE, index === 0 ? '#b994e6' : '#70ddad', {
        emissive: index === 0 ? '#9060c0' : '#40a080',
        emissiveIntensity: 3,
        roughness: 0.2,
      }),
    );
    node.position.copy(position);
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

function addDynamicWorld(THREE, context, state) {
  clearGroup(context.dynamicGroup);
  context.animated = [];
  context.isResolving = Boolean(state.isResolving);
  setLightingRig(THREE, context.lighting, resolveLightingRigId(state), { immediate: context.reducedMotion });
  const selected = new Set(state.selectedPath || []);
  const reachable = new Set(state.reachableAliases || []);
  const occupiedAliases = new Set(
    Object.entries(state.playerLocationMap || {})
      .filter(([, playerIndices]) => playerIndices?.length)
      .map(([alias]) => alias),
  );
  context.propLandmarks.forEach((prop, alias) => {
    prop.visible = prop.userData.persistent || !occupiedAliases.has(alias);
  });

  context.tileMeshes.forEach((mesh) => {
    const tile = mesh.userData.tile;
    const top = mesh.material[1];
    mesh.position.y = tile.height / 2;
    mesh.scale.set(1, 1, 1);
    top.emissive.set(WORLD_TERRAIN[tile.revealed ? tile.tileType : Tile.NONE].emissive);
    top.emissiveIntensity = tile.revealed ? 0.08 : 0.015;
    if (reachable.has(tile.alias)) {
      top.emissiveIntensity = 0.24;
      const reachableHalo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.76, 0.76, 0.016, 6),
        material(THREE, '#6bd0c4', {
          emissive: '#4ebcad',
          emissiveIntensity: 1.4,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        }),
      );
      reachableHalo.position.set(tile.x, tile.height + 0.025, tile.z);
      reachableHalo.rotation.y = Math.PI / 6;
      context.dynamicGroup.add(reachableHalo);
    }
    if (selected.has(tile.alias)) {
      top.emissive.set('#c4a64a');
      top.emissiveIntensity = 0.48;
      mesh.position.y += 0.08;
      const selectedHalo = new THREE.Mesh(
        new THREE.TorusGeometry(0.66, 0.025, 8, 36),
        material(THREE, '#e8c860', {
          emissive: '#c4a64a',
          emissiveIntensity: 1.7,
          transparent: true,
          opacity: 0.78,
          depthWrite: false,
        }),
      );
      selectedHalo.rotation.x = Math.PI / 2;
      selectedHalo.position.set(tile.x, tile.height + 0.19, tile.z);
      context.dynamicGroup.add(selectedHalo);
    }
    if (tile.alias === state.intentAlias) {
      top.emissive.set(state.isDanger ? '#d44040' : '#8ad9d1');
      top.emissiveIntensity = 0.72;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.028, 8, 42),
        material(THREE, state.isDanger ? '#ef6257' : '#8ad9d1', {
          emissive: state.isDanger ? '#d44040' : '#4ebcad',
          emissiveIntensity: 2,
          transparent: true,
          opacity: 0.84,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(tile.x, tile.height + 0.18, tile.z);
      ring.userData.kind = 'pulse';
      context.dynamicGroup.add(ring);
      context.animated.push({ object: ring, kind: 'pulse', baseY: ring.position.y });
    }
  });

  const intentTile = context.worldByAlias.get(state.intentAlias);
  const stateFxTexture = context.fxTextures[state.isDanger ? 'danger' : 'discovery'];
  if (intentTile && stateFxTexture) {
    const stateFx = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.66),
      new THREE.MeshBasicMaterial({
        map: stateFxTexture.clone(),
        color: 0xffffff,
        transparent: true,
        opacity: state.isDanger ? 0.64 : 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    stateFx.material.map.needsUpdate = true;
    stateFx.rotation.x = -Math.PI / 2;
    stateFx.rotation.z = state.isDanger ? -0.42 : 0.18;
    stateFx.position.set(intentTile.x, intentTile.height + 0.235, intentTile.z);
    context.dynamicGroup.add(stateFx);
  }

  const encounterTexture = state.isDanger && intentTile
    ? intentTile.tileType === Tile.DESERT
      ? context.encounterTextures.emberglassScuttler
      : intentTile.tileType === Tile.JUNGLE
        ? context.encounterTextures.glassrootGrazer
        : null
    : null;
  if (encounterTexture) {
    const encounterPreview = new THREE.Group();
    encounterPreview.position.set(intentTile.x, intentTile.height + 0.03, intentTile.z);
    addCutoutProp(THREE, encounterPreview, intentTile, encounterTexture, seedForAlias(intentTile.alias) + 67, {
      scale: intentTile.tileType === Tile.DESERT ? [0.72, 0.58] : [0.82, 0.58],
      x: 0.26,
      z: -0.18,
      mirror: false,
      persistent: true,
      lightColor: intentTile.tileType === Tile.DESERT ? '#e8a243' : '#8ad9d1',
      lightIntensity: 0.36,
      kind: 'encounter-preview',
    });
    context.dynamicGroup.add(encounterPreview);
    context.animated.push({ object: encounterPreview, kind: 'encounter-preview', baseY: encounterPreview.position.y });
  }

  const isPreviewingNewStep = (state.previewPath?.length || 0) > (state.selectedPath?.length || 0);
  if (intentTile && isPreviewingNewStep && context.routeForkTexture) {
    const routeFork = new THREE.Group();
    routeFork.position.set(intentTile.x, intentTile.height + 0.03, intentTile.z);
    addCutoutProp(THREE, routeFork, intentTile, context.routeForkTexture, seedForAlias(intentTile.alias) + 89, {
      scale: [0.42, 0.72],
      x: -0.34,
      z: 0.16,
      mirror: false,
      persistent: true,
      lightColor: '#e8c860',
      lightIntensity: 0.28,
      kind: 'route-fork-preview',
    });
    context.dynamicGroup.add(routeFork);
  }

  const relicTexture = intentTile && seedForAlias(intentTile.alias) % 2
    ? context.atlasTexture
    : context.tideglassTexture;
  if (intentTile && intentTile.tileType === Tile.RELIC && relicTexture) {
    const relicPreview = new THREE.Group();
    relicPreview.position.set(intentTile.x, intentTile.height + 0.025, intentTile.z);
    addCutoutProp(THREE, relicPreview, intentTile, relicTexture, seedForAlias(intentTile.alias), {
      scale: state.isResolving ? [0.76, 0.9] : [0.62, 0.76],
      mirror: false,
      persistent: true,
      lightColor: '#b994e6',
      lightIntensity: state.isResolving ? 1.2 : 0.74,
      kind: 'atlas-spindle-preview',
    });
    context.dynamicGroup.add(relicPreview);
    context.animated.push({ object: relicPreview, kind: 'relic-preview', baseY: relicPreview.position.y });
  }

  if (intentTile && state.isResolving) {
    for (let index = 0; index < 3; index += 1) {
      const wave = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.022, 8, 48),
        material(THREE, state.isDanger ? '#ef6257' : '#e8c860', {
          emissive: state.isDanger ? '#d44040' : '#c4a64a',
          emissiveIntensity: 2.2,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
        }),
      );
      wave.rotation.x = Math.PI / 2;
      wave.position.set(intentTile.x, intentTile.height + 0.2 + index * 0.012, intentTile.z);
      context.dynamicGroup.add(wave);
      context.animated.push({ object: wave, kind: 'resolve-wave', baseY: wave.position.y, delay: index / 3 });
    }
  }

  const routeAliases = [state.currentLocation, ...(state.previewPath || state.selectedPath || [])].filter(Boolean);
  addRoute(
    THREE,
    context.dynamicGroup,
    [...new Set(routeAliases)],
    context.worldByAlias,
    state.isDanger ? '#ef6257' : state.hasSubmitted ? '#55d692' : '#e8c860',
    state.hasSubmitted ? 1 : 0.82,
  );

  if (state.activeAction === Action.HELP) {
    const rescueEntry = Object.entries(state.playerLocationMap || {}).find(([, indices]) => (
      indices?.includes(state.currentPlayerIndex) && indices.length > 1
    ));
    if (rescueEntry) {
      const [alias, indices] = rescueEntry;
      const tile = context.worldByAlias.get(alias);
      const helperSlot = indices.indexOf(state.currentPlayerIndex);
      const targetSlot = indices.findIndex((playerIndex) => playerIndex !== state.currentPlayerIndex);
      if (tile && helperSlot >= 0 && targetSlot >= 0) {
        const rescue = addRescueLink(THREE, context.dynamicGroup, tile, helperSlot, targetSlot, indices.length);
        context.animated.push({ object: rescue, kind: 'rescue-link', baseY: rescue.position.y });
      }
    }
  }

  Object.entries(state.playerLocationMap || {}).forEach(([alias, indices]) => {
    const tile = context.worldByAlias.get(alias);
    if (!tile) return;
    indices.forEach((playerIndex, index) => {
      const player = state.crew?.[playerIndex] || {};
      const character = resolvePlayerCharacter(player, playerIndex);
      const characterState = deriveCharacterState({
        player,
        isCurrent: playerIndex === state.currentPlayerIndex,
        activeAction: state.activeAction,
        lowStats: state.lowStats,
        isResolving: state.isResolving,
        hasArtifact: Boolean(player.hasArtifact),
      });
      const presentation = resolveCharacterVisual({ characterId: character.id, state: characterState });
      const stateTexture = context.characterTextures[presentation.path];
      const standeeTexture = stateTexture || context.characterTextures[character.assets.neutral];
      const pawn = createPawn(
        THREE,
        PLAYER_COLORS[playerIndex] || PLAYER_COLORS[0],
        playerIndex === state.currentPlayerIndex,
        standeeTexture,
        character.standee,
      );
      pawn.userData.characterId = character.id;
      pawn.userData.characterState = stateTexture ? presentation.resolvedState : 'neutral';
      const angle = (index / Math.max(1, indices.length)) * Math.PI * 2;
      const radius = indices.length > 1 ? 0.28 : 0;
      pawn.position.set(tile.x + Math.cos(angle) * radius, tile.height + 0.04, tile.z + Math.sin(angle) * radius);
      pawn.rotation.y = -0.45;
      context.dynamicGroup.add(pawn);
      context.animated.push({ object: pawn, kind: playerIndex === state.currentPlayerIndex ? 'current-pawn' : 'pawn', baseY: pawn.position.y });
    });
  });
}

function createWorld(THREE, OrbitControls, RoomEnvironment, KTX2Loader, mount, world, initialState, handlers, performanceMode) {
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
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x09100c, 0.035);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 180);
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
  const worldByAlias = new Map(world.cells.map((tile) => [tile.alias, tile]));
  const usedTileTypes = new Set(world.cells.filter((tile) => tile.revealed).map((tile) => tile.tileType));
  const hasCampsite = world.cells.some((tile) => tile.hasCampsite);
  let resolveTextures;
  const texturesReady = new Promise((resolve) => { resolveTextures = resolve; });
  const loadingManager = new THREE.LoadingManager(() => resolveTextures());
  const textureLoader = new THREE.TextureLoader(loadingManager);
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
  const characterTexturePaths = quality.mode === 'efficient' ? CHARACTER_NEUTRAL_TEXTURE_PATHS : CHARACTER_TEXTURE_PATHS;
  const characterTextures = Object.fromEntries(characterTexturePaths.map((texturePath) => {
    const texture = textureLoader.load(texturePath);
    texture.colorSpace = THREE.SRGBColorSpace;
    return [texturePath, texture];
  }));
  const encounterTextures = quality.mode === 'efficient' ? {} : {
    glassrootGrazer: usedTileTypes.has(Tile.JUNGLE) ? textureLoader.load(ENCOUNTER_TEXTURES.glassrootGrazer) : null,
    emberglassScuttler: usedTileTypes.has(Tile.DESERT) ? textureLoader.load(ENCOUNTER_TEXTURES.emberglassScuttler) : null,
  };
  Object.values(encounterTextures).filter(Boolean).forEach((texture) => { texture.colorSpace = THREE.SRGBColorSpace; });
  const routeForkTexture = quality.mode === 'efficient' ? null : textureLoader.load(ROUTE_FORK_TEXTURE);
  if (routeForkTexture) routeForkTexture.colorSpace = THREE.SRGBColorSpace;
  const propTextures = new Map(Object.entries(CUTOUT_PROP_TEXTURES).filter(([tileType]) => usedTileTypes.has(Number(tileType))).map(([tileType, texturePath]) => {
    const texture = textureLoader.load(texturePath);
    texture.colorSpace = THREE.SRGBColorSpace;
    return [Number(tileType), texture];
  }));
  const campsiteTexture = hasCampsite ? textureLoader.load(CAMPSITE_PROP_TEXTURE) : null;
  if (campsiteTexture) campsiteTexture.colorSpace = THREE.SRGBColorSpace;
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
    tileMeshes,
    propLandmarks,
    worldByAlias,
    lighting,
    surfaceTextureSets,
    fxTextures,
    characterTextures,
    encounterTextures,
    routeForkTexture,
    propTextures,
    campsiteTexture,
    atlasTexture,
    tideglassTexture,
    controls,
    animated: [],
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('ux-reduced-motion'),
  };

  world.cells.forEach((tile) => {
    const terrain = WORLD_TERRAIN[tile.revealed ? tile.tileType : Tile.NONE] || WORLD_TERRAIN[Tile.NONE];
    const profile = tile.revealed ? surfaceProfileForTile(tile.tileType) : null;
    const textureSet = profile ? surfaceTextureSets.get(tile.tileType) : null;
    const seed = seedForAlias(tile.alias);
    const side = profile
      ? createSurfaceMaterial(THREE, profile, textureSet?.side, quality, { seed, side: true })
      : material(THREE, terrain.side, { roughness: 0.98, metalness: 0 });
    const top = profile
      ? createSurfaceMaterial(THREE, profile, textureSet?.top, quality, { seed })
      : material(THREE, terrain.top, {
        roughness: 0.94,
        metalness: 0,
        emissive: terrain.emissive,
        emissiveIntensity: 0.012,
        transparent: true,
        opacity: 0.68,
      });
    const geometry = new THREE.CylinderGeometry(0.94, 0.88, tile.height, 6, 1, false);
    applySurfaceUvVariation(geometry, profile, seed);
    const mesh = new THREE.Mesh(geometry, [side, top, side]);
    mesh.position.set(tile.x, tile.height / 2, tile.z);
    mesh.rotation.y = Math.PI / 6;
    mesh.castShadow = tile.revealed;
    mesh.receiveShadow = true;
    mesh.userData.alias = tile.alias;
    mesh.userData.tile = tile;
    mesh.userData.surfaceId = profile?.id || 'unknown';

    if (tile.revealed) {
      const collarGeometry = new THREE.CylinderGeometry(0.945, 0.92, 0.055, 6, 1, false);
      applySurfaceUvVariation(collarGeometry, profile, seed + 17);
      const collar = new THREE.Mesh(collarGeometry, [side, top, side]);
      collar.position.y = tile.height / 2 + 0.012;
      collar.castShadow = true;
      collar.receiveShadow = true;
      mesh.add(collar);
    }

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      new THREE.LineBasicMaterial({ color: tile.revealed ? 0xa2ab96 : 0x263027, transparent: true, opacity: tile.revealed ? 0.26 : 0.34 }),
    );
    mesh.add(edges);
    const propLandmark = addTerrainLandmarks(THREE, tile, mesh, propTextures.get(tile.tileType), campsiteTexture);
    if (propLandmark) propLandmarks.set(tile.alias, propLandmark);
    boardGroup.add(mesh);
    tileMeshes.push(mesh);
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

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const drag = { pointerId: null, startX: 0, startY: 0, moved: false };
  let suppressClickUntil = 0;
  const pick = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(tileMeshes, false)[0]?.object?.userData?.alias || '';
  };
  const onPointerDown = (event) => {
    drag.pointerId = event.pointerId;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.moved = false;
  };
  const onPointerMove = (event) => {
    if (drag.pointerId === event.pointerId && event.buttons) {
      drag.moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5;
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
    constrainedTarget.x = THREE.MathUtils.clamp(constrainedTarget.x, -world.width * 0.42, world.width * 0.42);
    constrainedTarget.y = THREE.MathUtils.clamp(constrainedTarget.y, 0, 0.9);
    constrainedTarget.z = THREE.MathUtils.clamp(constrainedTarget.z, -world.depth * 0.42, world.depth * 0.42);
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
  const onContextLost = (event) => {
    event.preventDefault();
    handlers.current.onContextLost?.();
  };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);

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
  const cameraRight = new THREE.Vector3();
  let currentPixelRatio = renderer.getPixelRatio();
  renderer.domElement.dataset.pixelRatio = currentPixelRatio.toFixed(2);
  let frame = 0;
  const animate = () => {
    frame = 0;
    if (disposed || !pageVisible || !boardVisible) return;
    const delta = Math.min(0.1, clock.getDelta());
    const elapsed = clock.elapsedTime;
    const lightingMoving = updateLightingSystem(lighting, delta);
    cameraRight.setFromMatrixColumn(camera.matrix, 0).setY(0).normalize();
    lighting.rim.position.set(
      controls.target.x + cameraRight.x * world.radius * 0.82,
      world.radius * 0.72,
      controls.target.z + cameraRight.z * world.radius * 0.82,
    );
    if (!context.reducedMotion) {
      particles.rotation.y = elapsed * 0.012;
      context.animated.forEach(({ object, kind, baseY, delay = 0 }, index) => {
        if (kind === 'pulse') {
          const pulse = 1 + Math.sin(elapsed * 2.5 + index) * 0.035;
          object.scale.setScalar(pulse);
        } else if (kind === 'resolve-wave') {
          const phase = (elapsed * 0.72 + delay) % 1;
          object.scale.setScalar(0.82 + phase * 0.72);
          object.material.opacity = (1 - phase) * 0.72;
        } else {
          object.position.y = baseY + Math.sin(elapsed * 1.7 + index) * (kind === 'current-pawn' ? 0.035 : 0.018);
        }
      });
    }
    controls.update();
    renderer.render(scene, camera);
    renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
    renderer.domElement.dataset.triangles = String(renderer.info.render.triangles);
    renderer.domElement.dataset.textures = String(renderer.info.memory.textures);
    renderer.domElement.dataset.lightingRig = lighting.activeRigId;
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

  return {
    ...context,
    ready: texturesReady,
    cameraAction: (action) => {
      if (!cameraInitialized || !defaultView) return;
      if (action === 'reset') {
        camera.position.copy(defaultView.position);
        controls.target.copy(defaultView.target);
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
      disposeLightingSystem(lighting);
      disposeObject(scene);
      surfaceTextureSets.forEach((textureSet) => {
        Object.values(textureSet.top).forEach((texture) => texture.dispose());
        Object.values(textureSet.side).forEach((texture) => texture.dispose());
      });
      Object.values(fxTextures).forEach((texture) => texture.dispose());
      Object.values(characterTextures).forEach((texture) => texture.dispose());
      Object.values(encounterTextures).filter(Boolean).forEach((texture) => texture.dispose());
      routeForkTexture?.dispose();
      propTextures.forEach((texture) => texture.dispose());
      campsiteTexture?.dispose();
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
  lowStats = false,
  performanceMode = 'auto',
  onTileClick,
  onTileHover,
  onReady,
  onUnavailable,
  ariaLabel,
  className = '',
}) {
  const mountRef = useRef(null);
  const worldRef = useRef(null);
  const handlersRef = useRef({ onTileClick, onTileHover });
  const stateRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [cameraView, setCameraView] = useState('default');
  const [cameraControlsOpen, setCameraControlsOpen] = useState(false);
  const cellsKey = useMemo(
    () => cells.map((cell) => `${cell.alias}:${cell.revealed ? cell.tileType : 'fog'}:${cell.hasCampsite ? 1 : 0}`).join('|'),
    [cells],
  );
  const state = useMemo(() => ({
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
    lowStats,
  }), [activeAction, crew, currentLocation, currentPlayerIndex, hasSubmitted, intentAlias, isDanger, isResolving, landingSite, lowStats, playerLocationMap, previewPath, reachableAliases, selectedPath]);

  handlersRef.current = {
    onTileClick,
    onTileHover,
    onCameraChange: setCameraView,
    onContextLost: () => {
      setStatus('unavailable');
      onUnavailable?.();
    },
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
    ]).then(([THREE, { OrbitControls }, { RoomEnvironment }, { KTX2Loader }]) => {
      if (disposed || !mountRef.current) return;
      try {
        worldInstance = createWorld(THREE, OrbitControls, RoomEnvironment, KTX2Loader, mount, buildBoardWorld(cells), stateRef.current, handlersRef, performanceMode);
        worldRef.current = worldInstance;
        worldInstance.ready.then(() => {
          if (disposed || worldRef.current !== worldInstance) return;
          worldInstance.update(stateRef.current);
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

  const intentCell = cells.find((cell) => cell.alias === intentAlias);
  const anchoredCell = cells.find((cell) => cell.alias === currentLocation)
    || cells.find((cell) => cell.alias === landingSite)
    || intentCell;
  const terrainLabel = intentCell?.revealed ? TILE_LABELS[intentCell.tileType] : 'Uncharted';
  const backplate = anchoredCell?.revealed && anchoredCell.tileType === Tile.DESERT
    ? EMBERGLASS_BACKPLATE
    : CAVERN_BACKPLATE;

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
      data-testid="three-board-world"
    >
      <div className={`pointer-events-none absolute inset-0 z-10 ${isDanger ? 'bg-[radial-gradient(circle_at_58%_48%,rgba(239,98,87,0.17),transparent_28%),linear-gradient(180deg,transparent_62%,rgba(7,9,7,0.76))]' : 'bg-[radial-gradient(circle_at_72%_18%,rgba(104,213,228,0.12),transparent_30%),linear-gradient(180deg,transparent_58%,rgba(5,8,6,0.72))]'}`} />
      <div className="pointer-events-none absolute left-3 top-3 z-20 rounded border border-white/10 bg-exp-dark/70 px-2.5 py-2 backdrop-blur-sm">
        <p className="font-mono text-[8px] uppercase tracking-[0.25em] text-exp-text-dim">Living survey</p>
        <p className="mt-1 font-display text-sm uppercase tracking-[0.12em] text-exp-text">
          {isDanger ? 'Redline terrain' : isResolving ? 'World resolving' : 'Expedition world'}
        </p>
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-20 rounded border border-white/10 bg-exp-dark/70 px-2.5 py-2 text-right backdrop-blur-sm">
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-exp-text-dim">Focus</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-compass-bright">
          {intentAlias || currentLocation || landingSite || 'Scanning'} / {terrainLabel}
        </p>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[72%] rounded border border-white/10 bg-exp-dark/75 px-2.5 py-2 backdrop-blur-sm">
        <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-exp-text-dim">
          {ACTION_LABELS[activeAction] || 'Survey'} / {hasSubmitted ? 'committed' : 'choose a reachable tile'}
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
            <div className="grid grid-cols-3 gap-1 rounded-md border border-white/10 bg-exp-dark/65 p-1 backdrop-blur-sm" role="group" aria-label="Map camera controls">
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
      {isResolving && (
        <div
          className="three-board-resolution pointer-events-none absolute inset-0 z-[15] overflow-hidden"
          data-testid="board-resolution-ritual"
          role="status"
          aria-live="polite"
        >
          <div className="three-board-resolution-sweep absolute inset-y-0 left-[-36%] w-[36%] bg-gradient-to-r from-transparent via-compass/20 to-transparent mix-blend-screen" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-exp-dark/90 via-exp-dark/30 to-transparent px-4 pb-14 pt-16 text-center">
            <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-compass-bright">Route resolving</p>
            <p className="mt-1 font-display text-sm uppercase tracking-[0.13em] text-exp-text">The world is answering</p>
          </div>
        </div>
      )}
      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-exp-dark/45 font-mono text-[9px] uppercase tracking-[0.22em] text-exp-text-dim">
          Building terrain
        </div>
      )}
      {status === 'ready' && onTileClick && (
        <div className="sr-only" aria-label="Board tile controls">
          {cells.map((cell) => (
            <button key={cell.alias} type="button" onClick={() => onTileClick?.(cell.alias)} onFocus={() => onTileHover?.(cell.alias)}>
              {cell.alias} {cell.revealed ? TILE_LABELS[cell.tileType] : 'Uncharted'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
