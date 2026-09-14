import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import materialSystem from '../art-pipeline/material-system.json';
import MaterialPreviewScene from '../components/board/MaterialPreviewScene';
import { LIGHTING_RIG_IDS, LIGHTING_RIGS } from '../components/board/lightingRigs';
import { MATERIAL_CHANNELS, materialAssetPath, surfaceProfileById } from '../components/board/surfaceCatalog';
import { TILE_VARIANTS, tileFamilyFor } from '../components/board/tileKit';

const DEBUG_CHANNELS = ['material', 'albedo', 'normal', 'roughness', 'ao', 'height', 'emissive'];
const QUALITY_MODES = ['high', 'balanced', 'efficient'];

function ChoiceGroup({ label, values, value, onChange, labelFor = (item) => item }) {
  return (
    <fieldset>
      <legend className="font-mono text-[9px] uppercase tracking-[0.2em] text-exp-text-dim">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((item) => <button key={item} type="button" aria-pressed={item === value} onClick={() => onChange(item)} className={`min-h-11 rounded border px-3 font-mono text-[9px] uppercase tracking-[0.14em] ${item === value ? 'border-compass bg-compass/15 text-compass-bright' : 'border-exp-border bg-exp-dark/70 text-exp-text-dim hover:border-blueprint/45 hover:text-exp-text'}`}>{labelFor(item)}</button>)}
      </div>
    </fieldset>
  );
}

