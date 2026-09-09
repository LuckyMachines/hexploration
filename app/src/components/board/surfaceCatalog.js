import materialSystem from '../../art-pipeline/material-system.json';

export const MATERIAL_SYSTEM_VERSION = materialSystem.version;
export const MATERIAL_CHANNELS = Object.freeze(Object.keys(materialSystem.channels));
export const SURFACE_PROFILES = Object.freeze(materialSystem.materials);
export const MATERIAL_QUALITY_CONTRACT = Object.freeze(materialSystem.qualityContract);

const PROFILE_BY_TILE = new Map(SURFACE_PROFILES.map((profile) => [Number(profile.tileType), profile]));
const PROFILE_BY_ID = new Map(SURFACE_PROFILES.map((profile) => [profile.id, profile]));

export function surfaceProfileForTile(tileType) {
  return PROFILE_BY_TILE.get(Number(tileType)) || null;
}

export function surfaceProfileById(materialId) {
  return PROFILE_BY_ID.get(materialId) || null;
}

export function materialAssetPath(profile, channel, { side = false, container = 'webp' } = {}) {
  if (!profile || !MATERIAL_CHANNELS.includes(channel)) return null;
  const directory = profile.directory.replace(/^app\/public/, '');
  return `${directory}/${side ? 'side-' : ''}${channel}.${container}`;
}

export function materialAssetPaths(profile, options = {}) {
  return Object.fromEntries(MATERIAL_CHANNELS.map((channel) => [channel, materialAssetPath(profile, channel, options)]));
}

function seededUnit(seed, salt) {
  let value = (Number(seed) || 1) ^ salt;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function configureTexture(THREE, texture, channel, quality) {
  texture.colorSpace = materialSystem.channels[channel].colorSpace === 'srgb'
    ? THREE.SRGBColorSpace
    : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = quality.anisotropy;
  return texture;
}

export function loadSurfaceTextureSet(THREE, textureLoader, profile, quality, { side = false } = {}) {
  if (!profile) return {};
  const enabled = new Set(['baseColor', 'roughness', 'emissive']);
  if (quality.normalMap) enabled.add('normal');
  if (quality.aoMap && !side) enabled.add('ao');
  if (quality.heightMap && !side && !quality.normalMap) enabled.add('height');
  if (side) enabled.delete('emissive');
  return Object.fromEntries([...enabled].map((channel) => {
    const assetPath = materialAssetPath(profile, channel, { side, container: quality.compressedTextures ? 'ktx2' : 'webp' });
    if (!quality.compressedTextures) return [channel, configureTexture(THREE, textureLoader.load(assetPath), channel, quality)];
    const placeholder = new THREE.CompressedTexture();
    const completionToken = `${assetPath}#transcode`;
    textureLoader.manager.itemStart(completionToken);
    textureLoader.load(
      assetPath,
      (loaded) => {
        placeholder.copy(configureTexture(THREE, loaded, channel, quality));
        placeholder.needsUpdate = true;
        textureLoader.manager.itemEnd(completionToken);
      },
      undefined,
      () => {
        placeholder.userData.loadError = assetPath;
        textureLoader.manager.itemError(completionToken);
        textureLoader.manager.itemEnd(completionToken);
      },
    );
    return [channel, placeholder];
  }));
}

export function applySurfaceUvVariation(geometry, profile, seed = 1) {
  const uv = geometry?.attributes?.uv;
  if (!uv || !profile) return geometry;
  const repeat = profile.uv.repeat * (0.94 + seededUnit(seed, 101) * 0.12);
  const jitter = profile.uv.jitter || 0;
  const offsetX = (seededUnit(seed, 149) - 0.5) * jitter;
  const offsetY = (seededUnit(seed, 197) - 0.5) * jitter;
  const angle = Math.floor(seededUnit(seed, 241) * profile.uv.rotationSteps) * ((Math.PI * 2) / profile.uv.rotationSteps);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  for (let index = 0; index < uv.count; index += 1) {
    const x = (uv.getX(index) - 0.5) * repeat;
    const y = (uv.getY(index) - 0.5) * repeat;
    uv.setXY(index, 0.5 + x * cosine - y * sine + offsetX, 0.5 + x * sine + y * cosine + offsetY);
  }
  uv.needsUpdate = true;
  if (!geometry.attributes.uv1) geometry.setAttribute('uv1', uv.clone());
  return geometry;
}

export function createSurfaceMaterial(THREE, profile, textureSet, quality, {
  seed = 1,
  side = false,
  debugChannel = 'material',
} = {}) {
  const maps = textureSet || {};
  if (debugChannel !== 'material') {
    const channel = debugChannel === 'albedo' ? 'baseColor' : debugChannel;
    return new THREE.MeshBasicMaterial({
      color: channel === 'emissive' ? '#ffffff' : '#ffffff',
      map: maps[channel] || null,
      fog: true,
      toneMapped: channel === 'albedo',
    });
  }
  const surfaceColor = side
    ? new THREE.Color(profile.sideTint).lerp(new THREE.Color('#ffffff'), 0.26)
    : new THREE.Color('#ffffff');
  const material = new THREE.MeshStandardMaterial({
    name: `${profile.id}:${side ? 'side' : 'top'}`,
    color: surfaceColor,
    map: maps.baseColor || null,
    normalMap: maps.normal || null,
    roughnessMap: maps.roughness || null,
    aoMap: maps.ao || null,
    bumpMap: maps.height || null,
    emissiveMap: maps.emissive || null,
    roughness: side ? Math.min(1, profile.roughness + 0.08) : profile.roughness,
    metalness: side ? profile.metalness * 0.35 : profile.metalness,
    emissive: profile.emissiveColor,
    emissiveIntensity: side ? profile.emissiveIntensity * 0.25 : profile.emissiveIntensity,
    aoMapIntensity: profile.aoIntensity,
    bumpScale: side ? profile.bumpScale * 0.55 : profile.bumpScale,
    envMapIntensity: quality.environment ? (side ? 0.42 : 0.62) : 0,
    flatShading: side,
  });
  if (material.normalMap) material.normalScale.set(profile.normalScale, profile.normalScale);
  material.userData.materialSystemVersion = MATERIAL_SYSTEM_VERSION;
  material.userData.surfaceId = profile.id;
  material.userData.channelPaths = materialAssetPaths(profile, { side });
  return material;
}

export function materialTextureBudgetMiB(profileCount = SURFACE_PROFILES.length, channelsPerProfile = MATERIAL_CHANNELS.length, variantsPerProfile = 2) {
  const rgbaMipFactor = 4 / 3;
  const [width, height] = MATERIAL_QUALITY_CONTRACT.dimensions;
  const bytesPerTexture = width * height * 4 * rgbaMipFactor;
  return Number(((profileCount * channelsPerProfile * variantsPerProfile * bytesPerTexture) / (1024 * 1024)).toFixed(1));
}

export default materialSystem;
