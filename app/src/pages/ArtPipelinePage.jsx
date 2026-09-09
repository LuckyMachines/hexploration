import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import direction from '../art-pipeline/art-direction.json';
import manifest from '../art-pipeline/asset-manifest.json';
import characterCatalog from '../characters/character-catalog.json';
import { buildCompositionPlan, buildPrompt, summarizeArtSystem } from '../art-pipeline/promptBuilder';

const statusStyles = {
  approved: 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green',
  'brief-ready': 'border-blueprint/45 bg-blueprint/10 text-blueprint-bright',
  candidate: 'border-compass/45 bg-compass/10 text-compass-bright',
  reference: 'border-relic/45 bg-relic/10 text-relic-bright',
  retired: 'border-exp-border bg-exp-dark/60 text-exp-text-dim',
};

const emotionStyles = {
  discovery: 'border-blueprint/45 bg-blueprint/8 text-blueprint',
  cooperation: 'border-oxide-green/45 bg-oxide-green/8 text-oxide-green',
  agency: 'border-compass/45 bg-compass/8 text-compass-bright',
  trust: 'border-exp-border bg-exp-panel text-exp-text',
  jeopardy: 'border-signal-red/45 bg-signal-red/8 text-signal-red',
  relief: 'border-oxide-green/45 bg-oxide-green/8 text-oxide-green',
  triumph: 'border-compass/45 bg-compass/8 text-compass-bright',
  remembrance: 'border-relic/45 bg-relic/8 text-relic-bright',
};

const workflow = [
  ['01', 'Frame feeling', 'Choose one emotional job and the decision, relationship, or memory it serves.'],
  ['02', 'Choose parts', 'Build with a quiet backplate, meaningful focal, readable route, and localized signal.'],
  ['03', 'Compile brief', 'Merge the stable visual DNA with only the asset-specific requirements.'],
  ['04', 'Generate or capture', 'Generate art parts; capture truthful product proof. Never blend those sources.'],
  ['05', 'Normalize + validate', 'Export exact dimensions, format, real alpha, color space, byte budget, and safe-zone intent.'],
  ['06', 'Compare', 'Review candidates together at full size and thumbnail size.'],
  ['07', 'Score joy', 'Require every quality gate to clear 3/4 and the weighted score to reach 8/10.'],
  ['08', 'Promote', 'Record the review and fingerprint, preserve the old file, then verify in context.'],
];

function Surface({ children, className = '', ...props }) {
  return <section className={`rounded-md border border-exp-border bg-exp-panel/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] ${className}`} {...props}>{children}</section>;
}

function Label({ children }) {
  return <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-exp-text-dim">{children}</p>;
}

function publicAssetUrl(filePath) {
  const prefix = 'app/public';
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : null;
}

function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return <button type="button" onClick={copy} className="min-h-11 rounded border border-blueprint/45 bg-blueprint/10 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-blueprint">{copied ? 'Copied' : label}</button>;
}

function AssetPreview({ asset }) {
  const url = asset.status === 'approved' || asset.status === 'reference' ? publicAssetUrl(asset.output.path) : null;
  if (url) {
    return <img src={url} alt={`${asset.name} ${asset.status} asset`} className="aspect-[16/9] h-full w-full object-cover" loading="eager" />;
  }
  return (
    <div className="relative grid aspect-[16/9] place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(76,145,219,0.18),transparent_26%),linear-gradient(145deg,rgba(185,148,230,0.12),rgba(13,15,10,0.95)_58%)]">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(232,200,96,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(232,200,96,0.12)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative grid h-20 w-20 place-items-center border border-dashed border-blueprint/50 bg-exp-dark/65 [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)]">
        <span className="font-display text-2xl text-blueprint">+</span>
      </div>
      <p className="absolute bottom-3 font-mono text-[9px] uppercase tracking-[0.2em] text-exp-text-dim">Awaiting candidate</p>
    </div>
  );
}

