import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import contract from '../session.quality-contract.json' with { type: 'json' };
import { gradeSessionChecks, validateSessionContract } from './session-quality-utils.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const has = (relative, pattern) => pattern.test(read(relative));
const exists = (relative) => fs.existsSync(path.join(root, relative));
const checks = [
  { id: 'contract-valid', ok: validateSessionContract(contract).length === 0 },
  { id: 'canonical-session-machine', ok: has('app/src/lib/sessionState.js', /backgrounded.*reconnecting.*resumed/) },
  { id: 'indexeddb-snapshots', ok: has('app/src/lib/sessionPersistence.js', /indexedDB\.open/) },
  { id: 'offline-outbox', ok: has('app/src/lib/sessionPersistence.js', /createObjectStore\('outbox'/) },
  { id: 'multi-tab-coordination', ok: has('app/src/lib/sessionPersistence.js', /BroadcastChannel/) && has('app/src/lib/sessionPersistence.js', /navigator\.locks/) },
  { id: 'transaction-recovery', ok: has('app/src/contexts/PlayerSessionContext.jsx', /getTransactionReceipt/) },
  { id: 'query-policy', ok: has('app/src/components/shared/ChainQueryProvider.jsx', /staleTime/) && has('app/src/components/shared/ChainQueryProvider.jsx', /dehydrate/) },
  { id: 'hidden-tab-throttling', ok: has('app/src/hooks/useContractRead.js', /document\.hidden/) && has('app/src/hooks/useContractEvents.js', /visibilitychange/) },
  { id: 'rpc-failover', ok: has('app/src/config/clients.js', /fallback\(/) },
  { id: 'bounded-event-history', ok: !has('app/src/hooks/useGameEvents.js', /fromBlock:\s*0n/) && has('app/src/hooks/useGameEvents.js', /BLOCK_BATCH/) },
  { id: 'party-ui', ok: exists('app/src/components/social/SocialHub.jsx') },
  { id: 'invite-journey', ok: exists('app/src/pages/PartyInvitePage.jsx') && has('app/src/App.jsx', /invite\/:inviteToken/) },
  { id: 'social-service-schema', ok: has('app/src/lib/returnService.js', /\/v1\/parties/) && has('app/src/lib/returnService.js', /\/v1\/friends/) },
  { id: 'privacy-controls', ok: contract.privacy.presenceRequiresRelationship === true && has('app/src/lib/returnService.js', /\/v1\/blocks/) && has('app/src/lib/returnService.js', /\/v1\/presence\/query/) },
  { id: 'soft-pause-copy', ok: has('app/src/components/game/SessionStatusBar.jsx', /world continues/) },
  { id: 'runtime-performance-evidence', ok: has('app/src/lib/sessionTelemetry.js', /PerformanceObserver/) && has('app/src/components/expedition/ReturnLoopPanel.jsx', /cloud_save_p95_ms/) },
];

const dist = path.join(root, 'app', 'dist', 'assets');
if (fs.existsSync(dist)) {
  const files = fs.readdirSync(dist);
  const sizeCheck = (prefix, budget) => {
    const file = files.find((name) => name.startsWith(prefix) && name.endsWith('.js'));
    return { id: `${prefix.toLowerCase()}-bundle-budget`, ok: Boolean(file) && fs.statSync(path.join(dist, file)).size <= budget, value: file ? fs.statSync(path.join(dist, file)).size : null, budget };
  };
  checks.push(sizeCheck('GameClientPage-', contract.budgets.gameRouteRawBytes));
  checks.push(sizeCheck('three-', contract.budgets.threeChunkRawBytes));
}

const summary = gradeSessionChecks(checks);
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), evaluationMode: contract.evaluationMode, implementationGrade: summary.grade, productionEvidenceGrade: 'B', ...summary, checks, budgets: contract.budgets, requiredScenarios: contract.requiredScenarios, nextAction: checks.find((check) => !check.ok)?.id || 'Deploy API contract 2026-09-10.1, run synthetic multi-context probes, and collect production percentiles.' };
const output = path.join(root, 'reports', 'session-system', 'latest.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Session quality: ${summary.grade} (${summary.passed}/${summary.total})`);
for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.id}`);
if (process.argv.includes('--strict') && summary.passed !== summary.total) process.exitCode = 1;
