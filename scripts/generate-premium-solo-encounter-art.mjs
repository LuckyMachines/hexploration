#!/usr/bin/env node

import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helper = path.join(process.env.USERPROFILE || '', '.codex', 'azure-image.sh');
const outDir = path.join(repoRoot, 'app/public/images/art/encounters');
const only = process.argv[2] || '';
const slash = (value) => value.replaceAll('\\', '/');

const shared = 'Xenovoya premium science-fantasy board game key art. Hand-painted graphic-novel realism, tactile miniature materials, rain-dark graphite, aged brass, restrained cyan and amber bioluminescence, dramatic volumetric weather, sophisticated near-black negative space, no text, no lettering, no logo, no watermark, no interface, no border. One coherent cinematic scene, not a collage. Leave the lower-left third quiet and dark enough for readable game UI.';
const jobs = [
  {
    id: 'glassroot-choir-decision-v2',
    prompt: `${shared} Wide 3:2 landscape. A translucent living root choir rises from wet black soil in an alien green-glass forest, carrying concentric cyan sound ripples beneath the ground. A small lantern marker establishes scale; no people. The scene offers two visually legible paths: a luminous route toward a distant violet relic glow and a sheltered route toward a compact supply cache. Joyful wonder with a quiet undertone of risk.`,
  },
  {
    id: 'cinderwake-flats-decision-v2',
    prompt: `${shared} Wide 3:2 landscape. Black cinder sand lifts in slow ribbons around a newly surfaced brass-and-graphite geothermal siphon with cracked orange glass vanes. Show a cool repair path on one side and a rising thermal route toward distant slate ridges on the other. No people, no creature. Heat shimmer, strong depth, readable silhouette, danger without generic lava spectacle.`,
  },
  {
    id: 'bellstone-rise-decision-v2',
    prompt: `${shared} Wide 3:2 landscape. A field of hollow basalt bell pillars rings beneath an approaching blue-black storm wall. One tall pillar glows with an amber warning pulse while a sheltered cyan route curls between smaller stones toward the horizon. No people or creature. Express sound through subtle particulate rings and vibrating rain, elegant and eerie rather than explosive.`,
  },
  {
    id: 'far-slate-decision-v2',
    prompt: `${shared} Wide 3:2 landscape. A single slate-spire kite, an alien ray-like creature made of layered dark mineral plates and thin cyan charged membranes, banks over a remote stepped basalt shelf. Its flight traces a fork: one safe grounded route and one dangerous luminous arc revealing a distant violet relic. Creature fully visible and clearly non-humanoid, no duplicates, no people.`,
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
  console.log(`GENERATE ${job.id}`);
  const result = spawnSync('bash', [slash(helper), job.prompt, slash(output), 'gpt-image-2', '1536x1024'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