function ArtHero({ summary }) {
  return (
    <Surface className="relative overflow-hidden p-6 sm:p-8 lg:p-10">
      <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_78%_24%,rgba(76,145,219,0.16),transparent_25%),radial-gradient(circle_at_86%_78%,rgba(185,148,230,0.12),transparent_22%)]" />
      <div className="relative grid gap-8 xl:grid-cols-[1fr_24rem] xl:items-end">
        <div>
          <div className="flex flex-wrap gap-2"><span className="rounded border border-compass/45 bg-compass/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-compass-bright">Art direction {direction.version}</span><span className="rounded border border-blueprint/45 bg-blueprint/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-blueprint">Internal production system</span></div>
          <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.3em] text-compass">Xenovoya modular art pipeline</p>
          <h1 className="mt-3 max-w-4xl font-display text-5xl uppercase leading-[0.9] tracking-[0.06em] text-exp-text sm:text-6xl lg:text-7xl">Joy is designed.<br /><span className="text-compass-bright">Parts make it repeatable.</span></h1>
          <p className="mt-6 max-w-3xl font-sans text-base leading-relaxed text-exp-text-dim sm:text-lg">{direction.promise} Every output begins with an emotional job, inherits the same visual DNA, passes a technical contract, and earns promotion through evidence.</p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-exp-border bg-exp-border">
          {[[summary.assets, 'asset contracts'], [summary.compositions, 'compositions'], [summary.statuses.approved, 'approved'], [summary.statuses['brief-ready'], 'ready to make']].map(([value, label]) => <div key={label} className="bg-exp-dark/90 p-4"><p className="font-display text-3xl text-compass-bright">{value}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-exp-text-dim">{label}</p></div>)}
        </div>
      </div>
    </Surface>
  );
}

function Workflow() {
  return (
    <section className="mt-10">
      <Label>Production loop</Label>
      <h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text">One repeatable path from feeling to shipped file</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {workflow.map(([step, title, body]) => <Surface key={step} className="p-4"><p className="font-mono text-[10px] text-compass">{step}</p><h3 className="mt-3 font-display text-xl uppercase tracking-[0.12em] text-exp-text">{title}</h3><p className="mt-2 font-sans text-sm leading-relaxed text-exp-text-dim">{body}</p></Surface>)}
      </div>
    </section>
  );
}

