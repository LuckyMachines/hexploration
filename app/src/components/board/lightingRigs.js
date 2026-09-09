import materialSystem from '../../art-pipeline/material-system.json';

export const LIGHTING_RIG_VERSION = materialSystem.version;
export const LIGHTING_RIGS = Object.freeze(materialSystem.lightingRigs);
export const LIGHTING_RIG_IDS = Object.freeze(Object.keys(LIGHTING_RIGS));

export function resolveLightingRigId(state = {}) {
  if (state.isDanger) return 'danger';
  if (state.isResolving) return 'discovery';
  if (state.lowStats) return 'recovery';
  if (state.activeAction === 4) return 'relic';
  return 'neutral';
}

function copyRig(THREE, rig) {
  return {
    exposure: rig.exposure,
    fogDensity: rig.fog.density,
    fogColor: new THREE.Color(rig.fog.color),
    environmentIntensity: rig.environmentIntensity,
    hemisphereSky: new THREE.Color(rig.hemisphere.sky),
    hemisphereGround: new THREE.Color(rig.hemisphere.ground),
    hemisphereIntensity: rig.hemisphere.intensity,
    keyColor: new THREE.Color(rig.key.color),
    keyIntensity: rig.key.intensity,
    fillColor: new THREE.Color(rig.fill.color),
    fillIntensity: rig.fill.intensity,
    rimColor: new THREE.Color(rig.rim.color),
    rimIntensity: rig.rim.intensity,
  };
}

function applySnapshot(system, snapshot) {
  system.renderer.toneMappingExposure = snapshot.exposure;
  system.scene.fog.color.copy(snapshot.fogColor);
  system.scene.fog.density = snapshot.fogDensity;
  system.scene.environmentIntensity = snapshot.environmentIntensity;
  system.hemisphere.color.copy(snapshot.hemisphereSky);
  system.hemisphere.groundColor.copy(snapshot.hemisphereGround);
  system.hemisphere.intensity = snapshot.hemisphereIntensity;
  system.key.color.copy(snapshot.keyColor);
  system.key.intensity = snapshot.keyIntensity;
  system.fill.color.copy(snapshot.fillColor);
  system.fill.intensity = snapshot.fillIntensity;
  system.rim.color.copy(snapshot.rimColor);
  system.rim.intensity = snapshot.rimIntensity;
}

export function createLightingSystem(THREE, { renderer, scene, world, quality, RoomEnvironment = null }) {
  const hemisphere = new THREE.HemisphereLight();
  const key = new THREE.DirectionalLight();
  key.position.set(-world.radius * 0.72, world.radius * 1.58, world.radius * 0.86);
  key.castShadow = quality.shadows;
  key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  key.shadow.camera.left = -world.radius * 0.94;
  key.shadow.camera.right = world.radius * 0.94;
  key.shadow.camera.top = world.radius * 0.94;
  key.shadow.camera.bottom = -world.radius * 0.94;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = world.radius * 4;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.035;
  key.shadow.radius = quality.mode === 'high' ? 2 : 1;
  const fill = new THREE.PointLight();
  fill.position.set(-world.width * 0.42, 3.25, world.depth * 0.32);
  fill.distance = world.radius * 2.1;
  fill.decay = 2;
  const rim = new THREE.PointLight();
  rim.position.set(world.width * 0.45, 4.1, -world.depth * 0.42);
  rim.distance = world.radius * 2.35;
  rim.decay = 2;
  scene.add(hemisphere, key, fill, rim);

  let environmentTarget = null;
  if (quality.environment && RoomEnvironment) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    environmentTarget = pmrem.fromScene(new RoomEnvironment(), 0.035);
    scene.environment = environmentTarget.texture;
    pmrem.dispose();
  }

  const initial = copyRig(THREE, LIGHTING_RIGS.neutral);
  const system = {
    renderer,
    scene,
    hemisphere,
    key,
    fill,
    rim,
    quality,
    current: initial,
    target: initial,
    activeRigId: 'neutral',
    transitioning: false,
    environmentTarget,
  };
  applySnapshot(system, initial);
  return system;
}

export function setLightingRig(THREE, system, rigId, { immediate = false } = {}) {
  const nextId = LIGHTING_RIGS[rigId] ? rigId : 'neutral';
  system.activeRigId = nextId;
  system.target = copyRig(THREE, LIGHTING_RIGS[nextId]);
  system.transitioning = !immediate;
  if (immediate) {
    system.current = copyRig(THREE, LIGHTING_RIGS[nextId]);
    applySnapshot(system, system.current);
  }
}

export function updateLightingSystem(system, deltaSeconds) {
  if (!system.transitioning) return false;
  const amount = 1 - Math.exp(-Math.max(0, deltaSeconds) * 5.5);
  const current = system.current;
  const target = system.target;
  for (const key of ['exposure', 'fogDensity', 'environmentIntensity', 'hemisphereIntensity', 'keyIntensity', 'fillIntensity', 'rimIntensity']) {
    current[key] += (target[key] - current[key]) * amount;
  }
  for (const key of ['fogColor', 'hemisphereSky', 'hemisphereGround', 'keyColor', 'fillColor', 'rimColor']) current[key].lerp(target[key], amount);
  applySnapshot(system, current);
  const remaining = Math.abs(current.exposure - target.exposure)
    + Math.abs(current.fogDensity - target.fogDensity)
    + Math.abs(current.fillIntensity - target.fillIntensity)
    + Math.abs(current.fogColor.r - target.fogColor.r)
    + Math.abs(current.fogColor.g - target.fogColor.g)
    + Math.abs(current.fogColor.b - target.fogColor.b);
  system.transitioning = remaining > 0.002;
  if (!system.transitioning) {
    system.current = target;
    applySnapshot(system, target);
  }
  return system.transitioning;
}

export function disposeLightingSystem(system) {
  system.environmentTarget?.dispose();
}
