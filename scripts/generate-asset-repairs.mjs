#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helper = path.join(process.env.USERPROFILE || '', '.codex', 'azure-image-edit.sh');
const outputRoot = path.join(repoRoot, 'artifacts', 'art', 'asset-repairs-2026-09-16');
const requestedId = process.argv[2] || '';
const catalog = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/characters/character-catalog.json'), 'utf8'));
const relicTender = catalog.characters.find((character) => character.id === 'relic-tender');

const characterJobs = [
  ['relic-tender-aftermath', 'AFTERMATH: complete upright reflective pose, gently examining one scuffed edge of the gray chest sling after the expedition; subdued relief; both boots planted and visible.'],
  ['relic-tender-carrying', 'CARRYING: complete upright walking pose, securely cradling one hand-scale warm mineral seed in both hands against the gray sling; head fully visible; both boots visible.'],
  ['relic-tender-escaping', 'ESCAPING: complete urgent forward running stride while looking back over one shoulder, protecting the warm mineral seed against the chest; both legs, both boots, and ponytail fully visible.'],
  ['relic-tender-helping', 'HELPING: complete braced kneeling-to-standing pose, one open hand reaching toward an off-frame crewmate while the other protects the chest sling; head and both boots fully visible.'],
  ['relic-tender-idle-alert', 'IDLE ALERT: complete calm watch posture distinct from neutral, weight shifted forward and one hand lightly sensing the warm mineral seed; head, hands, tunic hem, and both boots fully visible.'],
];

const propJobs = [
  ['prop-campsite-shelter', 'campsite-shelter.png', 'the same compact field shelter only: green fabric canopy, independent feet, attached packs, and one warm lantern'],
  ['prop-emberglass-shards', 'emberglass-shards.png', 'the same small cluster of translucent orange emberglass mineral shards only'],
  ['prop-glassroot-fronds', 'glassroot-fronds.png', 'the same cluster of luminous glassroot fronds and stems only'],
  ['prop-lantern-moss', 'lantern-moss.png', 'the same compact tuft of softly glowing lantern moss only'],
  ['prop-slate-spires', 'slate-spires.png', 'the same compact cluster of dark layered slate spires only'],
];

function slash(value) {
  return value.replaceAll('\\', '/');
}
function run(jobId, prompt, output, inputs) {
  if (requestedId && requestedId !== jobId) return;
  if (existsSync(output)) {
    console.log(`SKIP ${path.relative(repoRoot, output)} already exists`);
    return;
  }
  mkdirSync(path.dirname(output), { recursive: true });
  console.log(`GENERATE ${jobId}`);
  const result = spawnSync('bash', [slash(helper), prompt, slash(output), '1024x1024', ...inputs.map(slash)], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!existsSync(helper)) throw new Error(`Missing Azure image helper: ${helper}`);

for (const [jobId, action] of characterJobs) {
  const state = jobId.replace('relic-tender-', '');
  const canonical = path.join(repoRoot, 'app/public/images/art/characters/relic-tender.png');
  const poseReference = path.join(repoRoot, 'app/public/images/art/characters', `${jobId}.png`);
  const output = path.join(outputRoot, 'characters', `${jobId}-source.png`);
  const prompt = [
    'Use case: identity-preserve',
    'Asset type: production 2.5D game character standee',
    `Primary request: Rebuild a complete ${state} pose of the exact same Relic Tender from Image 1. Image 2 is pose intent only and may be clipped or damaged; repair it rather than copying its defects. ${action}`,
    `Identity lock: exact same ${relicTender.identity.face}; ${relicTender.identity.hair}; ${relicTender.identity.proportions}; ${relicTender.identity.signatureEquipment.join('; ')}. Preserve costume construction and muted charcoal, gray, warm orange, and brown palette exactly.`,
    'Composition: exactly one adult, complete full body in three-quarter view, centered, consistent scale, at least 8 percent clear margin on every edge. Every head, hand, tunic edge, leg, and boot must be fully present and connected.',
    'Backdrop: perfectly uniform pure white RGB background only. No transparency checkerboard, floor, terrain, platform, pedestal, cast shadow, scenery, horizon, frame, divider, caption, or label.',
    'Style: match Image 1 exactly; polished hand-painted graphic-novel cutout, crisp controlled silhouette, tactile field fabrics, restrained science-fantasy technology.',
    `Avoid: ${relicTender.identity.avoid.join('; ')}; cropping; missing body parts; detached feet; extra limbs; extra people; weapons; text; logo; watermark; black bars; border artifacts.`,
  ].join('\n');
  run(jobId, prompt, output, [canonical, poseReference]);
}

for (const [jobId, filename, subject] of propJobs) {
  const input = path.join(repoRoot, 'app/public/images/art/props', filename);
  const output = path.join(outputRoot, 'props', `${jobId}-source.png`);
  const prompt = [
    'Use case: precise-object-edit',
    'Asset type: production 2.5D board prop cutout',
    `Primary request: Preserve and redraw ${subject} from Image 1 while removing every piece of baked terrain, floor, dirt patch, rock base, tile, horizon, and cast shadow.`,
    'Composition: one complete compact prop, centered, three-quarter board-readable view, generous clear margin, every structural edge fully visible.',
    'Backdrop: perfectly uniform pure white RGB background only.',
    'Style: preserve the input Xenovoya hand-painted miniature illustration style, palette, materials, proportions, and silhouette.',
    'Constraints: object-only asset. The object may have necessary physical feet or roots, but no decorative ground plane beneath it. No checkerboard, scenery, text, logo, watermark, frame, border, detached debris, or extra object.',
  ].join('\n');
  run(jobId, prompt, output, [input]);
}
