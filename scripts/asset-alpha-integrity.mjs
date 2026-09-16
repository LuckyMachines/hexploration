#!/usr/bin/env node

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directories = [
  path.join(repoRoot, 'app/public/images/art/characters'),
  path.join(repoRoot, 'app/public/images/art/props'),
];
const failures = [];

for (const directory of directories) {
  for (const name of readdirSync(directory).filter((entry) => entry.endsWith('.png'))) {
    const filePath = path.join(directory, name);
    const rows = execFileSync('magick', [filePath, '-alpha', 'extract', '-scale', '1x256!', '-depth', '8', 'txt:-'], {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
    const values = rows.split(/\r?\n/).map((line) => line.match(/\((\d+),\d+,\d+\)/)?.[1]).filter(Boolean).map(Number);
    const edgeBand = values.some((value, index) => (index < 12 || index > 230) && value >= 242);
    if (edgeBand) failures.push(path.relative(repoRoot, filePath).replaceAll('\\', '/'));
  }
}

if (failures.length) {
  console.error('Opaque full-width alpha edge detected:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('PASS: no character or prop PNG contains an opaque full-width edge band');
