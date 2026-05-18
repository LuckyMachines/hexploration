#!/usr/bin/env node
import {
  buildLocalStackHealth,
  DEFAULT_BROADCAST_FILE,
  DEFAULT_ENV_FILE,
  markdownForLocalStackHealth,
  writeLocalStackHealthReports,
} from './local-stack-doctor-utils.mjs';

const args = process.argv.slice(2);

function flag(name) {
  return args.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
}

function flagValue(name, fallback) {
  const found = flag(name);
  if (!found) return fallback;
  const index = found.indexOf('=');
  return index >= 0 ? found.slice(index + 1) : true;
}

const rpcUrl = String(flagValue('rpc-url', process.env.RPC_URL || 'http://127.0.0.1:9955'));
const envFile = String(flagValue('env-file', DEFAULT_ENV_FILE));
const broadcastFile = String(flagValue('broadcast-file', DEFAULT_BROADCAST_FILE));
const gate = Boolean(flag('gate'));
const markdown = Boolean(flag('markdown'));
const timeoutMs = Number(flagValue('timeout-ms', process.env.LOCAL_STACK_DOCTOR_TIMEOUT_MS || 15_000));

try {
  const report = await buildLocalStackHealth({
    rpcUrl,
    envFile,
    broadcastFile,
    mode: String(flagValue('mode', 'doctor')),
    timeoutMs,
  });
  const paths = await writeLocalStackHealthReports(report);

  if (markdown) {
    process.stdout.write(markdownForLocalStackHealth(report));
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
  process.stderr.write(`[local-stack-doctor] Wrote ${paths.reportJsonPath}\n`);

  if (gate && !report.ok) process.exit(1);
} catch (error) {
  console.error('[local-stack-doctor] Fatal error:', error);
  process.exit(1);
}

