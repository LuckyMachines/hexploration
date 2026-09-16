#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildLibraryReport, humanizeAssetId, selectGroupAssets, validateLibraryContract } from './game-art-library-utils.mjs';
import { inspectImage, resolveRepoPath } from './art-pipeline-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const manifest = JSON.parse(readFileSync(resolveRepoPath(repoRoot, 'app/src/art-pipeline/asset-manifest.json'), 'utf8'));
const contract = JSON.parse(readFileSync(resolveRepoPath(repoRoot, 'app/src/art-pipeline/game-art-library.json'), 'utf8'));

function parseArguments(values) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) positionals.push(value);
    else {
      const [key, inline] = value.slice(2).split('=', 2);
      if (inline !== undefined) flags[key] = inline;
      else if (values[index + 1] && !values[index + 1].startsWith('--')) flags[key] = values[++index];
      else flags[key] = true;
    }
  }
  return { positionals, flags };
}

function runMagick(args) {
  const result = spawnSync('magick', args, { encoding: 'utf8', windowsHide: true });
  if (result.error) throw new Error(`ImageMagick is unavailable: ${result.error.message}`);
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'ImageMagick failed').trim());
}

function fileExists(relativePath) {
  return Boolean(relativePath && existsSync(resolveRepoPath(repoRoot, relativePath)));
}

function writeReport() {
  const report = buildLibraryReport(contract, manifest, { fileExists });
  const output = resolveRepoPath(repoRoot, 'reports/art-library/latest.json');
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`WROTE ${path.relative(repoRoot, output)} | ${report.grade} ${report.score}/100`);
  return report;
}

function createMissingCard(asset, target) {
  runMagick([
    '-size', '720x760', 'xc:#241213',
    '-stroke', '#e86060', '-strokewidth', '4', '-fill', 'none', '-draw', 'rectangle 28,28 691,731',
    '-font', 'Arial', '-gravity', 'center', '-fill', '#e86060', '-stroke', 'none', '-pointsize', '34',
    '-annotate', '+0-34', 'MISSING OUTPUT', '-fill', '#f0d8d4', '-pointsize', '22', '-annotate', '+0+22', asset.name,
    target,
  ]);
}

function createAssetCard(asset, target) {
  const source = resolveRepoPath(repoRoot, asset.output.path);
  if (!existsSync(source)) return createMissingCard(asset, target);
  const metadata = inspectImage(source);
  const alpha = Boolean(asset.output.alpha);
  const args = ['-size', '720x760', 'xc:#0d0f0a'];
  if (alpha) {
    args.push('-fill', '#173127', '-draw', 'rectangle 0,0 359,639', '-fill', '#eee8d8', '-draw', 'rectangle 360,0 719,639');
  }
  args.push(
    '(', source, '-auto-orient', '-thumbnail', alpha ? '560x560>' : '680x520>', ')',
    '-gravity', 'center', '-geometry', '+0-58', '-composite',
    '-fill', '#07100d', '-draw', 'rectangle 0,640 719,759',
    '-font', 'Arial', '-gravity', 'south', '-stroke', 'none', '-fill', '#f3d978', '-pointsize', '25',
    '-annotate', '+0+68', asset.name,
    '-fill', '#c8d2cc', '-pointsize', '17',
    '-annotate', '+0+36', `${asset.status.toUpperCase()} | ${asset.assetType}`,
    '-fill', '#8fa79b', '-pointsize', '15',
    '-annotate', '+0+13', `${metadata.width}x${metadata.height} | ${alpha ? 'ALPHA' : 'OPAQUE'} | ${humanizeAssetId(asset.id)}`,
    target,
  );
  runMagick(args);
}

function renderContactSheets(flags) {
  if (!flags.write) throw new Error('contact-sheets is a write operation; add --write');
  const relativeOutput = String(flags.out || 'artifacts/art/contact-sheets/game-library-latest');
  const outputDir = resolveRepoPath(repoRoot, relativeOutput);
  const cardDir = path.join(outputDir, 'cards');
  mkdirSync(cardDir, { recursive: true });
  const groupSheets = [];

  for (const group of contract.groups) {
    const assets = selectGroupAssets(manifest, group);
    const cards = [];
    for (const asset of assets) {
      const card = path.join(cardDir, `${group.id}--${asset.id}.png`);
      if (!existsSync(card) || flags.replace) createAssetCard(asset, card);
      cards.push(card);
    }
    if (cards.length === 0) continue;
    const output = path.join(outputDir, `${group.id}.png`);
    runMagick([
      'montage', '-title', `${group.title.toUpperCase()}\n${assets.length}/${group.target} TARGET ASSETS`,
      '-font', 'Arial', '-pointsize', '25', '-fill', '#f3d978', '-stroke', 'none', '-background', '#07100d',
      ...cards, '-thumbnail', group.thumbnail, '-tile', `${group.columns}x`, '-geometry', '+24+54',
      '-border', '2', '-bordercolor', '#284637', output,
    ]);
    const preview = path.join(cardDir, `preview--${group.id}.png`);
    runMagick([
      output, '-thumbnail', '1420x920>', '-gravity', 'center', '-background', '#07100d', '-extent', '1480x1000',
      '-stroke', '#31533f', '-strokewidth', '3', '-fill', 'none', '-draw', 'rectangle 1,1 1478,998', preview,
    ]);
    groupSheets.push({ group, output, preview, count: assets.length });
    console.log(`WROTE ${path.relative(repoRoot, output)}`);
  }

  const master = path.join(outputDir, 'xenovoya-game-art-library-master.png');
  runMagick([
    'montage', '-title', 'XENOVOYA | GAME ART LIBRARY\nLIKE-FOR-LIKE REVIEW | STATUS + COVERAGE + RUNTIME CONTRACTS',
    '-font', 'Arial', '-pointsize', '34', '-fill', '#f3d978', '-stroke', 'none', '-background', '#050b09',
    ...groupSheets.map((entry) => entry.preview), '-tile', '3x', '-geometry', '+34+52',
    '-border', '2', '-bordercolor', '#31533f', master,
  ]);
  console.log(`WROTE ${path.relative(repoRoot, master)}`);
}

function doctor(flags) {
  const result = validateLibraryContract(contract, manifest, { fileExists });
  console.log(`Game art library ${contract.version}; ${contract.groups.length} review groups`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`FAIL ${error}`);
  if (result.errors.length || (flags.strict && result.warnings.length)) process.exitCode = 1;
  else console.log('PASS Library classification, alpha contracts, and coverage are valid.');
}

const { positionals, flags } = parseArguments(process.argv.slice(2));
const [command = 'help'] = positionals;

try {
  if (command === 'doctor') doctor(flags);
  else if (command === 'report') writeReport();
  else if (command === 'contact-sheets') renderContactSheets(flags);
  else if (command === 'all') {
    writeReport();
    renderContactSheets({ ...flags, write: true });
    doctor(flags);
  } else {
    console.log('Usage: node scripts/game-art-library.mjs <doctor|report|contact-sheets|all> [--write] [--replace] [--strict] [--out path]');
  }
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
