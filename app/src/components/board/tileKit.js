import { Tile } from '../../lib/constants';

export const TILE_KIT_VERSION = '1.1.0';
export const DENSE_BOARD_LANDMARK_CAP = 28;

export const TILE_VARIANTS = Object.freeze([
  Object.freeze({
    id: 'shelf',
    label: 'Survey shelf',
    cornerNoise: 0.006,
    shoulder: 0.932,
    topInset: 0.872,
    baseInset: 0.842,
    ringHeights: Object.freeze([-0.5, -0.34, 0.3, 0.42, 0.5]),
    landmarkYaw: 0,
    landmarkScale: 0.96,
    landmarkDensity: 0.82,
  }),
  Object.freeze({
    id: 'fracture',
    label: 'Fractured shelf',
    cornerNoise: 0.022,
    shoulder: 0.938,
    topInset: 0.858,
    baseInset: 0.824,
    ringHeights: Object.freeze([-0.5, -0.38, 0.16, 0.37, 0.5]),
    landmarkYaw: Math.PI / 3,
    landmarkScale: 1.04,
    landmarkDensity: 1,
  }),
  Object.freeze({
    id: 'crown',
    label: 'Raised crown',
    cornerNoise: 0.014,
    shoulder: 0.924,
    topInset: 0.832,
    baseInset: 0.836,
    ringHeights: Object.freeze([-0.5, -0.4, 0.08, 0.31, 0.5]),
    landmarkYaw: -Math.PI / 3,
    landmarkScale: 1.08,
    landmarkDensity: 1.14,
  }),
]);

const silhouette = (ringRadii, cornerBias, noiseScale = 1) => Object.freeze({
  ringRadii: Object.freeze(ringRadii),
  cornerBias: Object.freeze(cornerBias),
  noiseScale,
});

export const TILE_FAMILIES = Object.freeze({
  [Tile.JUNGLE]: Object.freeze({
    id: 'jungle', materialId: 'glassroot-canopy', silhouette: 'root-broken-crown', landmark: 'glassroot-fronds', sockets: ['encounter', 'route'],
    geometry: silhouette([0.82, 0.88, 0.96, 0.9, 0.84], [0.012, -0.018, 0.024, -0.012, 0.018, -0.024], 1.3),
  }),
  [Tile.PLAINS]: Object.freeze({
    id: 'plains', materialId: 'lantern-moss', silhouette: 'rolling-shelf', landmark: 'lantern-moss', sockets: ['route', 'campsite'],
    geometry: silhouette([0.86, 0.9, 0.95, 0.93, 0.89], [0.004, -0.006, 0.008, -0.004, 0.006, -0.008], 0.55),
  }),
  [Tile.DESERT]: Object.freeze({
    id: 'desert', materialId: 'emberglass-dunes', silhouette: 'wind-cut-shelf', landmark: 'emberglass-shards', sockets: ['hazard', 'route'],
    geometry: silhouette([0.84, 0.91, 0.96, 0.91, 0.87], [0.018, 0.006, -0.018, -0.008, 0.014, -0.012], 1.05),
  }),
  [Tile.MOUNTAIN]: Object.freeze({
    id: 'mountain', materialId: 'slate-spires', silhouette: 'fractured-crown', landmark: 'slate-spires', sockets: ['hazard', 'pass'],
    geometry: silhouette([0.76, 0.83, 0.96, 0.88, 0.8], [0.026, -0.02, 0.012, -0.028, 0.02, -0.01], 1.45),
  }),
  [Tile.LANDING]: Object.freeze({
    id: 'landing', materialId: 'verdant-signal-base', silhouette: 'engineered-platform', landmark: 'landing-beacon', sockets: ['origin', 'campsite'],
    geometry: silhouette([0.86, 0.9, 0.94, 0.92, 0.9], [0, 0, 0, 0, 0, 0], 0.12),
  }),
  [Tile.RELIC]: Object.freeze({
    id: 'relic', materialId: 'violet-reliquary', silhouette: 'ceremonial-crown', landmark: 'violet-reliquary', sockets: ['relic', 'discovery'],
    geometry: silhouette([0.79, 0.9, 0.96, 0.86, 0.81], [0.008, -0.006, 0.008, -0.006, 0.008, -0.006], 0.7),
  }),
});

