#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  MATERIAL_CHANNELS,
  clippedPixelPercent,
  edgeMeanDifference,
  inspectImage,
  materialOutputPaths,
  materialReviewTemplate,
  runMagick,
  runTool,
  sha256File,
  validateMaterialRuntimeEvidence,
  validateMaterialSystem,
} from './material-pipeline-utils.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(root, 'app', 'src', 'art-pipeline', 'material-system.json');
const system = JSON.parse(readFileSync(manifestPath, 'utf8'));
const command = process.argv[2] || 'doctor';
const requestedId = process.argv.find((arg) => arg.startsWith('--material='))?.split('=')[1] || null;
const strict = process.argv.includes('--strict');
const reportsDirectory = path.join(root, 'reports', 'materials');
const artifactsDirectory = path.join(root, 'artifacts', 'materials');

function readJsonIfPresent(filePath) {
  return existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : null;
}

function markdownReport(report) {
  const lines = [
    '# Material and Lighting Verification',
    '',
    `Generated: ${report.generatedAt}`,
    `System version: ${report.materialSystemVersion}`,
    `Status: ${report.passed ? 'PASS' : 'FAIL'}`,
    '',
    '| Material | Status | Review | Lowest score | Maximum seam | Largest source |',
    '| --- | --- | --- | ---: | ---: | ---: |',
  ];
  for (const material of report.materials) {
    const channels = Object.values(material.evidence).flatMap((group) => Object.values(group));
    const maxSeam = Math.max(...channels.map((entry) => entry.edgeDifference));
    const maxBytes = Math.max(...channels.map((entry) => entry.bytes));
    const scores = Object.values(material.review?.scores || {}).filter(Number.isFinite);
    const minimumScore = scores.length ? Math.min(...scores) : 'n/a';
    lines.push(`| ${material.materialId} | ${material.passed ? 'pass' : 'fail'} | ${material.review?.decision || 'missing'} | ${minimumScore} | ${maxSeam.toFixed(2)} | ${Math.round(maxBytes / 1024)} KiB |`);
  }
  if (report.runtime?.board?.states?.length) {
    lines.push('', '## Integrated board metrics', '');
    for (const state of report.runtime.board.states) lines.push(`- ${state.lens}: ${state.drawCalls} draw calls, ${state.triangles} triangles, ${state.textures} resident textures, ${state.lightingRig} rig.`);
  }
  if (report.runtime?.frame) {
    lines.push(`- Headless frame p95: ${report.runtime.frame.frameP95Ms} ms at ${report.runtime.frame.pixelRatio}x pixel ratio (${report.runtime.frame.quality}).`);
  }
  const issues = report.materials.flatMap((material) => [...material.failures, ...material.warnings].map((issue) => `${material.materialId}: ${issue}`));
  lines.push('', '## Findings', '');
  if (report.contractErrors.length === 0 && report.runtimeErrors.length === 0 && issues.length === 0) lines.push('- No contract, provenance, seam, compression, runtime-budget, or review failures.');
  for (const error of report.contractErrors) lines.push(`- Contract: ${error}`);
  for (const error of report.runtimeErrors) lines.push(`- Runtime: ${error}`);
  for (const issue of issues) lines.push(`- ${issue}`);
  return `${lines.join('\n')}\n`;
}

function selectedProfiles() {
  const profiles = requestedId ? system.materials.filter((profile) => profile.id === requestedId) : system.materials;
  if (!profiles.length) throw new Error(`Unknown material: ${requestedId}`);
  return profiles;
}

