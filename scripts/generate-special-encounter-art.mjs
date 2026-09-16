#!/usr/bin/env node

import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helper = path.join(process.env.USERPROFILE || '', '.codex', 'azure-image-edit.sh');
const outDir = path.join(repoRoot, 'artifacts/art/special-encounters');
const only = process.argv[2] || '';
const slash = (value) => value.replaceAll('\\', '/');
const file = (value) => path.join(repoRoot, value);

const jobs = [
  {
    id: 'landing-skiff', size: '1024x1024',
    inputs: ['app/public/images/art/props/landing-beacon.png', 'app/public/images/art/props/survey-sled.png'],
    prompt: 'Use case: stylized-concept. Asset type: transparent 2.5D board prop. Create one compact Xenovoya expedition landing skiff, a rugged four-person VTOL field craft built from rain-dark graphite panels, weathered brass joints, short folded stabilizer fins, a low front ramp, and restrained cyan landing lights. Match the tactile hand-painted graphic-novel rendering and practical equipment language of the input references. Three-quarter elevated view, complete silhouette, landing feet visible, generous margin. Perfectly uniform pure white background. No crew, weapons, text, insignia, logo, watermark, scenery, floor, horizon, exhaust cloud, or cast shadow. One connected vehicle only.',
  },
  {
    id: 'landing-pad-tile', size: '1024x1024',
    inputs: ['app/public/images/art/tile-concepts/landing-variants.webp', 'app/public/images/art/terrain/verdant-signal-base-v2.webp'],
    prompt: 'Use case: stylized-concept. Asset type: special isometric board tile cutout. Create one complete hexagonal Xenovoya landing-pad tile in the same camera pitch and chunky miniature geometry as the tile reference. Rain-dark basalt rim, inset graphite landing plates, a broad empty central skiff footprint, three restrained cyan guide lights, one narrow gold route notch, readable beveled side walls. The tile alone on a perfectly uniform pure white background, generous margin, no ship, character, beacon, labels, letters, numbers, interface, logo, watermark, scenery, floor, horizon, or detached pieces.',
  },
  {
    id: 'boss-emberglass-razorback-scene', size: '1536x1024',
    inputs: ['app/public/images/art/encounters/emberglass-razorback.png', 'app/public/images/art/environments/emberglass-crossing.webp'],
    prompt: 'Use case: stylized-concept. Asset type: cinematic boss reveal backplate. Preserve the exact Emberglass Razorback creature identity from the first input and place it at colossal but believable field scale in the Emberglass environment from the second input. The creature has just burst through a fractured hex arena, orange glass spines throwing restrained light across dark basalt while a clear escape route remains visible. Wide low three-quarter composition, creature dominant but fully visible, quiet lower edge for UI. No people, text, logo, watermark, interface, duplicate creature, fireball spectacle, or generic lava monster redesign.',
  },
  {
    id: 'boss-emberglass-razorback-tile', size: '1024x1024',
    inputs: ['app/public/images/art/tile-concepts/desert-variants.webp', 'app/public/images/art/encounters/emberglass-razorback.png'],
    prompt: 'Use case: stylized-concept. Asset type: special isometric boss board tile cutout. Create one complete hexagonal Emberglass boss arena tile matching the reference tile camera and chunky miniature geometry. Dark basalt side walls, a broad empty central combat socket, three radial orange-glass fracture ridges shaped by the Razorback, and one intact gold retreat notch. Tile only on perfectly uniform pure white, generous margin. No creature, characters, text, symbols, interface, logo, watermark, scenery, floor, horizon, or detached debris.',
  },
  {
    id: 'boss-stormneedle-strider-scene', size: '1536x1024',
    inputs: ['app/public/images/art/encounters/stormneedle-strider.png', 'app/public/images/art/environments/stormneedle-pass.webp'],
    prompt: 'Use case: stylized-concept. Asset type: cinematic boss reveal backplate. Preserve the exact Stormneedle Strider creature identity from the first input and place it at imposing field scale in the storm pass from the second. Its long grounded legs bridge a shattered route while lightning illuminates slate needles and a survivable sheltered path remains readable. Wide low three-quarter composition, one creature fully visible, strong scale and depth, quiet lower edge for UI. No people, hovering architecture, extra legs, duplicate creature, text, logo, watermark, interface, or generic robot redesign.',
  },
  {
    id: 'boss-stormneedle-strider-tile', size: '1024x1024',
    inputs: ['app/public/images/art/tile-concepts/mountain-variants.webp', 'app/public/images/art/encounters/stormneedle-strider.png'],
    prompt: 'Use case: stylized-concept. Asset type: special isometric boss board tile cutout. Create one complete hexagonal Stormneedle boss arena tile matching the reference camera and chunky miniature geometry. Layered slate side walls, broad empty central combat socket, four tall perimeter needle spires, thin cyan storm channels, and one sheltered route notch. Tile only on perfectly uniform pure white, generous margin. No creature, characters, text, symbols, interface, logo, watermark, scenery, floor, horizon, floating rocks, or detached debris.',
  },
  {
    id: 'boss-violet-warden-scene', size: '1536x1024',
    inputs: ['app/public/images/art/encounters/violet-reliquary-warden.png', 'app/public/images/art/environments/violet-archive-hollow.webp'],
    prompt: 'Use case: stylized-concept. Asset type: cinematic boss reveal backplate. Preserve the exact non-humanoid Violet Reliquary Warden identity from the first input and place it at imposing guardian scale in the archive from the second. The stone-and-violet construct unfolds around a sealed relic dais while one narrow negotiated route remains visible. Wide low three-quarter composition, one creature fully visible, quiet lower edge for UI, restrained violet light. No humanoid face or body, no extra creature, people, text, logo, watermark, interface, portal, throne, or generic fantasy golem redesign.',
  },
  {
    id: 'boss-violet-warden-tile', size: '1024x1024',
    inputs: ['app/public/images/art/tile-concepts/relic-variants.webp', 'app/public/images/art/encounters/violet-reliquary-warden.png'],
    prompt: 'Use case: stylized-concept. Asset type: special isometric boss board tile cutout. Create one complete hexagonal Violet Reliquary boss arena tile matching the reference camera and chunky miniature geometry. Layered dark basalt side walls, broad empty central guardian socket, five asymmetric violet crystal buttresses, a thin cyan negotiation route, and one muted gold seal. Tile only on perfectly uniform pure white, generous margin. No creature, humanoid, text, symbols, interface, logo, watermark, scenery, floor, horizon, portal, or detached debris.',
  },
];

if (!existsSync(helper)) throw new Error(`Missing Azure image helper: ${helper}`);
mkdirSync(outDir, { recursive: true });
for (const job of jobs) {
  if (only && only !== job.id) continue;
  const output = path.join(outDir, `${job.id}.png`);
  if (existsSync(output)) {
    console.log(`SKIP ${path.relative(repoRoot, output)} already exists`);
    continue;
  }
  const inputs = job.inputs.map(file);
  for (const input of inputs) if (!existsSync(input)) throw new Error(`Missing input: ${input}`);
  console.log(`GENERATE ${job.id}`);
  const result = spawnSync('bash', [slash(helper), job.prompt, slash(output), job.size, ...inputs.map(slash)], {
    cwd: repoRoot, encoding: 'utf8', stdio: 'inherit', windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