function DirectionModules() {
  return (
    <section className="mt-12 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div>
        <Label>Stable visual DNA</Label>
        <h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text">A recognizable world before any prompt begins</h2>
        <div className="mt-5 space-y-2">{direction.visualDna.map((rule, index) => <Surface key={rule} className="grid grid-cols-[2rem_1fr] gap-3 p-3"><span className="font-mono text-[10px] text-compass">0{index + 1}</span><p className="font-sans text-sm leading-relaxed text-exp-text-dim">{rule}</p></Surface>)}</div>
      </div>
      <div>
        <Label>Signal palette</Label>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {direction.palette.map((swatch) => <Surface key={swatch.id} className="overflow-hidden p-0"><div className="h-12" style={{ background: swatch.hex }} /><div className="p-3"><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-exp-text">{swatch.id}</p><p className="mt-1 font-sans text-xs leading-relaxed text-exp-text-dim">{swatch.job}</p></div></Surface>)}
        </div>
      </div>
    </section>
  );
}

function EmotionLibrary() {
  return (
    <section className="mt-12">
      <Label>Emotional modules</Label>
      <h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text">Joy has a job, a signal, and a payoff</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {direction.emotions.map((emotion) => <Surface key={emotion.id} className={`p-4 ${emotionStyles[emotion.id] || ''}`}><p className="font-display text-xl uppercase tracking-[0.12em]">{emotion.id}</p><p className="mt-2 font-sans text-sm leading-relaxed text-exp-text">{emotion.job}</p><ul className="mt-3 space-y-1 font-mono text-[9px] uppercase tracking-[0.1em] text-exp-text-dim">{emotion.visualSignals.map((signal) => <li key={signal}>+ {signal}</li>)}</ul><p className="mt-3 border-t border-current/20 pt-3 font-sans text-xs leading-relaxed text-exp-text-dim">{emotion.payoff}</p></Surface>)}
      </div>
    </section>
  );
}

function PartSystem() {
  return (
    <section className="mt-12">
      <Label>Composable parts</Label>
      <h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text">Build moments without flattening them</h2>
      <div className="mt-5 grid gap-px overflow-hidden rounded border border-exp-border bg-exp-border sm:grid-cols-2 xl:grid-cols-6">
        {direction.partRoles.map((role) => <div key={role.id} className="bg-exp-panel p-4"><div className="grid h-12 w-12 place-items-center border border-blueprint/35 bg-exp-dark/70 [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)]"><span className="font-mono text-xs uppercase text-blueprint">{role.id.slice(0, 2)}</span></div><p className="mt-4 font-display text-lg uppercase tracking-[0.12em] text-exp-text">{role.id}</p><p className="mt-2 font-sans text-xs leading-relaxed text-exp-text-dim">{role.purpose}</p><p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-compass">{role.alpha ? 'alpha required' : 'opaque base'}</p></div>)}
      </div>
    </section>
  );
}

function CharacterSystem() {
  const roleById = new Map(characterCatalog.roles.map((role) => [role.id, role]));
  const availableStates = characterCatalog.characters.reduce(
    (total, character) => total + 1 + Object.keys(character.assets.states || {}).length,
    0,
  );
  const possibleStates = characterCatalog.characters.length * characterCatalog.requiredStates.length;
  return (
    <section className="mt-12" data-testid="character-system">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><Label>Character system {characterCatalog.version}</Label><h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text">One identity from role choice to aftermath</h2></div>
        <div className="flex gap-2"><span className="rounded border border-oxide-green/40 bg-oxide-green/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-oxide-green">{characterCatalog.characters.length} unique crew</span><span className="rounded border border-blueprint/40 bg-blueprint/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-blueprint">{availableStates}/{possibleStates} authored states</span></div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {characterCatalog.characters.map((character) => {
          const role = roleById.get(character.roleId);
          const authoredStates = new Set(['neutral', ...Object.keys(character.assets.states || {})]);
          return <Surface key={character.id} className="overflow-hidden p-0">
            <div className="relative h-64 border-b border-exp-border bg-[radial-gradient(circle_at_50%_38%,rgba(232,200,96,0.13),transparent_58%),rgba(8,12,9,0.88)]">
              <img src={character.assets.neutral} alt={`${character.name}, ${role.label}`} className="h-full w-full object-contain object-bottom" loading="lazy" />
              <span className="absolute left-3 top-3 rounded border border-compass/40 bg-exp-dark/90 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-compass-bright">{role.label}</span>
            </div>
            <div className="p-4">
              <h3 className="font-display text-xl uppercase tracking-[0.1em] text-exp-text">{character.name}</h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-exp-text-dim">{character.fantasy}</p>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-blueprint">{role.verbs.join(' / ')}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {characterCatalog.requiredStates.map((state) => <span key={state} className={`rounded border px-1.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] ${authoredStates.has(state) ? 'border-oxide-green/35 bg-oxide-green/8 text-oxide-green' : 'border-exp-border bg-exp-dark/50 text-exp-text-dim'}`}>{state}{authoredStates.has(state) ? '' : ' -> neutral'}</span>)}
              </div>
              <div className="mt-4 border-t border-exp-border pt-3"><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-exp-text-dim">Identity anchors</p><ul className="mt-2 space-y-1 font-sans text-xs leading-relaxed text-exp-text-dim">{character.identity.signatureEquipment.map((item) => <li key={item}>+ {item}</li>)}</ul></div>
            </div>
          </Surface>;
        })}
      </div>
      <Surface className="mt-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>Identity gate</Label><p className="mt-2 font-display text-xl text-compass-bright">{characterCatalog.qualityContract.minimumRelationalScore}/4 minimum</p></div>
          <div><Label>Thumbnail proof</Label><p className="mt-2 font-mono text-xs text-exp-text">{characterCatalog.qualityContract.thumbnailSizes.join(' / ')} px</p></div>
          <div><Label>Required contexts</Label><p className="mt-2 font-mono text-xs leading-relaxed text-exp-text">{characterCatalog.qualityContract.requiredContexts.join(' / ')}</p></div>
        </div>
      </Surface>
    </section>
  );
}

function CompositionLab({ selectedId, onSelect }) {
  const plan = buildCompositionPlan(direction, manifest, selectedId);
  const selected = manifest.compositions.find((item) => item.id === selectedId);
  const assetById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><Label>Composition recipes</Label><h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text">Parts become a playable emotional beat</h2></div><select aria-label="Composition recipe" value={selectedId} onChange={(event) => onSelect(event.target.value)} className="min-h-11 rounded border border-exp-border bg-exp-dark px-3 font-mono text-xs uppercase tracking-[0.12em] text-exp-text">{manifest.compositions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Surface className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-display text-2xl uppercase tracking-[0.12em] text-exp-text">{selected.name}</h3><span className={`rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${emotionStyles[selected.emotionalBeat]}`}>{selected.emotionalBeat}</span></div>
          <p className="mt-3 font-sans text-sm leading-relaxed text-exp-text-dim">{selected.rule}</p>
          <div className="mt-5 space-y-2">{selected.slots.map((slot, index) => { const asset = assetById.get(slot.assetId); return <div key={`${slot.role}-${asset.id}`} className="grid grid-cols-[2rem_7rem_1fr_auto] items-center gap-3 rounded border border-exp-border bg-exp-dark/45 p-3"><span className="font-mono text-[10px] text-compass">0{index + 1}</span><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-blueprint">{slot.role}</span><span className="font-sans text-sm text-exp-text">{asset.name}</span><span className={`rounded border px-2 py-1 font-mono text-[8px] uppercase ${statusStyles[asset.status]}`}>{asset.status}</span></div>; })}</div>
        </Surface>
        <Surface className="p-5"><Label>Compiled layer plan</Label><pre className="mt-4 whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-exp-text-dim">{plan}</pre><div className="mt-4"><CopyButton value={plan} label="Copy layer plan" /></div></Surface>
      </div>
    </section>
  );
}

function AssetRegistry({ status, setStatus, selectedId, setSelectedId }) {
  const assets = useMemo(() => status === 'all' ? manifest.assets : manifest.assets.filter((asset) => asset.status === status), [status]);
  const selected = manifest.assets.find((asset) => asset.id === selectedId) || manifest.assets[0];
  const brief = buildPrompt(direction, manifest, selected.id);
  return (
    <section className="mt-12" data-testid="art-pipeline-registry">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><Label>Asset registry</Label><h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text">Every asset has a contract and a reason to exist</h2></div><div className="flex flex-wrap gap-2">{['all', 'approved', 'brief-ready', 'reference', 'candidate', 'retired'].map((item) => <button key={item} type="button" aria-pressed={status === item} onClick={() => setStatus(item)} className={`min-h-11 rounded border px-3 font-mono text-[9px] uppercase tracking-[0.14em] ${status === item ? 'border-compass bg-compass/15 text-compass-bright' : 'border-exp-border bg-exp-dark/60 text-exp-text-dim'}`}>{item}</button>)}</div></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.72fr)] xl:items-start">
        <div className="grid gap-3 md:grid-cols-2">
          {assets.map((asset) => <button type="button" key={asset.id} data-asset-id={asset.id} onClick={() => setSelectedId(asset.id)} aria-pressed={selected.id === asset.id} className={`overflow-hidden rounded border text-left transition ${selected.id === asset.id ? 'border-compass ring-2 ring-compass/20' : 'border-exp-border hover:border-blueprint/45'}`}><AssetPreview asset={asset} /><div className="bg-exp-panel p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-display text-lg uppercase tracking-[0.1em] text-exp-text">{asset.name}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-exp-text-dim">{asset.partRole} / {asset.assetType}</p></div><span className={`rounded border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] ${statusStyles[asset.status]}`}>{asset.status}</span></div><p className="mt-3 font-sans text-xs leading-relaxed text-exp-text-dim">{asset.prompt.primaryRequest}</p></div></button>)}
        </div>
        <Surface className="overflow-hidden xl:sticky xl:top-28" data-testid="compiled-art-brief">
          <div className="border-b border-exp-border p-4"><Label>Compiled source-of-truth brief</Label><h3 className="mt-2 font-display text-2xl uppercase tracking-[0.1em] text-exp-text">{selected.name}</h3><p className="mt-2 break-all font-mono text-[9px] text-blueprint">{selected.output.path}</p></div>
          <pre tabIndex={0} aria-label={`${selected.name} compiled brief`} className="max-h-[38rem] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[10px] leading-relaxed text-exp-text-dim">{brief}</pre>
          <div className="flex flex-wrap gap-2 border-t border-exp-border p-4"><CopyButton value={brief} label="Copy brief" /><CopyButton value={`npm run art:inspect -- ${selected.id} <candidate-path>`} label="Copy inspect command" /></div>
        </Surface>
      </div>
    </section>
  );
}

function JoyGates() {
  return (
    <section className="mt-12 grid gap-5 xl:grid-cols-[1fr_20rem]">
      <div><Label>Evidence gate</Label><h2 className="mt-2 font-display text-3xl uppercase tracking-[0.1em] text-exp-text">Attractive is not the same as joyful</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{direction.qualityGates.map((gate) => <Surface key={gate.id} className="p-4"><div className="flex items-center justify-between gap-3"><p className="font-display text-lg uppercase tracking-[0.12em] text-exp-text">{gate.id}</p><span className="font-mono text-[9px] uppercase text-compass">weight {gate.weight}</span></div><p className="mt-2 font-sans text-sm leading-relaxed text-exp-text-dim">{gate.question}</p></Surface>)}</div></div>
      <Surface className="p-5 xl:mt-12"><Label>Promotion threshold</Label><p className="mt-4 font-display text-6xl text-compass-bright">{direction.minimumJoyScore}<span className="text-2xl text-exp-text-dim">/10</span></p><p className="mt-3 font-sans text-sm leading-relaxed text-exp-text-dim">Every individual gate must also reach {direction.minimumGateScore}/4. One excellent dimension cannot hide a generic silhouette, inaccessible meaning, or unusable crop.</p><div className="mt-5 rounded border border-oxide-green/40 bg-oxide-green/10 p-3 font-mono text-[10px] uppercase tracking-[0.14em] text-oxide-green">Technical pass + human joy pass + in-context proof</div></Surface>
    </section>
  );
}

export default function ArtPipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const summary = summarizeArtSystem(direction, manifest);
  const validAssets = new Set(manifest.assets.map((asset) => asset.id));
  const validCompositions = new Set(manifest.compositions.map((composition) => composition.id));
  const validStatuses = new Set(['all', 'approved', 'brief-ready', 'reference', 'candidate', 'retired']);
  const selectedId = validAssets.has(searchParams.get('asset')) ? searchParams.get('asset') : 'relic-sunstone-lens-focal';
  const status = validStatuses.has(searchParams.get('status')) ? searchParams.get('status') : 'all';
  const composition = validCompositions.has(searchParams.get('composition')) ? searchParams.get('composition') : manifest.compositions[0].id;
  const setParam = (key, value, defaultValue) => {
    const next = new URLSearchParams(searchParams);
    if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="art-pipeline-shell mx-auto min-w-0 max-w-[92rem] overflow-x-clip px-4 py-6 sm:px-6 lg:px-8">
      <ArtHero summary={summary} />
      <nav aria-label="Internal design tools" className="mt-4 flex flex-wrap gap-2"><Link to="/design-system" className="inline-flex min-h-11 items-center rounded border border-exp-border bg-exp-panel px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-exp-text-dim hover:border-blueprint/45 hover:text-blueprint">Design system</Link><Link to="/material-lab" className="inline-flex min-h-11 items-center rounded border border-relic/40 bg-relic/10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-relic-bright">Material lab</Link><Link to="/ui-lab" className="inline-flex min-h-11 items-center rounded border border-exp-border bg-exp-panel px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-exp-text-dim hover:border-blueprint/45 hover:text-blueprint">UI lab</Link><a href="https://github.com/LuckyMachines/hexploration/blob/main/docs/ART_PIPELINE.md" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded border border-blueprint/40 bg-blueprint/10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-blueprint">Production guide</a></nav>
      <Workflow />
      <DirectionModules />
      <EmotionLibrary />
      <PartSystem />
      <CharacterSystem />
      <CompositionLab selectedId={composition} onSelect={(value) => setParam('composition', value, manifest.compositions[0].id)} />
      <AssetRegistry status={status} setStatus={(value) => setParam('status', value, 'all')} selectedId={selectedId} setSelectedId={(value) => setParam('asset', value, 'relic-sunstone-lens-focal')} />
      <JoyGates />
      <Surface className="mt-12 p-5"><Label>Operating principle</Label><p className="mt-3 max-w-5xl font-display text-2xl uppercase leading-relaxed tracking-[0.1em] text-exp-text">Generate the smallest meaningful part. Compose it with truthful game state. Promote only what helps a player notice, choose, care, recover, or remember.</p></Surface>
    </div>
  );
}