function edgeBlendSeamlessBase(normalized, output, temporary) {
  const [width, height] = system.qualityContract.dimensions;
  const blendBand = Math.max(16, Math.round(width * 0.09375));
  const horizontalMirror = path.join(temporary, 'edge-horizontal-mirror.png');
  const verticalMirror = path.join(temporary, 'edge-vertical-mirror.png');
  const horizontalMask = path.join(temporary, 'edge-horizontal-mask.png');
  const verticalMask = path.join(temporary, 'edge-vertical-mask.png');
  const overlay = path.join(temporary, 'edge-overlay.png');
  const horizontal = path.join(temporary, 'edge-horizontal.png');
  runMagick([normalized, '-flop', horizontalMirror], 'prepare opposing horizontal edges');
  runMagick(['-size', `${width}x${height}`, 'xc:black', '-fx', `0.5*(1-min(1,min(i,w-1-i)/${blendBand}))`, horizontalMask], 'author horizontal edge blend');
  runMagick([horizontalMirror, horizontalMask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', overlay], 'mask horizontal edge blend');
  runMagick([normalized, overlay, '-compose', 'over', '-composite', horizontal], 'apply horizontal edge blend');
  runMagick([horizontal, '-flip', verticalMirror], 'prepare opposing vertical edges');
  runMagick(['-size', `${width}x${height}`, 'xc:black', '-fx', `0.5*(1-min(1,min(j,h-1-j)/${blendBand}))`, verticalMask], 'author vertical edge blend');
  runMagick([verticalMirror, verticalMask, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', overlay], 'mask vertical edge blend');
  runMagick([horizontal, overlay, '-compose', 'over', '-composite', '-quality', '84', output], `write ${path.basename(output)}`);
}

function seamlessBase(source, output, temporary, { side = false, seamMode = 'mirrored' } = {}) {
  const [width, height] = system.qualityContract.dimensions;
  const normalized = path.join(temporary, `${side ? 'side-' : ''}normalized.png`);
  const doubled = path.join(temporary, `${side ? 'side-' : ''}doubled.png`);
  const sourceArgs = side
    ? [source, '-auto-orient', '-strip', '-resize', `${Math.round(width * 0.095)}x${height}!`, '-resize', `${width}x${height}!`, '-blur', '0x0.55', '+sigmoidal-contrast', '2.2,50%', '-modulate', '103,82,100', normalized]
    : [source, '-auto-orient', '-strip', '-resize', `${width}x${height}^`, '-gravity', 'center', '-extent', `${width}x${height}`, '+sigmoidal-contrast', '2.2,50%', '-modulate', '103,86,100', normalized];
  runMagick(sourceArgs, `normalize ${path.basename(source)}${side ? ' sidewall' : ''}`);
  if (!side && seamMode === 'edge-blend') {
    edgeBlendSeamlessBase(normalized, output, temporary);
    return;
  }
  runMagick([normalized, '(', '+clone', '-flop', ')', '+append', '(', '+clone', '-flip', ')', '-append', doubled], 'construct seamless material field');
  runMagick([doubled, '-crop', `${width}x${height}+${width / 2}+${height / 2}`, '+repage', '-quality', '84', output], `write ${path.basename(output)}`);
}

function scalarMaps(baseColor, paths) {
  runMagick([baseColor, '-colorspace', 'gray', '-virtual-pixel', 'tile', '-blur', '0x0.8', '-level', '8%,92%', '-quality', '86', paths.height], 'derive height');
  runMagick([paths.height, '-negate', '-evaluate', 'multiply', '0.28', '-evaluate', 'add', '68%', '-quality', '86', paths.roughness], 'derive roughness');
  runMagick([paths.height, '-blur', '0x4', '-evaluate', 'multiply', '0.2', '-evaluate', 'add', '76%', '-quality', '86', paths.ao], 'derive ambient occlusion');
  runMagick([baseColor, '-colorspace', 'gray', '-threshold', '78%', '-blur', '0x1.2', '-evaluate', 'multiply', '0.52', '-quality', '86', paths.emissive], 'derive localized emissive mask');
}

function normalMap(height, output, temporary, prefix) {
  const [width, imageHeight] = system.qualityContract.dimensions;
  const red = path.join(temporary, `${prefix}-normal-r.png`);
  const green = path.join(temporary, `${prefix}-normal-g.png`);
  const blue = path.join(temporary, `${prefix}-normal-b.png`);
  const sobelArgs = ['-virtual-pixel', 'tile', '-define', 'convolve:scale=4!', '-bias', '50%'];
  const centerGradient = ['-evaluate', 'multiply', '0.12', '-evaluate', 'add', '44%'];
  runMagick([height, ...sobelArgs, '-morphology', 'Convolve', 'Sobel:0', ...centerGradient, red], 'derive normal x');
  runMagick([height, ...sobelArgs, '-morphology', 'Convolve', 'Sobel:90', '-negate', ...centerGradient, green], 'derive normal y');
  runMagick(['-size', `${width}x${imageHeight}`, 'xc:white', blue], 'derive normal z');
  runMagick([red, green, blue, '-combine', '-quality', '88', output], 'combine tangent normal');
}

function packageKtx2(input, output, temporary, channel, prefix) {
  const png = path.join(temporary, `${prefix}-${channel}.png`);
  runMagick([input, '-strip', png], `prepare ${channel} for KTX2`);
  const colorSpace = channel === 'baseColor' ? 'srgb' : 'linear';
  const encodeArgs = channel === 'normal'
    ? ['--encode', 'uastc', '--uastc_quality', '2', '--zcmp', '8']
    : ['--encode', 'etc1s', '--clevel', '3', '--qlevel', channel === 'baseColor' ? '190' : '150'];
  runTool('toktx', [...encodeArgs, '--genmipmap', '--assign_oetf', colorSpace, '--target_type', 'RGB', output, png], `package ${channel} as KTX2`, { quiet: true });
}

function generateProfile(profile) {
  const source = path.resolve(root, profile.source);
  if (!existsSync(source)) throw new Error(`${profile.id}: source does not exist: ${profile.source}`);
  const directory = path.resolve(root, profile.directory);
  const temporary = path.join(directory, '.material-tmp');
  mkdirSync(temporary, { recursive: true });
  const top = materialOutputPaths(root, profile);
  const side = materialOutputPaths(root, profile, { side: true });
  try {
    seamlessBase(source, top.baseColor, temporary, { seamMode: profile.seamMode });
    scalarMaps(top.baseColor, top);
    normalMap(top.height, top.normal, temporary, 'top');
    seamlessBase(source, side.baseColor, temporary, { side: true });
    scalarMaps(side.baseColor, side);
    normalMap(side.height, side.normal, temporary, 'side');
    const topKtx2 = {};
    const sideKtx2 = {};
    for (const channel of MATERIAL_CHANNELS) {
      topKtx2[channel] = top[channel].replace(/\.webp$/, '.ktx2');
      sideKtx2[channel] = side[channel].replace(/\.webp$/, '.ktx2');
      packageKtx2(top[channel], topKtx2[channel], temporary, channel, 'top');
      packageKtx2(side[channel], sideKtx2[channel], temporary, channel, 'side');
    }
    const receipt = {
      materialSystemVersion: system.version,
      materialId: profile.id,
      generatedAt: new Date().toISOString(),
      source: profile.source,
      sourceSha256: sha256File(source),
      process: profile.seamMode === 'edge-blend'
        ? 'neutralize -> localized opposing-edge blend -> scalar maps -> tangent normal; mirrored sidewall derivation'
        : 'neutralize -> mirrored seamless field -> scalar maps -> tangent normal',
      top: Object.fromEntries(Object.entries(top).map(([channel, file]) => [channel, { path: path.relative(root, file).replaceAll('\\', '/'), sha256: sha256File(file) }])),
      side: Object.fromEntries(Object.entries(side).map(([channel, file]) => [channel, { path: path.relative(root, file).replaceAll('\\', '/'), sha256: sha256File(file) }])),
      compressedTop: Object.fromEntries(Object.entries(topKtx2).map(([channel, file]) => [channel, { path: path.relative(root, file).replaceAll('\\', '/'), sha256: sha256File(file) }])),
      compressedSide: Object.fromEntries(Object.entries(sideKtx2).map(([channel, file]) => [channel, { path: path.relative(root, file).replaceAll('\\', '/'), sha256: sha256File(file) }])),
    };
    writeFileSync(path.join(directory, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    const reviewPath = path.join(directory, 'review.json');
    if (!existsSync(reviewPath)) {
      const review = materialReviewTemplate(system, profile, top);
      review.sourceSha256 = receipt.sourceSha256;
      writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
    }
    process.stdout.write(`GENERATED ${profile.id}\n`);
  } finally {
    if (existsSync(temporary)) rmSync(temporary, { recursive: true, force: true });
  }
}

function auditProfile(profile) {
  const failures = [];
  const warnings = [];
  const groups = [
    ['top', materialOutputPaths(root, profile)],
    ['side', materialOutputPaths(root, profile, { side: true })],
  ];
  const evidence = {};
  for (const [groupId, files] of groups) {
    evidence[groupId] = {};
    for (const channel of MATERIAL_CHANNELS) {
      const file = files[channel];
      const inspection = inspectImage(file);
      if (!inspection) {
        failures.push(`${groupId}.${channel} is missing`);
        continue;
      }
      const edgeDifference = edgeMeanDifference(file, inspection.width, inspection.height);
      const bytes = readFileSync(file).byteLength;
      const clipping = channel === 'baseColor' ? clippedPixelPercent(file) : null;
      evidence[groupId][channel] = { ...inspection, bytes, edgeDifference, clipping, sha256: sha256File(file) };
      const [expectedWidth, expectedHeight] = system.qualityContract.dimensions;
      if (inspection.width !== expectedWidth || inspection.height !== expectedHeight) failures.push(`${groupId}.${channel} must be ${expectedWidth}x${expectedHeight}`);
      if (inspection.format.toUpperCase() !== 'WEBP') failures.push(`${groupId}.${channel} must be WebP`);
      if (bytes > system.qualityContract.maxBytesPerMap) failures.push(`${groupId}.${channel} exceeds ${system.qualityContract.maxBytesPerMap} bytes`);
      if (edgeDifference > system.qualityContract.maxEdgeMeanDifference) failures.push(`${groupId}.${channel} seam score ${edgeDifference.toFixed(2)} exceeds ${system.qualityContract.maxEdgeMeanDifference}`);
      if (clipping?.shadows > system.qualityContract.maxShadowClipPercent) warnings.push(`${groupId}.baseColor shadow clipping is ${clipping.shadows.toFixed(2)}%`);
      if (clipping?.highlights > system.qualityContract.maxHighlightClipPercent) warnings.push(`${groupId}.baseColor highlight clipping is ${clipping.highlights.toFixed(2)}%`);
      const compressed = file.replace(/\.webp$/, '.ktx2');
      if (!existsSync(compressed)) failures.push(`${groupId}.${channel} KTX2 package is missing`);
      else evidence[groupId][channel].ktx2 = { bytes: readFileSync(compressed).byteLength, sha256: sha256File(compressed) };
    }
  }
  const reviewPath = path.resolve(root, profile.directory, 'review.json');
  const review = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, 'utf8')) : null;
  if (!review) warnings.push('relational review is missing');
  else {
    const source = path.resolve(root, profile.source);
    if (review.materialSystemVersion !== system.version) failures.push('relational review targets a stale material-system version');
    if (review.sourceSha256 !== sha256File(source)) failures.push('relational review source fingerprint is stale');
    for (const channel of MATERIAL_CHANNELS) {
      const file = materialOutputPaths(root, profile)[channel];
      if (review.candidateSha256?.[channel] !== sha256File(file)) failures.push(`relational review ${channel} fingerprint is stale`);
    }
    const scores = Object.values(review.scores || {});
    if (review.decision !== 'approved') warnings.push('relational review is pending');
    if (scores.length !== 6 || scores.some((score) => !Number.isFinite(score) || score < system.qualityContract.minimumRelationalScore)) warnings.push(`relational review scores must all reach ${system.qualityContract.minimumRelationalScore}/4`);
  }
  return {
    materialId: profile.id,
    passed: failures.length === 0 && (!strict || warnings.length === 0),
    failures,
    warnings,
    evidence,
    review: review ? { reviewer: review.reviewer, reviewedAt: review.reviewedAt, decision: review.decision, scores: review.scores } : null,
  };
}

function option(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || null;
}

function reviewProfile() {
  const profiles = selectedProfiles();
  if (profiles.length !== 1) throw new Error('Review requires exactly one --material=id.');
  const reviewer = option('reviewer');
  const decision = option('decision');
  const notes = option('notes') || '';
  const scoreInput = option('scores');
  if (!reviewer || !['approved', 'rejected'].includes(decision) || !scoreInput) throw new Error('Review requires --reviewer, --decision=approved|rejected, and --scores=tileability:3,...');
  const profile = profiles[0];
  const files = materialOutputPaths(root, profile);
  const review = materialReviewTemplate(system, profile, files);
  review.sourceSha256 = sha256File(path.resolve(root, profile.source));
  review.reviewer = reviewer;
  review.reviewedAt = new Date().toISOString();
  review.decision = decision;
  review.notes = notes;
  for (const pair of scoreInput.split(',')) {
    const [key, rawValue] = pair.split(':');
    if (Object.hasOwn(review.scores, key)) review.scores[key] = Number(rawValue);
  }
  const invalid = Object.entries(review.scores).filter(([, score]) => !Number.isFinite(score) || score < 0 || score > 4);
  if (invalid.length) throw new Error(`Missing or invalid review scores: ${invalid.map(([key]) => key).join(', ')}`);
  const reviewPath = path.resolve(root, profile.directory, 'review.json');
  writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
  process.stdout.write(`REVIEWED ${profile.id}: ${decision}\n`);
}

function doctor() {
  const contractErrors = validateMaterialSystem(system);
  const materials = selectedProfiles().map(auditProfile);
  const runtime = {
    board: readJsonIfPresent(path.join(artifactsDirectory, 'renders', 'board-runtime-metrics.json')),
    frame: readJsonIfPresent(path.join(artifactsDirectory, 'renders', 'runtime-metrics.json')),
  };
  const runtimeErrors = requestedId ? [] : validateMaterialRuntimeEvidence(runtime, system);
  const report = {
    generatedAt: new Date().toISOString(),
    materialSystemVersion: system.version,
    passed: contractErrors.length === 0 && runtimeErrors.length === 0 && materials.every((item) => item.passed),
    strict,
    contractErrors,
    runtimeErrors,
    materials,
    runtime,
  };
  mkdirSync(reportsDirectory, { recursive: true });
  writeFileSync(path.join(reportsDirectory, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(reportsDirectory, 'latest.md'), markdownReport(report));
  for (const error of contractErrors) process.stderr.write(`FAIL ${error}\n`);
  for (const error of runtimeErrors) process.stderr.write(`FAIL runtime: ${error}\n`);
  for (const item of materials) {
    for (const failure of item.failures) process.stderr.write(`FAIL ${item.materialId}: ${failure}\n`);
    for (const warning of item.warnings) process.stdout.write(`WARN ${item.materialId}: ${warning}\n`);
    if (!item.failures.length) process.stdout.write(`PASS ${item.materialId}: technical surface contract\n`);
  }
  if (!report.passed) process.exitCode = 1;
  else process.stdout.write('PASS material and lighting system doctor\n');
}

function contactSheet() {
  mkdirSync(artifactsDirectory, { recursive: true });
  const files = [];
  for (const profile of selectedProfiles()) {
    const maps = materialOutputPaths(root, profile);
    for (const channel of MATERIAL_CHANNELS) files.push(maps[channel]);
  }
  const output = path.join(artifactsDirectory, requestedId ? `${requestedId}-channels.png` : 'material-channel-contact-sheet.png');
  runMagick(['montage', ...files, '-thumbnail', '190x190', '-set', 'label', '%t', '-tile', '6x', '-geometry', '190x190+10+28', '-background', '#0d0f0a', '-fill', '#d7d4bd', output], 'build material contact sheet');
  process.stdout.write(`${output}\n`);
}

function renderSheet() {
  mkdirSync(artifactsDirectory, { recursive: true });
  const renderDirectory = path.join(artifactsDirectory, 'renders');
  const materialRenders = system.materials
    .map((profile) => path.join(renderDirectory, `lookdev-${profile.id}-neutral.png`))
    .filter(existsSync);
  const rigRenders = system.qualityContract.captureRigs
    .map((rigId) => path.join(renderDirectory, `lookdev-${rigId}.png`))
    .filter(existsSync);
  if (!materialRenders.length) throw new Error('No browser material renders found. Run npm run material:capture first.');
  const materialOutput = path.join(artifactsDirectory, 'lookdev-material-contact-sheet.png');
  runMagick(['montage', ...materialRenders, '-thumbnail', '640x420', '-set', 'label', '%t', '-tile', '3x2', '-geometry', '640x420+14+30', '-background', '#0d0f0a', '-fill', '#d7d4bd', materialOutput], 'build look-dev material sheet');
  process.stdout.write(`${materialOutput}\n`);
  if (rigRenders.length) {
    const rigOutput = path.join(artifactsDirectory, 'lookdev-lighting-contact-sheet.png');
    runMagick(['montage', ...rigRenders, '-thumbnail', '640x420', '-set', 'label', '%t', '-tile', '2x2', '-geometry', '640x420+14+30', '-background', '#0d0f0a', '-fill', '#d7d4bd', rigOutput], 'build look-dev lighting sheet');
    process.stdout.write(`${rigOutput}\n`);
  }
}

const commands = {
  generate: () => selectedProfiles().forEach(generateProfile),
  doctor,
  report: doctor,
  review: reviewProfile,
  'contact-sheet': contactSheet,
  'render-sheet': renderSheet,
};

if (!commands[command]) {
  process.stderr.write('Usage: node scripts/material-pipeline.mjs <generate|doctor|report|review|contact-sheet|render-sheet> [--material=id] [--strict]\n');
  process.exitCode = 1;
} else {
  const contractErrors = validateMaterialSystem(system);
  if (contractErrors.length && command !== 'doctor' && command !== 'report') throw new Error(contractErrors.join('\n'));
  commands[command]();
}