function mixedSeed(seed, tileType) {
  let value = (Number(seed) || 1) ^ Math.imul(Number(tileType) || 0, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function tileVariantIndex(tileType, seed) {
  if (!TILE_FAMILIES[Number(tileType)]) return 0;
  return mixedSeed(seed, tileType) % TILE_VARIANTS.length;
}

export function tileVariantFor(tileType, seed) {
  return TILE_VARIANTS[tileVariantIndex(tileType, seed)];
}

export function tileFamilyFor(tileType) {
  return TILE_FAMILIES[Number(tileType)] || null;
}

export function tileBatchId(tileType, seed, revealed = true) {
  if (!revealed || !tileFamilyFor(tileType)) return 'tile-fog';
  return `tile-${tileType}-${tileVariantFor(tileType, seed).id}`;
}

export function tileLandmarkRecipe(tileType, seed) {
  const family = tileFamilyFor(tileType);
  const variant = tileVariantFor(tileType, seed);
  if (!family) return null;
  const mixed = mixedSeed(seed, tileType);
  return Object.freeze({
    familyId: family.id,
    variantId: variant.id,
    landmark: family.landmark,
    sockets: family.sockets,
    yaw: variant.landmarkYaw + ((mixed >>> 7) % 3 - 1) * (Math.PI / 18),
    scale: variant.landmarkScale * (0.96 + ((mixed >>> 11) % 9) * 0.01),
    density: variant.landmarkDensity,
    offsetX: (((mixed >>> 15) & 15) / 15 - 0.5) * 0.16,
    offsetZ: (((mixed >>> 19) & 15) / 15 - 0.5) * 0.12,
  });
}

function radiusAtCorner(variant, familyGeometry, corner, ringIndex) {
  const direction = corner % 2 === 0 ? 1 : -1;
  const rotatedDirection = (corner + ringIndex) % 3 === 0 ? -1 : direction;
  const ringNoise = ringIndex === 1 || ringIndex === 2 ? 1 : 0.42;
  const authoredBias = familyGeometry?.cornerBias?.[corner] || 0;
  return authoredBias * ringNoise + rotatedDirection * variant.cornerNoise * ringNoise * (familyGeometry?.noiseScale || 1);
}

function pushTriangle(positions, uvs, a, b, c, uvA, uvB, uvC) {
  positions.push(...a, ...b, ...c);
  uvs.push(...uvA, ...uvB, ...uvC);
}

/**
 * Creates one normalized sculpted hex prism. It is cached by the caller and
 * rendered through InstancedMesh, so all visual variants retain one raycastable
 * object per batch and no transient state ever changes the geometry.
 */
export function createTileGeometry(THREE, variantInput = TILE_VARIANTS[0], familyInput = null) {
  const variant = typeof variantInput === 'string'
    ? TILE_VARIANTS.find((entry) => entry.id === variantInput) || TILE_VARIANTS[0]
    : variantInput;
  const family = typeof familyInput === 'number' ? tileFamilyFor(familyInput) : familyInput;
  const familyGeometry = family?.geometry;
  const defaultRadii = [variant.baseInset, 0.882, variant.shoulder, (variant.shoulder + variant.topInset) / 2, variant.topInset];
  const authoredRadii = familyGeometry?.ringRadii || defaultRadii;
  const variantDeltas = [
    variant.baseInset - TILE_VARIANTS[0].baseInset,
    (variant.shoulder - TILE_VARIANTS[0].shoulder) * 0.45,
    variant.shoulder - TILE_VARIANTS[0].shoulder,
    ((variant.shoulder + variant.topInset) - (TILE_VARIANTS[0].shoulder + TILE_VARIANTS[0].topInset)) / 2,
    variant.topInset - TILE_VARIANTS[0].topInset,
  ];
  const ringHeights = variant.ringHeights || TILE_VARIANTS[0].ringHeights;
  const rings = ringHeights.map((y, index) => ({ y, radius: authoredRadii[index] + variantDeltas[index] }));
  const points = rings.map((ring, ringIndex) => Array.from({ length: 6 }, (_, corner) => {
    const angle = Math.PI / 6 + corner * Math.PI / 3;
    const radius = ring.radius + radiusAtCorner(variant, familyGeometry, corner, ringIndex);
    return [Math.cos(angle) * radius, ring.y, Math.sin(angle) * radius];
  }));
  const positions = [];
  const uvs = [];

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    for (let corner = 0; corner < 6; corner += 1) {
      const next = (corner + 1) % 6;
      const y0 = ringIndex / (rings.length - 1);
      const y1 = (ringIndex + 1) / (rings.length - 1);
      const x0 = corner / 6;
      const x1 = (corner + 1) / 6;
      pushTriangle(positions, uvs, points[ringIndex][corner], points[ringIndex + 1][next], points[ringIndex][next], [x0, y0], [x1, y1], [x1, y0]);
      pushTriangle(positions, uvs, points[ringIndex][corner], points[ringIndex + 1][corner], points[ringIndex + 1][next], [x0, y0], [x0, y1], [x1, y1]);
    }
  }
  const uvForTop = ([x, , z]) => [0.5 + x / 1.9, 0.5 + z / 1.9];
  const bottomRing = points[0];
  for (let corner = 0; corner < 6; corner += 1) {
    const next = (corner + 1) % 6;
    pushTriangle(positions, uvs, [0, -0.5, 0], bottomRing[corner], bottomRing[next], [0.5, 0.5], uvForTop(bottomRing[corner]), uvForTop(bottomRing[next]));
  }
  const sideAndBottomCount = positions.length / 3;

  const topRing = points.at(-1);
  const topStart = positions.length / 3;
  for (let corner = 0; corner < 6; corner += 1) {
    const next = (corner + 1) % 6;
    pushTriangle(positions, uvs, [0, 0.5, 0], topRing[next], topRing[corner], [0.5, 0.5], uvForTop(topRing[next]), uvForTop(topRing[corner]));
  }
  const topCount = positions.length / 3 - topStart;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const normals = [];
  const sideVertexCount = (rings.length - 1) * 6 * 6;
  const pointAt = (index) => new THREE.Vector3(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]);
  for (let index = 0; index < sideVertexCount; index += 6) {
    const normalA = new THREE.Vector3().crossVectors(
      pointAt(index + 1).sub(pointAt(index)),
      pointAt(index + 2).sub(pointAt(index)),
    );
    const normalB = new THREE.Vector3().crossVectors(
      pointAt(index + 4).sub(pointAt(index + 3)),
      pointAt(index + 5).sub(pointAt(index + 3)),
    );
    const quadNormal = normalA.add(normalB).normalize();
    for (let vertex = 0; vertex < 6; vertex += 1) normals.push(quadNormal.x, quadNormal.y, quadNormal.z);
  }
  const bottomVertexCount = sideAndBottomCount - sideVertexCount;
  for (let index = 0; index < bottomVertexCount; index += 1) normals.push(0, -1, 0);
  for (let index = 0; index < topCount; index += 1) normals.push(0, 1, 0);
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.clearGroups();
  geometry.addGroup(0, sideAndBottomCount, 0);
  geometry.addGroup(topStart, topCount, 1);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.tileKitVersion = TILE_KIT_VERSION;
  geometry.userData.variantId = variant.id;
  geometry.userData.familyId = family?.id || 'generic';
  return geometry;
}

export const TILE_STATE_LAYERS = Object.freeze({
  hidden: Object.freeze({ channel: 'fog-material', mutatesBaseTransform: false }),
  reachable: Object.freeze({ channel: 'cyan-inset-halo', mutatesBaseTransform: false }),
  hover: Object.freeze({ channel: 'intent-ring', mutatesBaseTransform: false }),
  selected: Object.freeze({ channel: 'gold-route-ring', mutatesBaseTransform: false }),
  dangerous: Object.freeze({ channel: 'red-ring-and-lighting', mutatesBaseTransform: false }),
  visited: Object.freeze({ channel: 'party-and-route-history', mutatesBaseTransform: false }),
});

export default TILE_FAMILIES;
