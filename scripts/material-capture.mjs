#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(root, 'app');
const forwarded = process.argv.slice(2);
const projects = forwarded.some((argument) => argument.startsWith('--project='))
  ? []
  : ['--project=chromium-desktop'];
const result = spawnSync(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', 'e2e/material-system.spec.js', ...projects, ...forwarded],
  {
    cwd: appRoot,
    env: { ...process.env, VITE_ENABLE_INTERNAL_TOOLS: 'true' },
    stdio: 'inherit',
    windowsHide: true,
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
