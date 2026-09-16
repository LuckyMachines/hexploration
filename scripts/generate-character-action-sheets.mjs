#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/characters/character-catalog.json'), 'utf8'));
const helper = path.join(process.env.USERPROFILE || '', '.codex', 'azure-image-edit.sh');
const requestedCharacter = process.argv[2] || '';
const requestedSet = process.argv[3] || '';

const sets = {
  a: [
    ['selected', 'balanced ready stance angled toward the viewer, one hand near signature equipment'],
    ['moving', 'unmistakable forward walking stride with opposite arm swing and both boots visible'],
    ['digging', 'unmistakable low crouch, one knee bent, using one compact hand geology probe against the ground'],
    ['helping', 'open-handed braced gesture reaching toward an off-frame crewmate'],
  ],
  b: [
    ['recovering', 'seated on one heel, catching breath while checking signature equipment'],
    ['strained', 'standing but visibly exhausted, one guarded arm and uneven weight, still alert'],
    ['downed', 'safe seated braced posture communicating temporary incapacity, no gore'],
    ['carrying', 'protective two-handed carry of one hand-scale recovered mineral relic'],
  ],
  c: [
    ['escaping', 'urgent forward run while looking back toward the crew'],
    ['triumph', 'quiet earned relief, shoulders released, restrained smile'],
    ['aftermath', 'reflective post-expedition stance examining one scuffed piece of signature equipment'],
    ['idle-alert', 'calm alert watch posture distinct from the canonical neutral pose'],
  ],
};

function slash(value) {
  return value.replaceAll('\\', '/');
}

function promptFor(character, setId) {
  const poses = sets[setId];
  const identity = character.identity;
  return [
    'Use case: identity-preserve',
    'Asset type: 2x2 action-pose source grid to be separated into four transparent 2.5D game standees',
    `Primary request: Create EXACTLY FOUR separate full-body action poses of the exact same ${character.name} from the input. Arrange one figure in each quadrant. ${poses.map(([state, direction], index) => `${['Top-left', 'Top-right', 'Bottom-left', 'Bottom-right'][index]} ${state.toUpperCase()}: ${direction}.`).join(' ')}`,
    `Identity lock: exact same ${identity.face}; ${identity.hair}; ${identity.proportions}; ${identity.signatureEquipment.join('; ')}. Preserve the input costume construction and palette exactly.`,
    'Composition: exactly one complete person per quadrant, equal visual scale, at least 12 percent empty gutter, no overlap, every head, hand, and both boots entirely visible.',
    'Backdrop: flat uniform pure white RGB background only. Do not draw transparency checkerboards, scenery, floor, horizon, cast shadows, frames, dividers, captions, or labels.',
    'Style: match the input illustration exactly; polished hand-painted graphic-novel cutout with crisp controlled silhouette and tactile field fabrics.',
    `Constraints: these are four different ACTIONS, not turnaround views. No rear view. Avoid ${identity.avoid.join('; ')}. No extra people, costume redesign, weapons, duplicate signature equipment, text, interface, border, logo, or watermark.`,
  ].join('\n');
}

if (!existsSync(helper)) throw new Error(`Missing Azure image helper: ${helper}`);
for (const character of catalog.characters) {
  if (requestedCharacter && requestedCharacter !== character.id) continue;
  for (const setId of Object.keys(sets)) {
    if (requestedSet && requestedSet !== setId) continue;
    const outputDir = path.join(repoRoot, 'artifacts', 'art', 'characters', 'action-strips', character.id);
    const output = path.join(outputDir, `set-${setId}-v2.png`);
    if (existsSync(output)) {
      console.log(`SKIP ${path.relative(repoRoot, output)} already exists`);
      continue;
    }
    mkdirSync(outputDir, { recursive: true });
    const input = path.join(repoRoot, 'app', 'public', 'images', 'art', 'characters', `${character.id}.png`);
    console.log(`GENERATE ${character.id} set ${setId}: ${sets[setId].map(([state]) => state).join(', ')}`);
    const result = spawnSync('bash', [slash(helper), promptFor(character, setId), slash(output), '2048x2048', slash(input)], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'inherit',
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
