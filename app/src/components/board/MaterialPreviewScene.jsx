import { useEffect, useRef, useState } from 'react';
import { resolveBoardQuality } from './boardQuality';
import { createLightingSystem, disposeLightingSystem, setLightingRig } from './lightingRigs';
import { applySurfaceUvVariation, createSurfaceMaterial, loadSurfaceTextureSet } from './surfaceCatalog';
import { TILE_VARIANTS, createTileGeometry, tileFamilyFor } from './tileKit';

function disposeScene(scene) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  scene.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => {
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

export default function MaterialPreviewScene({ profile, rigId = 'neutral', debugChannel = 'material', qualityMode = 'high' }) {
  const mountRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !profile) return undefined;
    let disposed = false;
    let cleanup = () => {};
    setStatus('loading');

    Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/environments/RoomEnvironment.js'),
      import('three/addons/loaders/KTX2Loader.js'),
    ]).then(([THREE, { OrbitControls }, { RoomEnvironment }, { KTX2Loader }]) => {
      if (disposed || !mountRef.current) return;
      const requestedQuality = resolveBoardQuality({
        mode: qualityMode,
        deviceMemory: 16,
        hardwareConcurrency: 16,
        viewportWidth: mount.clientWidth || 1200,
      });
      const renderer = new THREE.WebGLRenderer({ antialias: qualityMode !== 'efficient', alpha: true, powerPreference: 'high-performance' });
      const quality = { ...requestedQuality, anisotropy: Math.min(requestedQuality.anisotropy, renderer.capabilities.getMaxAnisotropy()) };
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.shadowMap.enabled = quality.shadows;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatioCap));
      renderer.setClearColor(0x050807, 0);
      renderer.domElement.className = 'block h-full w-full cursor-grab';
      renderer.domElement.dataset.materialPreview = 'loading';
      renderer.domElement.dataset.materialId = profile.id;
      mount.replaceChildren(renderer.domElement);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x09100c, 0.018);
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
      camera.position.set(4.8, 3.85, 6.4);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.target.set(0, 0.48, 0);
      controls.minDistance = 4.8;
      controls.maxDistance = 14;
      controls.maxPolarAngle = Math.PI * 0.49;

      const lighting = createLightingSystem(THREE, {
        renderer,
        scene,
        world: { radius: 5.5, width: 7, depth: 5 },
        quality,
        RoomEnvironment,
      });
      setLightingRig(THREE, lighting, rigId, { immediate: true });

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(6.8, 64),
        new THREE.MeshStandardMaterial({ color: '#101611', roughness: 0.96, metalness: 0, envMapIntensity: 0.2 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.04;
      floor.receiveShadow = true;
      scene.add(floor);

      const manager = new THREE.LoadingManager();
      manager.onLoad = () => {
        renderer.domElement.dataset.materialPreview = 'ready';
        setStatus('ready');
        render();
      };
      manager.onError = () => setStatus('error');
      const loader = new THREE.TextureLoader(manager);
      const compressedLoader = quality.compressedTextures
        ? new KTX2Loader(manager).setTranscoderPath('/basis/').detectSupport(renderer)
        : null;
      const surfaceLoader = compressedLoader || loader;
      const topTextures = loadSurfaceTextureSet(THREE, surfaceLoader, profile, quality);
      const sideTextures = loadSurfaceTextureSet(THREE, surfaceLoader, profile, quality, { side: true });
      const surfaceMaterial = createSurfaceMaterial(THREE, profile, topTextures, quality, { debugChannel });
      const sideMaterial = createSurfaceMaterial(THREE, profile, sideTextures, quality, { side: true, debugChannel });

      const sphereGeometry = applySurfaceUvVariation(new THREE.SphereGeometry(0.62, 40, 24), profile, 73);
      const sphere = new THREE.Mesh(sphereGeometry, surfaceMaterial);
      sphere.position.set(-2.45, 0.64, -1.3);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      scene.add(sphere);

      TILE_VARIANTS.forEach((variant, index) => {
        const variantGeometry = applySurfaceUvVariation(createTileGeometry(THREE, variant, tileFamilyFor(profile.tileType)), profile, 137 + index * 47);
        const tile = new THREE.Mesh(variantGeometry, [sideMaterial, surfaceMaterial, sideMaterial]);
        tile.name = `tile-variant:${variant.id}`;
        tile.position.set((index - 1) * 1.64, 0.42, 0.46);
        tile.rotation.y = Math.PI / 6;
        tile.scale.set(0.82, 0.88, 0.82);
        tile.castShadow = true;
        tile.receiveShadow = true;
        scene.add(tile);
      });

      const slabGeometry = applySurfaceUvVariation(new THREE.BoxGeometry(0.86, 1.28, 0.34, 4, 6, 2), profile, 211);
      const slab = new THREE.Mesh(slabGeometry, surfaceMaterial);
      slab.position.set(2.45, 0.66, -1.3);
      slab.rotation.y = -0.34;
      slab.castShadow = true;
      slab.receiveShadow = true;
      scene.add(slab);

      const resize = () => {
        const width = Math.max(1, mount.clientWidth);
        const height = Math.max(1, mount.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(mount);
      resize();

      let frame = 0;
      const render = () => {
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
        renderer.domElement.dataset.drawCalls = String(renderer.info.render.calls);
        renderer.domElement.dataset.textures = String(renderer.info.memory.textures);
        frame = window.requestAnimationFrame(render);
      };
      cleanup = () => {
        window.cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        disposeLightingSystem(lighting);
        disposeScene(scene);
        Object.values(topTextures).forEach((texture) => texture.dispose());
        Object.values(sideTextures).forEach((texture) => texture.dispose());
        compressedLoader?.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    }).catch(() => setStatus('error'));

    return () => {
      disposed = true;
      cleanup();
    };
  }, [debugChannel, profile, qualityMode, rigId]);

  return (
    <div className="relative min-h-[28rem] overflow-hidden rounded-md border border-exp-border bg-[radial-gradient(circle_at_50%_24%,rgba(76,145,219,0.09),transparent_42%),#070b08]" data-testid="material-preview-scene" data-renderer-state={status}>
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5" aria-hidden="true">
        {TILE_VARIANTS.map((variant, index) => <span key={variant.id} className="rounded border border-white/10 bg-exp-dark/75 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-exp-text-dim backdrop-blur-sm">0{index + 1} / {variant.id}</span>)}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-white/10 bg-exp-dark/75 px-2.5 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim backdrop-blur-sm">
        Drag orbit / right-drag pan / scroll zoom
      </div>
      {status !== 'ready' && <p className="absolute inset-0 grid place-items-center font-mono text-[10px] uppercase tracking-[0.18em] text-exp-text-dim">{status === 'error' ? 'Preview unavailable' : 'Preparing material rig'}</p>}
    </div>
  );
}
