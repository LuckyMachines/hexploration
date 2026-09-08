import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildUiQualityReport, sha256File, sourceHash } from './ui-quality-utils.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'xenovoya-ui-quality-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'scene.js'), 'export const scene = true;\n');
  writeFileSync(join(root, 'baseline.png'), 'pixels');
  return root;
}

test('source hashes are stable and change with source input', () => {
  const root = fixture();
  const before = sourceHash(root, ['src/scene.js']);
  assert.equal(before, sourceHash(root, ['src/scene.js']));
  writeFileSync(join(root, 'src', 'scene.js'), 'export const scene = false;\n');
  assert.notEqual(before, sourceHash(root, ['src/scene.js']));
});

test('report rejects a stale source even when a baseline exists', () => {
  const root = fixture();
  const scene = { id: 'scene', label: 'Scene', route: '/', sources: ['src/scene.js'] };
  const baselinePathFor = () => join(root, 'baseline.png');
  const actualPathFor = () => join(root, 'actual.png');
  const approval = { approvedAt: new Date().toISOString(), sourceHash: sourceHash(root, scene.sources), baselineHash: sha256File(baselinePathFor()) };
  let report = buildUiQualityReport({ scenes: [scene], approvals: { scene: approval }, appRoot: root, baselinePathFor, actualPathFor, metrics: [{ id: 'scene' }] });
  assert.equal(report.grade, 'A');
  assert.equal(report.scenes[0].status, 'current');
  writeFileSync(join(root, 'src', 'scene.js'), 'changed');
  report = buildUiQualityReport({ scenes: [scene], approvals: { scene: approval }, appRoot: root, baselinePathFor, actualPathFor, metrics: [{ id: 'scene' }] });
  assert.equal(report.scenes[0].status, 'stale-source');
  assert.equal(report.status, 'attention');
});
