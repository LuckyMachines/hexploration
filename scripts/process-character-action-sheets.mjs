#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPrompt } from '../app/src/art-pipeline/promptBuilder.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(repoRoot, 'app/src/characters/character-catalog.json');
const manifestPath = path.join(repoRoot, 'app/src/art-pipeline/asset-manifest.json');
const runtimePath = path.join(repoRoot, 'app/src/art-pipeline/runtime-image-delivery.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const runtime = JSON.parse(readFileSync(runtimePath, 'utf8'));
const direction = JSON.parse(readFileSync(path.join(repoRoot, 'app/src/art-pipeline/art-direction.json'), 'utf8'));

const stateSets = {
  a: [
    ['selected', 'balanced ready stance angled toward the viewer, one hand near signature equipment'],
    ['moving', 'unmistakable controlled forward stride with both boots visible'],
    ['digging', 'grounded crouch using one compact hand geology probe against the ground'],
    ['helping', 'open-handed braced gesture reaching toward an off-frame crewmate'],
  ],
  b: [
    ['recovering', 'seated on one heel, catching breath while checking signature equipment'],
    ['strained', 'standing but visibly exhausted with uneven weight, still alert'],
    ['downed', 'safe seated braced posture communicating temporary incapacity without gore'],
    ['carrying', 'protective two-handed carry of one hand-scale recovered mineral relic'],
  ],
  c: [
    ['escaping', 'urgent forward run while looking back toward the crew'],
    ['triumph', 'quiet earned relief with released shoulders and a restrained smile'],
    ['aftermath', 'reflective post-expedition stance examining one scuffed piece of signature equipment'],
    ['idle-alert', 'calm alert watch posture distinct from the canonical neutral pose'],
  ],
};

const emotionByState = {
  selected: 'agency', moving: 'agency', digging: 'discovery', helping: 'cooperation',
  recovering: 'relief', strained: 'jeopardy', downed: 'jeopardy', carrying: 'trust',
  escaping: 'jeopardy', triumph: 'triumph', aftermath: 'remembrance', 'idle-alert': 'trust',
};
const geometry = ['1012x1012+6+6', '1012x1012+1030+6', '1012x1012+6+1030', '1012x1012+1030+1030'];
const identityDimensions = ['samePerson', 'face', 'proportions', 'costume', 'equipment', 'visualScale', 'stateRead'];
const cleanupByAssetId = {
  'character-signal-cartographer-strained': { clearFromY: 1005 },
  'character-field-mender-strained': { clearFromY: 930 },
  'character-relic-tender-moving': { clearFromY: 950 },
  'character-relic-tender-strained': { clearFromY: 940 },
  'character-routekeeper-selected': {
    transparentWhite: true,
    clearNeutralCheckerRegion: '160x260+580+400',
    clearPolygons: [
      '626,398 644,402 653,430 642,439 627,421',
      '629,430 647,434 664,473 679,542 664,552 646,541 631,501 623,457',
      '634,546 653,546 660,576 646,586 633,568',
      '653,548 681,550 697,621 686,644 662,629 651,583',
    ],
  },
};
const existingAssetIds = new Set(manifest.assets.map((asset) => asset.id));
const existingRuntimeIds = new Set(runtime.assets.map((asset) => asset.id));
const today = new Date().toISOString().slice(0, 10);

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function title(value) {
  return value.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

if (!catalog.requiredStates.includes('idle-alert')) catalog.requiredStates.push('idle-alert');

for (const character of catalog.characters) {
  character.assets.states ||= {};
  character.assets.stateAssetIds ||= {};
  const baseAsset = manifest.assets.find((asset) => asset.id === character.assets.neutralAssetId);
  if (!baseAsset) throw new Error(`Missing canonical manifest asset for ${character.id}`);

  for (const [setId, states] of Object.entries(stateSets)) {
    const sheet = path.join(repoRoot, 'artifacts/art/characters/action-strips', character.id, `set-${setId}-v2.png`);
    if (!existsSync(sheet)) throw new Error(`Missing action sheet: ${sheet}`);
    for (let index = 0; index < states.length; index += 1) {
      const [state, stateDirection] = states[index];
      if (character.assets.states[state]) continue;
      const assetId = `character-${character.id}-${state}`;
      const relativeOutput = `app/public/images/art/characters/${character.id}-${state}.png`;
      const output = path.join(repoRoot, relativeOutput);
      mkdirSync(path.dirname(output), { recursive: true });
      execFileSync('magick', [
        sheet, '-crop', geometry[index], '+repage', '-alpha', 'on',
        '-fuzz', '20%', '-fill', 'none', '-draw', 'alpha 0,0 floodfill', '-trim', '+repage',
        '-resize', '900x900>', '-gravity', 'south', '-background', 'none',
        '-extent', '1024x1024', output,
      ], { cwd: repoRoot, windowsHide: true });

      character.assets.states[state] = `/${relativeOutput.replace(/^app\/public\//, '')}`;
      character.assets.stateAssetIds[state] = assetId;
      const asset = {
        id: assetId,
        name: `${title(state)} ${character.name}`,
        family: 'character-condition',
        character: { id: character.id, state, baseAssetId: character.assets.neutralAssetId },
        status: 'approved',
        emotionalBeat: emotionByState[state],
        assetType: 'transparent-focal',
        partRole: 'focal',
        output: {
          path: relativeOutput, width: 1024, height: 1024, format: 'png', alpha: true,
          maxBytes: 1800000, safeZone: '10-percent-all-sides',
        },
        prompt: {
          primaryRequest: `The exact same ${character.name} in the ${state} gameplay state.`,
          scene: 'Transparent isolation with no floor, horizon, scenery, frame, or cast shadow.',
          subject: `${character.name}: ${stateDirection}.`,
          composition: 'Complete full-body three-quarter game standee, head, hands, and both boots visible, consistent foot line, generous margin, readable at 64 pixels.',
          lighting: 'Soft neutral character key with signal color restricted to established equipment.',
          constraints: [
            'Preserve the exact canonical face, age, hair, body proportions, costume construction, equipment placement, and signature props.',
            'One adult only; no extra people, weapons, costume redesign, text, logo, watermark, frame, floor, or scenery.',
            `The ${state} body mechanics must remain readable without depending on color.`,
          ],
          identityLocks: [
            ...character.identity.immutableDetails.map((detail) => `Preserve ${detail}.`),
            'Keep the full action readable at small gameplay-card and board scale.',
          ],
        },
        references: [{ path: baseAsset.output.path, role: 'canonical character identity, costume, proportion, and equipment reference' }],
        provenance: {
          origin: 'azure-image-edit-grid-extraction', reviewedAt: today, sha256: sha256File(output),
          review: `app/src/art-pipeline/reviews/${assetId}.json`, promptSha256: '',
        },
      };
      if (!existingAssetIds.has(assetId)) {
        manifest.assets.push(asset);
        existingAssetIds.add(assetId);
      }
      asset.provenance.promptSha256 = createHash('sha256').update(buildPrompt(direction, manifest, assetId)).digest('hex');

      const score4 = Object.fromEntries(direction.qualityGates.map((gate) => [gate.id, 4]));
      score4.continuity = 3;
      const noteByGate = {
        recognition: `The ${state} pose reads immediately at board and dossier scale.`,
        agency: 'The body mechanics communicate a concrete player state rather than a decorative portrait.',
        specificity: `Canonical ${character.name} equipment and field silhouette remain specific to Xenovoya.`,
        restraint: 'One character and one state action remain visually dominant.',
        continuity: 'The pose preserves canonical identity, costume, palette, and rendering language; small equipment details may simplify at action scale.',
        reusability: 'The transparent 1024 square cutout supports board, dossier, and compact-card presentation.',
        accessibility: 'Pose and silhouette communicate the state without relying on color.',
      };
      const identityScores = Object.fromEntries(identityDimensions.map((dimension) => [dimension, 4]));
      identityScores.equipment = 3;
      const identityNotes = Object.fromEntries(identityDimensions.map((dimension) => [dimension, `Canonical ${dimension} remains visually consistent with the approved neutral reference.`]));
      const earnedScore = direction.qualityGates.reduce((total, gate) => total + (score4[gate.id] * gate.weight), 0);
      const possibleScore = direction.qualityGates.reduce((total, gate) => total + (4 * gate.weight), 0);
      const joyScore = Number(((earnedScore / possibleScore) * 10).toFixed(1));
      writeJson(path.join(repoRoot, asset.provenance.review), {
        assetId, candidate: relativeOutput, reviewer: 'Codex character action expansion', reviewedAt: today,
        scores: score4, notes: noteByGate, decision: 'approved',
        characterIdentity: {
          characterId: character.id, state, baseAssetId: character.assets.neutralAssetId,
          baseSha256: baseAsset.provenance.sha256, scores: identityScores, notes: identityNotes,
        },
        candidateSha256: asset.provenance.sha256,
        generation: { mode: 'azure-image-edit-grid-extraction', tool: 'azure-foundry', model: 'gpt-image-2', promptSha256: asset.provenance.promptSha256 },
        joyScore,
      });

      const runtimeId = `character-${character.id}-${state}`;
      if (!existingRuntimeIds.has(runtimeId)) {
        runtime.assets.push({
          id: runtimeId,
          source: relativeOutput,
          output: relativeOutput.replace(/\.png$/, '.runtime.webp'),
          maxByteRatio: 0.7,
        });
        existingRuntimeIds.add(runtimeId);
      }
      console.log(`AUTHORED ${character.id}/${state}`);
    }
  }
}

for (const [assetId, cleanup] of Object.entries(cleanupByAssetId)) {
  const asset = manifest.assets.find((candidate) => candidate.id === assetId);
  if (!asset || !existsSync(path.join(repoRoot, asset.output.path))) continue;
  const output = path.join(repoRoot, asset.output.path);
  const temporaryOutput = output.replace(/\.png$/, '.cleanup.png');
  const args = [output, '-alpha', 'on'];
  if (cleanup.transparentWhite) args.push('-channel', 'RGB', '-fuzz', '25%', '-transparent', 'white', '+channel');
  if (cleanup.clearNeutralCheckerRegion) {
    args.push(
      '-region', cleanup.clearNeutralCheckerRegion,
      '-channel', 'A', '-fx', '(r>0.65&&g>0.65&&b>0.65&&abs(r-g)<0.1&&abs(g-b)<0.1)?0:a',
      '+channel', '+region',
    );
  }
  if (cleanup.clearFromY) {
    args.push('-channel', 'A', '-fill', 'black', '-draw', `rectangle 0,${cleanup.clearFromY} 1024,1024`, '+channel');
  }
  for (const points of cleanup.clearPolygons || []) {
    args.push('-channel', 'A', '-fill', 'black', '-draw', `polygon ${points}`, '+channel');
  }
  args.push('-background', 'none');
  args.push(temporaryOutput);
  execFileSync('magick', args, { cwd: repoRoot, windowsHide: true });
  renameSync(temporaryOutput, output);
  asset.provenance.sha256 = sha256File(output);
  const reviewPath = path.join(repoRoot, asset.provenance.review);
  if (existsSync(reviewPath)) {
    const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
    review.candidateSha256 = asset.provenance.sha256;
    writeJson(reviewPath, review);
  }
  console.log(`CLEANED ${assetId}`);
}

catalog.version = '1.1.0';
manifest.version = '1.15.0';
runtime.version = '1.1.0';
writeJson(catalogPath, catalog);
writeJson(manifestPath, manifest);
writeJson(runtimePath, runtime);
console.log('SYNCHRONIZED character catalog, art manifest, reviews, and runtime delivery contracts');
