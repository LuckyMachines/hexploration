import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const CHARACTER_REVIEW_DIMENSIONS = Object.freeze([
  'samePerson',
  'face',
  'proportions',
  'costume',
  'equipment',
  'visualScale',
  'stateRead',
]);

const stateDirections = Object.freeze({
  neutral: 'Calm alert standing pose with the full silhouette and every signature item clearly visible.',
  selected: 'A subtle attentive shift toward the viewer, ready to receive a decision.',
  moving: 'A controlled forward step with readable direction and both feet still visible.',
  digging: 'A grounded inspection pose interacting with an off-frame discovery below waist height.',
  helping: 'A clear open-handed gesture toward an off-frame crewmate, cooperative rather than heroic.',
  recovering: 'A grounded kneeling pose using the character signature equipment to restore a crewmate just off frame.',
  strained: 'Visible fatigue and guarded posture while still communicating agency; no gore or defeat.',
  downed: 'A safe seated or braced posture communicating temporary incapacity without injury spectacle.',
  carrying: 'Protective two-handed artifact-carrying posture with the signature silhouette intact.',
  escaping: 'Urgent forward movement while looking back toward the crew and keeping the route readable.',
  triumph: 'Quiet relief after an earned result, intimate and restrained rather than celebratory spectacle.',
  aftermath: 'Reflective post-expedition posture with one subtle trace of what the run cost or taught.',
});

export function loadCharacterSystem(repoRoot) {
  const catalogPath = path.join(repoRoot, 'app', 'src', 'characters', 'character-catalog.json');
  return { catalogPath, catalog: JSON.parse(readFileSync(catalogPath, 'utf8')) };
}

export function publicPathToFile(repoRoot, publicPath) {
  return path.join(repoRoot, 'app', 'public', String(publicPath || '').replace(/^\/+/, ''));
}

export function reviewPathFor(repoRoot, assetId) {
  return path.join(repoRoot, 'app', 'src', 'art-pipeline', 'reviews', `${assetId}.json`);
}

export function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function findCharacter(catalog, characterId) {
  const character = catalog.characters.find((item) => item.id === characterId);
  if (!character) throw new Error(`Unknown character: ${characterId}`);
  return character;
}

export function findRole(catalog, roleId) {
  const normalized = catalog.roleAliases?.[roleId] || roleId;
  const role = catalog.roles.find((item) => item.id === normalized);
  if (!role) throw new Error(`Unknown role: ${roleId}`);
  return role;
}

export function buildCharacterPrompt(catalog, characterId, state = 'neutral') {
  const character = findCharacter(catalog, characterId);
  if (!catalog.requiredStates.includes(state)) throw new Error(`Unknown character state: ${state}`);
  const role = findRole(catalog, character.roleId);
  const identity = character.identity;
  return [
    `Use case: ${state === 'neutral' ? 'stylized-concept' : 'identity-preserve'}`,
    'Asset type: transparent full-body 2.5D game standee for a rotating Three.js expedition board',
    `Primary request: ${state === 'neutral' ? `Create the canonical ${character.name}.` : `Edit the canonical ${character.name} into the ${state} state. Change only pose, expression, and the minimum state-specific interaction.`}`,
    `Character fantasy: ${character.fantasy}`,
    `Gameplay role: ${role.label}. ${role.contribution}. Signature verbs: ${role.verbs.join(', ')}.`,
    `Silhouette lock: ${identity.silhouette}`,
    `Face lock: ${identity.face}`,
    `Hair lock: ${identity.hair}`,
    `Body lock: ${identity.proportions}`,
    `Signature equipment: ${identity.signatureEquipment.join('; ')}.`,
    `State direction: ${stateDirections[state]}`,
    'Style/medium: polished hand-painted graphic-novel character illustration, crisp controlled shapes, tactile field fabrics, restrained science-fantasy technology, matching the established Xenovoya crew cutouts',
    'Composition/framing: full body from head to boots, three-quarter view, feet aligned to a consistent ground line, 10 percent clear margin, strong readable silhouette at 64 px',
    'Scene/backdrop: perfectly uniform pure white isolation background with no floor, horizon, environment, scenery, or cast shadow',
    `Color palette: ${identity.palette.join(', ')}; color supports identity but silhouette and equipment must remain readable in grayscale`,
    `Immutable details: ${identity.immutableDetails.join('; ')}.`,
    `Avoid: ${identity.avoid.join('; ')}; no text, logo, watermark, frame, cropped boots, extra people, weapons, generic spacesuit, photorealism, or costume redesign.`,
    state === 'neutral'
      ? 'Identity requirement: this image becomes the canonical edit target for every later state.'
      : 'Identity requirement: it must unmistakably be the exact same person from the input image, with the exact same face, age, hair, body proportions, costume construction, equipment placement, and signature props.',
  ].join('\n');
}

