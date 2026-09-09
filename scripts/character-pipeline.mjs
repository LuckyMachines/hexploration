#!/usr/bin/env node

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildCharacterReport,
  findCharacter,
  loadCharacterSystem,
  publicPathToFile,
  validateCharacterSystem,
} from './character-pipeline-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const { catalog } = loadCharacterSystem(repoRoot);

function parseArguments(values) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const [key, inlineValue] = value.slice(2).split('=', 2);
    if (inlineValue !== undefined) flags[key] = inlineValue;
    else if (values[index + 1] && !values[index + 1].startsWith('--')) flags[key] = values[++index];
    else flags[key] = true;
  }
  return { positionals, flags };
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `${command} failed`).trim());
  return result.stdout.trim();
}

function imagePaths(character) {
  return [character.assets.neutral, ...Object.values(character.assets.states || {})]
    .map((value) => publicPathToFile(repoRoot, value))
    .filter((value) => existsSync(value));
}

function commandDoctor(flags) {
  const result = validateCharacterSystem(catalog, { repoRoot, checkFiles: true });
  console.log(`Character catalog ${catalog.version}; ${catalog.characters.length} characters; ${catalog.roles.length} roles`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`FAIL ${error}`);
  if (result.errors.length || (flags.strict && result.warnings.length)) process.exitCode = 1;
  else console.log('PASS Character identities, roles, state assets, and relational reviews are current.');
}

function commandPlan() {
  for (const character of catalog.characters) {
    const authored = new Set(['neutral', ...Object.keys(character.assets.states || {})]);
    const fallbacks = catalog.requiredStates.filter((state) => !authored.has(state));
    console.log(`${character.name} [${character.roleId}] authored=${[...authored].join(',')} fallback=${fallbacks.join(',')}`);
  }
  console.log('Fallbacks are intentional until a gameplay state proves that neutral art is insufficient.');
}

function commandBrief(characterId, state = 'neutral', flags = {}) {
  const character = findCharacter(catalog, characterId);
  const assetId = state === 'neutral' ? character.assets.neutralAssetId : character.assets.stateAssetIds?.[state];
  if (!assetId) throw new Error(`${characterId} has no authored ${state} asset contract`);
  const args = [path.join(repoRoot, 'scripts', 'art-pipeline.mjs'), 'brief', assetId];
  if (flags.write) args.push('--write');
  console.log(run(process.execPath, args));
}

function commandGenerate(characterId, state = 'neutral', flags = {}) {
  if (!flags.write) throw new Error('generate is billable; add --write');
  const character = findCharacter(catalog, characterId);
  const assetId = state === 'neutral' ? character.assets.neutralAssetId : character.assets.stateAssetIds?.[state];
  if (!assetId) throw new Error(`${characterId} has no authored ${state} asset contract`);
  const output = resolvePath(flags.out || `artifacts/art/characters/candidates/${characterId}/${characterId}--${state}.png`);
  if (existsSync(output) && !flags.replace) throw new Error(`Candidate exists; use --replace: ${path.relative(repoRoot, output)}`);
  const args = [
    path.join(repoRoot, 'scripts', 'art-pipeline.mjs'),
    'generate',
    assetId,
    '--variant',
    String(flags.variant || `${state}-identity-v1`),
    '--write',
    '--out',
    output,
  ];
  for (const flag of ['direction', 'input', 'style-inputs', 'model', 'size']) {
    if (typeof flags[flag] === 'string' && flags[flag].trim()) args.push(`--${flag}`, flags[flag]);
  }
  if (flags.replace) args.push('--replace');
  console.log(run(process.execPath, args));
}

function commandReview(characterId, state, candidateValue, flags = {}) {
  if (!characterId || !state || !candidateValue) throw new Error('review requires <character-id> <state> <candidate>');
  const character = findCharacter(catalog, characterId);
  const assetId = state === 'neutral' ? character.assets.neutralAssetId : character.assets.stateAssetIds?.[state];
  if (!assetId) throw new Error(`${characterId} has no authored ${state} asset contract`);
  const candidate = resolvePath(candidateValue);
  if (!existsSync(candidate)) throw new Error(`Candidate not found: ${candidate}`);
  const args = [
    path.join(repoRoot, 'scripts', 'art-pipeline.mjs'),
    'review',
    assetId,
    candidate,
    '--mode',
    String(flags.mode || (state === 'neutral' ? 'azure-image-generation' : 'azure-image-edit')),
    '--tool',
    String(flags.tool || 'azure-foundry'),
    '--model',
    String(flags.model || (state === 'neutral' ? 'FLUX.2-pro' : 'gpt-image-2')),
  ];
  if (flags.write) args.push('--write');
  console.log(run(process.execPath, args));
}

function commandReviewCheck(reviewValue) {
  console.log(run(process.execPath, [path.join(repoRoot, 'scripts', 'art-pipeline.mjs'), 'review-check', resolvePath(reviewValue)]));
}