export default function MaterialLabPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const materialId = surfaceProfileById(searchParams.get('material'))?.id || materialSystem.materials[0].id;
  const rigId = LIGHTING_RIG_IDS.includes(searchParams.get('rig')) ? searchParams.get('rig') : 'neutral';
  const debugChannel = DEBUG_CHANNELS.includes(searchParams.get('debug')) ? searchParams.get('debug') : 'material';
  const qualityMode = QUALITY_MODES.includes(searchParams.get('quality')) ? searchParams.get('quality') : 'high';
  const profile = useMemo(() => surfaceProfileById(materialId), [materialId]);
  const tileFamily = tileFamilyFor(profile.tileType);
  const setParam = (key, value, fallback) => {
    const next = new URLSearchParams(searchParams);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8" data-testid="material-lab">
      <section className="overflow-hidden rounded-md border border-exp-border bg-exp-panel/85 p-6 sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-compass">Look-development laboratory / {materialSystem.version}</p>
            <h1 className="mt-3 font-display text-4xl uppercase leading-none tracking-[0.08em] text-exp-text sm:text-6xl">Light reveals.<br /><span className="text-blueprint-bright">Materials remember.</span></h1>
            <p className="mt-5 max-w-3xl font-sans text-base leading-relaxed text-exp-text-dim">Inspect every surface under the same geometry, camera, semantic lighting, and channel views before it reaches the expedition board.</p>
          </div>
          <nav aria-label="Internal design tools" className="flex flex-wrap gap-2"><Link to="/design-system" className="inline-flex min-h-11 items-center rounded border border-exp-border bg-exp-dark/70 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">Design system</Link><Link to="/art-lab" className="inline-flex min-h-11 items-center rounded border border-exp-border bg-exp-dark/70 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">Art pipeline</Link></nav>
        </div>
      </section>

      <section className="mt-4 rounded-md border border-exp-border bg-exp-panel/85 p-4" data-testid="material-lab-controls">
        <div className="grid gap-5 xl:grid-cols-3">
          <ChoiceGroup label="Lighting rig" values={LIGHTING_RIG_IDS} value={rigId} onChange={(value) => setParam('rig', value, 'neutral')} labelFor={(value) => LIGHTING_RIGS[value].label} />
          <ChoiceGroup label="Channel view" values={DEBUG_CHANNELS} value={debugChannel} onChange={(value) => setParam('debug', value, 'material')} />
          <ChoiceGroup label="Quality tier" values={QUALITY_MODES} value={qualityMode} onChange={(value) => setParam('quality', value, 'high')} />
        </div>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <MaterialPreviewScene profile={profile} rigId={rigId} debugChannel={debugChannel} qualityMode={qualityMode} />
        <aside className="rounded-md border border-exp-border bg-exp-panel/85 p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-exp-text-dim">Selected surface</p>
          <h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text">{profile.label}</h2>
          <div className="mt-4 space-y-2">{profile.story.map((item, index) => <p key={item} className="rounded border border-exp-border bg-exp-dark/55 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-exp-text-dim">0{index + 1} / {item}</p>)}</div>
          <dl className="mt-5 grid grid-cols-2 gap-2 font-mono text-[10px]">
            {[['Roughness', profile.roughness], ['Metalness', profile.metalness], ['Normal', profile.normalScale], ['AO', profile.aoIntensity]].map(([label, value]) => <div key={label} className="rounded border border-exp-border bg-exp-dark/45 p-3"><dt className="uppercase tracking-[0.14em] text-exp-text-dim">{label}</dt><dd className="mt-1 text-compass-bright">{value}</dd></div>)}
          </dl>
        </aside>
      </section>

      <section className="mt-4 grid gap-4 overflow-hidden rounded-md border border-exp-border bg-exp-panel/85 p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]" data-testid="tile-kit-reference">
        <figure className="overflow-hidden rounded border border-exp-border bg-exp-dark">
          <img src={`/images/art/tile-concepts/${tileFamily.id}-variants.webp`} alt={`${profile.label} tile concept plate showing shelf, fracture, and crown variants`} className="aspect-square w-full object-cover" />
          <figcaption className="border-t border-exp-border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">GPT Image 2 direction plate / reference only / runtime geometry above</figcaption>
        </figure>
        <div className="self-center p-2 sm:p-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-compass">Tile kit / 1.1.0</p>
          <h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text">One family.<br />Three stable forms.</h2>
          <p className="mt-4 max-w-xl font-sans text-sm leading-relaxed text-exp-text-dim">The reference sets silhouette and material ambition. The live Three.js forms keep the footprint, picking, routes, and performance deterministic.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {TILE_VARIANTS.map((variant, index) => <div key={variant.id} className="rounded border border-exp-border bg-exp-dark/55 p-3"><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-compass">0{index + 1}</p><h3 className="mt-1 font-display text-lg uppercase tracking-[0.1em] text-exp-text">{variant.id}</h3><p className="mt-1 font-sans text-xs leading-relaxed text-exp-text-dim">{variant.label}</p></div>)}
          </div>
          <ul className="mt-5 space-y-2 font-mono text-[9px] uppercase tracking-[0.1em] text-exp-text-dim">
            <li>Stable base matrix in every interaction state</li>
            <li>Separate PBR top and sculpted sidewall response</li>
            <li>Deterministic landmark, hazard, route, and relic sockets</li>
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-exp-text-dim">Surface family</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {materialSystem.materials.map((material) => <button type="button" key={material.id} onClick={() => setParam('material', material.id, materialSystem.materials[0].id)} aria-pressed={material.id === profile.id} className={`overflow-hidden rounded border text-left ${material.id === profile.id ? 'border-compass ring-2 ring-compass/20' : 'border-exp-border'}`}><img src={materialAssetPath(material, 'baseColor')} alt={`${material.label} base color`} className="aspect-square w-full object-cover" /><span className="block bg-exp-panel px-3 py-3 font-display text-sm uppercase tracking-[0.1em] text-exp-text">{material.label}</span></button>)}
        </div>
      </section>

      <section className="mt-8">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-exp-text-dim">Channel proof / {profile.label}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {MATERIAL_CHANNELS.map((channel) => <figure key={channel} className="overflow-hidden rounded border border-exp-border bg-exp-panel"><img src={materialAssetPath(profile, channel)} alt={`${profile.label} ${channel} map`} className="aspect-square w-full object-cover" /><figcaption className="px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">{channel} / {materialSystem.channels[channel].colorSpace}</figcaption></figure>)}
        </div>
      </section>

      <section className="mt-8 rounded-md border border-exp-border bg-exp-panel/85 p-5">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-exp-text-dim">Promotion contract</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ['Technical', 'Dimensions, compression, color space, seams, clipping, hashes'],
            ['Relational', 'Identity under neutral, danger, grayscale, and thumbnail views'],
            ['Integration', 'Default, quarter-turn, and close board camera evidence'],
            ['Performance', 'Draw calls, textures, memory, and p95 frame time stay inside budget'],
          ].map(([title, body]) => <div key={title} className="rounded border border-exp-border bg-exp-dark/50 p-4"><h3 className="font-display text-lg uppercase tracking-[0.12em] text-exp-text">{title}</h3><p className="mt-2 font-sans text-sm leading-relaxed text-exp-text-dim">{body}</p></div>)}
        </div>
      </section>
    </div>
  );
}