export function createCharacterReview(catalog, characterId, state, candidatePath, repoRoot) {
  const character = findCharacter(catalog, characterId);
  const basePath = publicPathToFile(repoRoot, character.assets.neutral);
  return {
    assetId: character.assets.stateAssetIds?.[state] || character.assets.neutralAssetId,
    baseAsset: path.relative(repoRoot, basePath).replaceAll('\\', '/'),
    candidate: path.relative(repoRoot, candidatePath).replaceAll('\\', '/'),
    reviewer: '',
    reviewedAt: new Date().toISOString().slice(0, 10),
    characterIdentity: {
      characterId,
      state,
      baseAssetId: character.assets.neutralAssetId,
      baseSha256: existsSync(basePath) ? sha256File(basePath) : '',
      scores: Object.fromEntries(CHARACTER_REVIEW_DIMENSIONS.map((dimension) => [dimension, null])),
      notes: Object.fromEntries(CHARACTER_REVIEW_DIMENSIONS.map((dimension) => [dimension, 'Record concrete visual evidence.'])),
    },
    candidateSha256: existsSync(candidatePath) ? sha256File(candidatePath) : '',
    decision: 'pending',
  };
}

export function scoreCharacterReview(review, minimumScore = 3) {
  const errors = [];
  const identity = review.characterIdentity || review;
  for (const dimension of CHARACTER_REVIEW_DIMENSIONS) {
    const score = identity.scores?.[dimension];
    if (!Number.isFinite(score) || score < 0 || score > 4) errors.push(`${dimension}: score must be between 0 and 4`);
    else if (score < minimumScore) errors.push(`${dimension}: ${score} is below the minimum ${minimumScore}`);
    if (!String(identity.notes?.[dimension] || '').trim()) errors.push(`${dimension}: evidence note is required`);
  }
  if (!String(review.reviewer || '').trim()) errors.push('reviewer is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt || '')) errors.push('reviewedAt must use YYYY-MM-DD');
  if (review.decision !== 'approved') errors.push('decision must be approved');
  return { passed: errors.length === 0, errors };
}

export function validateCharacterSystem(catalog, { repoRoot, checkFiles = true } = {}) {
  const errors = [];
  const warnings = [];
  const roleIds = new Set();
  const characterIds = new Set();
  const roleCharacters = new Set();
  const assetIds = new Set();
  const manifestPath = repoRoot ? path.join(repoRoot, 'app', 'src', 'art-pipeline', 'asset-manifest.json') : '';
  const manifestAssets = manifestPath && existsSync(manifestPath)
    ? new Map(JSON.parse(readFileSync(manifestPath, 'utf8')).assets.map((asset) => [asset.id, asset]))
    : null;
  if (!/^\d+\.\d+\.\d+$/.test(catalog.version || '')) errors.push('catalog version must use semver');
  if (!Array.isArray(catalog.requiredStates) || !catalog.requiredStates.includes('neutral')) errors.push('requiredStates must include neutral');
  if (new Set(catalog.requiredStates || []).size !== (catalog.requiredStates || []).length) errors.push('requiredStates must be unique');
  for (const role of catalog.roles || []) {
    if (roleIds.has(role.id)) errors.push(`duplicate role id: ${role.id}`);
    roleIds.add(role.id);
    if (roleCharacters.has(role.characterId)) errors.push(`multiple roles use character ${role.characterId}`);
    roleCharacters.add(role.characterId);
    if (!Array.isArray(role.verbs) || role.verbs.length < 2) errors.push(`${role.id}: at least two verbs are required`);
  }
  for (const character of catalog.characters || []) {
    if (characterIds.has(character.id)) errors.push(`duplicate character id: ${character.id}`);
    characterIds.add(character.id);
    if (!roleIds.has(character.roleId)) errors.push(`${character.id}: unknown role ${character.roleId}`);
    if (!character.assets?.neutral) errors.push(`${character.id}: neutral asset is required`);
    if (!character.assets?.neutralAssetId) errors.push(`${character.id}: neutral asset id is required`);
    else if (assetIds.has(character.assets.neutralAssetId)) errors.push(`${character.id}: duplicate asset id ${character.assets.neutralAssetId}`);
    else assetIds.add(character.assets.neutralAssetId);
    const neutralManifestAsset = manifestAssets?.get(character.assets?.neutralAssetId);
    if (manifestAssets && !neutralManifestAsset) errors.push(`${character.id}: neutral asset id is missing from the art manifest`);
    else if (neutralManifestAsset) {
      const publicOutput = `/` + neutralManifestAsset.output.path.replace(/^app\/public\//, '');
      if (publicOutput !== character.assets.neutral) errors.push(`${character.id}: neutral catalog path does not match the art manifest`);
    }
    if ((character.identity?.immutableDetails || []).length < 3) errors.push(`${character.id}: at least three immutable identity details are required`);
    if ((character.identity?.signatureEquipment || []).length < 2) errors.push(`${character.id}: at least two signature equipment details are required`);
    if (character.standee?.billboard !== 'camera-facing') errors.push(`${character.id}: unsupported standee billboard contract`);
    for (const state of Object.keys(character.assets?.states || {})) {
      if (!catalog.requiredStates.includes(state)) errors.push(`${character.id}: unknown authored state ${state}`);
      const assetId = character.assets.stateAssetIds?.[state];
      if (!assetId) errors.push(`${character.id}/${state}: state asset id is required`);
      else if (assetIds.has(assetId)) errors.push(`${character.id}/${state}: duplicate asset id ${assetId}`);
      else assetIds.add(assetId);
      const manifestAsset = manifestAssets?.get(assetId);
      if (manifestAssets && assetId && !manifestAsset) errors.push(`${character.id}/${state}: asset id is missing from the art manifest`);
      else if (manifestAsset) {
        const publicOutput = `/` + manifestAsset.output.path.replace(/^app\/public\//, '');
        if (publicOutput !== character.assets.states[state]) errors.push(`${character.id}/${state}: catalog path does not match the art manifest`);
        if (manifestAsset.character?.id !== character.id || manifestAsset.character?.state !== state) errors.push(`${character.id}/${state}: art manifest identity does not match the catalog`);
      }
    }
    if (!checkFiles) continue;
    const neutralPath = publicPathToFile(repoRoot, character.assets.neutral);
    if (!existsSync(neutralPath)) errors.push(`${character.id}: missing neutral asset ${character.assets.neutral}`);
    for (const [state, publicPath] of Object.entries(character.assets.states || {})) {
      const assetId = character.assets.stateAssetIds?.[state];
      if (!assetId) continue;
      const candidatePath = publicPathToFile(repoRoot, publicPath);
      if (!existsSync(candidatePath)) {
        errors.push(`${character.id}/${state}: missing state asset ${publicPath}`);
        continue;
      }
      const reviewPath = reviewPathFor(repoRoot, assetId);
      if (!existsSync(reviewPath)) {
        errors.push(`${character.id}/${state}: missing relational review`);
        continue;
      }
      const review = JSON.parse(readFileSync(reviewPath, 'utf8'));
      if (review.characterIdentity?.characterId !== character.id || review.characterIdentity?.state !== state) errors.push(`${character.id}/${state}: review identity mismatch`);
      if (review.characterIdentity?.baseAssetId !== character.assets.neutralAssetId) errors.push(`${character.id}/${state}: review base asset mismatch`);
      if (review.characterIdentity?.baseSha256 !== sha256File(neutralPath)) errors.push(`${character.id}/${state}: base identity fingerprint is stale`);
      if (review.candidateSha256 !== sha256File(candidatePath)) errors.push(`${character.id}/${state}: candidate fingerprint is stale`);
      for (const failure of scoreCharacterReview(review, catalog.qualityContract.minimumRelationalScore).errors) errors.push(`${character.id}/${state}: ${failure}`);
    }
  }
  for (const character of catalog.characters || []) {
    for (const state of Object.keys(character.assets?.stateAssetIds || {})) {
      if (!character.assets?.states?.[state]) errors.push(`${character.id}/${state}: state asset id has no matching public path`);
    }
  }
  for (const role of catalog.roles || []) {
    const character = (catalog.characters || []).find((item) => item.id === role.characterId);
    if (!character) errors.push(`${role.id}: missing character ${role.characterId}`);
    else if (character.roleId !== role.id) errors.push(`${role.id}: character ${character.id} points back to ${character.roleId}`);
  }
  for (const [alias, roleId] of Object.entries(catalog.roleAliases || {})) {
    if (!roleIds.has(roleId)) errors.push(`role alias ${alias} points to unknown role ${roleId}`);
  }
  if ((catalog.roles || []).length !== 4) warnings.push(`Expected four gameplay roles; found ${(catalog.roles || []).length}`);
  if ((catalog.characters || []).length !== 4) warnings.push(`Expected four unique crew characters; found ${(catalog.characters || []).length}`);
  return { errors, warnings };
}

export function buildCharacterReport(catalog, validation) {
  const authoredStateCount = catalog.characters.reduce((sum, character) => sum + 1 + Object.keys(character.assets.states || {}).length, 0);
  const possibleStateCount = catalog.characters.length * catalog.requiredStates.length;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: 'automated-only',
    catalogVersion: catalog.version,
    grade: validation.errors.length ? 'blocked' : 'A-',
    architectureGrade: validation.errors.length ? 'B' : 'A',
    evidenceGrade: validation.errors.length ? 'C' : 'B+',
    roster: { roles: catalog.roles.length, characters: catalog.characters.length, uniquePairings: new Set(catalog.roles.map((role) => role.characterId)).size },
    coverage: { authoredStateCount, possibleStateCount, fallbackCount: possibleStateCount - authoredStateCount },
    validation,
    evidenceLimits: ['No representative human attachment or recognition study has been collected.', 'Automated and expert visual review must not be described as player evidence.'],
    nextAction: validation.errors[0] || 'Add authored states only when gameplay evidence shows the neutral fallback is insufficient.',
  };
}