function montage(files, output, { silhouette = false, tile = '4x' } = {}) {
  if (!files.length) throw new Error('No character images are available for this sheet');
  mkdirSync(path.dirname(output), { recursive: true });
  let sources = files;
  let tempDir;
  if (silhouette) {
    tempDir = path.join(path.dirname(output), `.silhouettes-${process.pid}`);
    mkdirSync(tempDir, { recursive: true });
    sources = files.map((file, index) => {
      const target = path.join(tempDir, `${index}.png`);
      run('magick', [file, '-channel', 'A', '-threshold', '1%', '-separate', '+channel', '-negate', target]);
      return target;
    });
  }
  run('magick', ['montage', ...sources, '-thumbnail', '420x420', '-background', '#0b100d', '-geometry', '+24+24', '-tile', tile, output]);
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
}

function commandContactSheet(subject = 'crew', flags = {}) {
  if (!flags.write) throw new Error('contact-sheet is a write operation; add --write');
  const silhouette = flags.mode === 'silhouette';
  const files = subject === 'crew'
    ? catalog.characters.map((character) => publicPathToFile(repoRoot, character.assets.neutral)).filter((file) => existsSync(file))
    : imagePaths(findCharacter(catalog, subject));
  const suffix = silhouette ? 'silhouette-sheet' : 'contact-sheet';
  const output = resolvePath(flags.out || `artifacts/art/characters/reviews/${subject}-${suffix}.png`);
  montage(files, output, { silhouette, tile: subject === 'crew' ? '4x' : '3x' });
  console.log(`WROTE ${path.relative(repoRoot, output)}`);
}

function commandContextSheet(characterId, flags = {}) {
  if (!flags.write) throw new Error('context-sheet is a write operation; add --write');
  const character = findCharacter(catalog, characterId);
  const source = publicPathToFile(repoRoot, character.assets.neutral);
  if (!existsSync(source)) throw new Error(`Neutral art is missing: ${source}`);
  const output = resolvePath(flags.out || `artifacts/art/characters/reviews/${characterId}-context-sheet.png`);
  const tempDir = path.join(path.dirname(output), `.contexts-${process.pid}`);
  mkdirSync(tempDir, { recursive: true });
  const backgrounds = ['#f3ead4', '#151b17', '#5b442f'];
  const scales = [220, 72];
  const files = [];
  for (const [backgroundIndex, background] of backgrounds.entries()) {
    for (const scale of scales) {
      const target = path.join(tempDir, `${backgroundIndex}-${scale}.png`);
      run('magick', [
        '-size', '512x512', `xc:${background}`,
        '(', source, '-resize', `${scale}x${scale}`, ')',
        '-gravity', 'south', '-geometry', '+0+38', '-composite', target,
      ]);
      files.push(target);
    }
  }
  montage(files, output, { tile: '3x2' });
  rmSync(tempDir, { recursive: true, force: true });
  console.log(`WROTE ${path.relative(repoRoot, output)}`);
}

function commandReport(flags = {}) {
  const validation = validateCharacterSystem(catalog, { repoRoot, checkFiles: true });
  const report = buildCharacterReport(catalog, validation);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (!flags.write) {
    console.log(serialized);
    return;
  }
  const output = path.join(repoRoot, 'app', 'public', 'characters', 'latest-report.json');
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, serialized);
  console.log(`WROTE ${path.relative(repoRoot, output)}`);
}

function printHelp() {
  console.log(`Xenovoya character pipeline

Commands:
  doctor [--strict]
  plan
  brief <character-id> [state] [--write]
  generate <character-id> [state] --write [--variant name] [--input path] [--style-inputs "a;b"] [--direction text] [--model name] [--size WxH] [--out path] [--replace]
  review <character-id> <state> <candidate> [--write] [--mode name] [--tool name] [--model name]
  review-check <review-path>
  contact-sheet [crew|character-id] --write [--mode silhouette] [--out path]
  context-sheet <character-id> --write [--out path]
  report [--write]`);
}

const { positionals, flags } = parseArguments(process.argv.slice(2));
const [command = 'help', subject, state, candidate] = positionals;
try {
  if (command === 'doctor') commandDoctor(flags);
  else if (command === 'plan') commandPlan();
  else if (command === 'brief') commandBrief(subject, state || 'neutral', flags);
  else if (command === 'generate') commandGenerate(subject, state || 'neutral', flags);
  else if (command === 'review') commandReview(subject, state, candidate, flags);
  else if (command === 'review-check') commandReviewCheck(subject);
  else if (command === 'contact-sheet') commandContactSheet(subject || 'crew', flags);
  else if (command === 'context-sheet') commandContextSheet(subject, flags);
  else if (command === 'report') commandReport(flags);
  else printHelp();
} catch (error) {
  console.error(`Character pipeline failed: ${error.message}`);
  process.exitCode = 1;
}
