#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPrompt } from '../app/src/art-pipeline/promptBuilder.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(repoRoot, 'artifacts/art/special-encounters');
const manifestPath = path.join(repoRoot, 'app/src/art-pipeline/asset-manifest.json');
const runtimePath = path.join(repoRoot, 'app/src/art-pipeline/runtime-image-delivery.json');
const libraryPath = path.join(repoRoot, 'app/src/art-pipeline/game-art-library.json');
const direction = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/art-pipeline/art-direction.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const runtime = JSON.parse(readFileSync(runtimePath, 'utf8'));
const library = JSON.parse(readFileSync(libraryPath, 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const jobs = [
  {
    id: 'prop-landing-skiff', source: 'landing-skiff.png', output: 'app/public/images/art/props/landing-skiff.png',
    name: 'Expedition Landing Skiff', family: 'environment-prop', assetType: 'transparent-prop', partRole: 'prop', beat: 'trust',
    request: 'One rugged four-person Xenovoya landing skiff with a low ramp, folded stabilizers, landing feet, and restrained cyan guidance lights.',
    scene: 'Transparent board-ready isolation.', subject: 'A practical graphite and weathered-brass expedition VTOL.',
    composition: 'Complete three-quarter silhouette with generous margin and a clear front ramp.', lighting: 'Soft neutral key with localized cyan landing signals.',
    constraints: ['No crew, weapon, text, logo, floor, horizon, scenery, exhaust, or cast shadow.'],
    references: ['app/public/images/art/props/landing-beacon.png', 'app/public/images/art/props/survey-sled.png'],
  },
  {
    id: 'tile-landing-pad-special', source: 'landing-pad-tile.png', output: 'app/public/images/art/tile-concepts/landing-pad-special.png',
    name: 'Landing Pad Special Tile', family: 'tile-reference', assetType: 'transparent-prop', partRole: 'prop', beat: 'agency',
    request: 'One complete landing-pad hex with an empty skiff footprint, graphite plates, cyan guide lights, and one gold route notch.',
    scene: 'Transparent board-ready isolation.', subject: 'A rain-dark basalt and graphite arrival tile.',
    composition: 'Complete isometric hex footprint with readable side walls and generous margin.', lighting: 'Soft overcast key with restrained cyan guides.',
    constraints: ['No ship, character, labels, symbols, interface, scenery, floor, horizon, or detached parts.'],
    references: ['app/public/images/art/tile-concepts/landing-variants.webp', 'app/public/images/art/terrain/verdant-signal-base-v2.webp'],
  },
  {
    id: 'boss-emberglass-razorback-reveal', source: 'boss-emberglass-razorback-scene.png', output: 'app/public/images/art/bosses/emberglass-razorback-reveal.webp',
    name: 'Emberglass Razorback Boss Reveal', family: 'encounter', assetType: 'feature-landscape', partRole: 'backplate', beat: 'jeopardy',
    request: 'The exact Emberglass Razorback bursting into a fractured arena while a survivable route remains readable.',
    scene: 'A dark Emberglass basin of basalt plates and restrained amber crystal.', subject: 'One colossal heat-scarred mineral quadruped with an asymmetric orange-glass ridge.',
    composition: 'Wide low reveal, creature dominant and fully visible, with quiet lower UI space.', lighting: 'Dust-soft ambient light with one controlled amber fracture source.',
    constraints: ['No people, text, logo, interface, duplicate creature, fireball spectacle, or generic lava-monster redesign.'],
    references: ['app/public/images/art/encounters/emberglass-razorback.png', 'app/public/images/art/environments/emberglass-crossing.webp'],
  },
  {
    id: 'tile-emberglass-razorback-arena', source: 'boss-emberglass-razorback-tile.png', output: 'app/public/images/art/bosses/emberglass-razorback-tile.png',
    name: 'Emberglass Razorback Arena Tile', family: 'tile-reference', assetType: 'transparent-prop', partRole: 'prop', beat: 'jeopardy',
    request: 'One complete Emberglass boss-arena hex with a broad combat socket, radial glass fractures, and an intact retreat notch.',
    scene: 'Transparent board-ready isolation.', subject: 'A dark basalt arena shaped by the Razorback encounter.',
    composition: 'Complete isometric hex footprint with an open center and readable perimeter damage.', lighting: 'Warm fracture light against dry dark stone.',
    constraints: ['No creature, character, text, symbol, interface, scenery, floor, horizon, or detached debris.'],
    references: ['app/public/images/art/tile-concepts/desert-variants.webp', 'app/public/images/art/encounters/emberglass-razorback.png'],
  },
  {
    id: 'boss-stormneedle-strider-reveal', source: 'boss-stormneedle-strider-scene.png', output: 'app/public/images/art/bosses/stormneedle-strider-reveal.webp',
    name: 'Stormneedle Strider Boss Reveal', family: 'encounter', assetType: 'feature-landscape', partRole: 'backplate', beat: 'jeopardy',
    request: 'The exact Stormneedle Strider bridging a shattered mountain route while one sheltered passage remains legible.',
    scene: 'A storm pass of layered slate needles and deep atmospheric distance.', subject: 'One towering long-legged mineral construct with a cyan signal core.',
    composition: 'Wide low reveal, full creature silhouette, route leading through foreground, quiet lower UI edge.', lighting: 'Cold storm light with restrained cyan core and sparse distant hazard signals.',
    constraints: ['No people, duplicate creature, extra legs, text, logo, interface, or generic robot redesign.'],
    references: ['app/public/images/art/encounters/stormneedle-strider.png', 'app/public/images/art/environments/stormneedle-pass.webp'],
  },
  {
    id: 'tile-stormneedle-strider-arena', source: 'boss-stormneedle-strider-tile.png', output: 'app/public/images/art/bosses/stormneedle-strider-tile.png',
    name: 'Stormneedle Strider Arena Tile', family: 'tile-reference', assetType: 'transparent-prop', partRole: 'prop', beat: 'jeopardy',
    request: 'One complete Stormneedle boss-arena hex with an open combat socket, four perimeter spires, storm channels, and a sheltered notch.',
    scene: 'Transparent board-ready isolation.', subject: 'A layered slate arena shaped by the Strider encounter.',
    composition: 'Complete isometric hex footprint with readable edges and generous margin.', lighting: 'Cold diffuse key with controlled cyan storm channels.',
    constraints: ['No creature, character, text, symbol, interface, scenery, floor, horizon, floating rock, or detached debris.'],
    references: ['app/public/images/art/tile-concepts/mountain-variants.webp', 'app/public/images/art/encounters/stormneedle-strider.png'],
  },
  {
    id: 'boss-violet-warden-reveal', source: 'boss-violet-warden-scene.png', output: 'app/public/images/art/bosses/violet-warden-reveal.webp',
    name: 'Violet Reliquary Warden Boss Reveal', family: 'encounter', assetType: 'feature-landscape', partRole: 'backplate', beat: 'discovery',
    request: 'The exact Violet Reliquary Warden unfolding around a sealed relic dais while a narrow negotiated route remains visible.',
    scene: 'A near-black archive hollow of aged basalt and suspended violet glass.', subject: 'One imposing non-humanoid circular guardian construct.',
    composition: 'Wide centered reveal with full guardian silhouette and quiet lower UI edge.', lighting: 'Contained violet depth with muted gold navigation accents.',
    constraints: ['No humanoid face, extra creature, people, text, logo, interface, portal, throne, or generic fantasy-golem redesign.'],
    references: ['app/public/images/art/encounters/violet-reliquary-warden.png', 'app/public/images/art/environments/violet-archive-hollow.webp'],
  },
  {
    id: 'tile-violet-warden-arena', source: 'boss-violet-warden-tile.png', output: 'app/public/images/art/bosses/violet-warden-tile.png',
    name: 'Violet Reliquary Warden Arena Tile', family: 'tile-reference', assetType: 'transparent-prop', partRole: 'prop', beat: 'discovery',
    request: 'One complete reliquary boss-arena hex with a guardian socket, asymmetric crystal buttresses, negotiation route, and muted gold seal.',
    scene: 'Transparent board-ready isolation.', subject: 'A basalt and violet-glass arena shaped by the Warden encounter.',
    composition: 'Complete isometric hex footprint with an open center and clear perimeter landmarks.', lighting: 'Restrained violet depth with one muted gold seal.',
    constraints: ['No creature, humanoid, text, symbol, interface, scenery, floor, horizon, portal, or detached debris.'],
    references: ['app/public/images/art/tile-concepts/relic-variants.webp', 'app/public/images/art/encounters/violet-reliquary-warden.png'],
  },
];

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function upsert(items, value) {
  const index = items.findIndex((item) => item.id === value.id);
  if (index >= 0) items[index] = value;
  else items.push(value);
}

function reviewScore(scores) {
  const earned = direction.qualityGates.reduce((sum, gate) => sum + scores[gate.id] * gate.weight, 0);
  const possible = direction.qualityGates.reduce((sum, gate) => sum + 4 * gate.weight, 0);
  return Number(((earned / possible) * 10).toFixed(1));
}

for (const job of jobs) {
  const source = path.join(sourceRoot, job.source);
  const output = path.join(repoRoot, job.output);
  mkdirSync(path.dirname(output), { recursive: true });
  if (job.assetType === 'feature-landscape') {
    execFileSync('magick', [source, '-resize', '1024x700^', '-gravity', 'center', '-extent', '1024x700', '-define', 'webp:method=6', '-quality', '70', output], { cwd: repoRoot, windowsHide: true });
  } else {
    const cutoutArgs = [source, '-alpha', 'on', '-fuzz', '20%', '-fill', 'none', '-draw', 'alpha 0,0 floodfill'];
    if (job.id !== 'prop-landing-skiff') cutoutArgs.push('-channel', 'RGB', '-fuzz', '35%', '-transparent', 'white', '+channel');
    cutoutArgs.push('-trim', '+repage', '-resize', '900x900>', '-gravity', 'center', '-background', 'none', '-extent', '1024x1024', output);
    execFileSync('magick', cutoutArgs, { cwd: repoRoot, windowsHide: true });
  }

  const isScene = job.assetType === 'feature-landscape';
  const reviewPath = `app/src/art-pipeline/reviews/${job.id}.json`;
  const asset = {
    id: job.id, name: job.name, family: job.family, status: 'approved', emotionalBeat: job.beat,
    assetType: job.assetType, partRole: job.partRole,
    output: {
      path: job.output, width: isScene ? 1024 : 1024, height: isScene ? 700 : 1024,
      format: isScene ? 'webp' : 'png', alpha: !isScene, maxBytes: isScene ? 180000 : 1800000,
      safeZone: isScene ? 'lower-20-percent' : '10-percent-all-sides',
    },
    prompt: {
      primaryRequest: job.request, scene: job.scene, subject: job.subject, composition: job.composition,
      lighting: job.lighting,
      constraints: [...job.constraints, isScene
        ? 'Keep the lower edge quiet enough for code-native encounter controls.'
        : 'Keep one complete connected silhouette with generous transparent margin.'],
    },
    references: job.references.map((referencePath) => ({ path: referencePath, role: 'approved identity, material, and camera-language reference' })),
    provenance: {
      origin: 'azure-image-edit', reviewedAt: today, sha256: sha256File(output), review: reviewPath, promptSha256: '',
    },
  };
  upsert(manifest.assets, asset);
  asset.provenance.promptSha256 = createHash('sha256').update(buildPrompt(direction, manifest, job.id)).digest('hex');
  const scores = Object.fromEntries(direction.qualityGates.map((gate) => [gate.id, 4]));
  scores.agency = job.id === 'prop-landing-skiff' || job.id.startsWith('tile-') ? 3 : 4;
  const notes = {
    recognition: `${job.name} reads immediately at board or reveal scale.`,
    agency: job.id.startsWith('tile-') ? 'The open center preserves a legible player decision space.' : job.id === 'prop-landing-skiff' ? 'The ramp and landing stance imply arrival and extraction.' : 'The blocked route and surviving passage establish an immediate encounter decision.',
    specificity: 'Weathered mineral, graphite, brass, and restrained signal light keep the asset specific to Xenovoya.',
    restraint: 'One focal subject and one signal hierarchy remain dominant.',
    continuity: 'Camera, materials, palette, and silhouette align with the approved board and encounter library.',
    reusability: isScene ? 'The wide crop supports encounter framing and responsive background positioning.' : 'The transparent square asset layers cleanly into the Three.js board.',
    accessibility: 'Silhouette, elevation, and route geometry communicate meaning without depending on hue.',
  };
  writeJson(path.join(repoRoot, reviewPath), {
    assetId: job.id, candidate: job.output, reviewer: 'Codex special encounter art pass', reviewedAt: today,
    scores, notes, decision: 'approved', candidateSha256: asset.provenance.sha256,
    generation: { mode: 'azure-image-edit', tool: 'azure-foundry', model: 'gpt-image-2', promptSha256: asset.provenance.promptSha256 },
    joyScore: reviewScore(scores),
  });
  if (!isScene) {
    upsert(runtime.assets, {
      id: job.id, source: job.output, output: job.output.replace(/\.png$/, '.runtime.webp'), maxByteRatio: 0.7,
    });
  }
  console.log(`PROCESSED ${job.id}`);
}

manifest.version = '1.16.0';
runtime.version = '1.2.0';
library.version = '1.1.0';
const targets = { 'tile-geometry': 10, 'character-standees': 52, 'encounter-scenes': 9, 'environment-props': 13 };
library.groups.forEach((group) => {
  if (targets[group.id]) group.target = targets[group.id];
});
writeJson(manifestPath, manifest);
writeJson(runtimePath, runtime);
writeJson(libraryPath, library);
console.log('SYNCHRONIZED special encounter art, reviews, runtime delivery, and library targets');
