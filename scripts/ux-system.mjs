#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeFriction, auditCopyFiles, evaluateAutomatedEvidence, evaluateJourneyEvidence, summarizeResearch, validateResearchSession, validateUXContract } from './ux-system-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT_PATH = resolve(root, 'ux/quality-contract.json');
const PLAYTESTS_PATH = resolve(root, 'improvement/records/playtests.json');
const JOURNEY_REPORT_PATH = resolve(root, 'reports/ux/journeys/latest.json');
const BROWSER_REPORT_ROOT = resolve(root, 'reports/ux/browser');
const REPORT_PATH = resolve(root, 'reports/ux/latest.json');
const PUBLIC_REPORT_PATH = resolve(root, 'app/public/ux/latest.json');

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function flag(args, name, fallback = '') {
  const prefix = `--${name}=`;
  const value = args.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function requiredFlag(args, name) {
  const value = flag(args, name);
  if (!value) throw new Error(`Missing --${name}=...`);
  return value;
}

function taskFlag(args) {
  const value = requiredFlag(args, 'tasks');
  if (value.trim().startsWith('{')) return JSON.parse(value);
  return Object.fromEntries(value.split(',').filter(Boolean).map((entry) => {
    const separator = entry.lastIndexOf(':');
    if (separator < 1) throw new Error('--tasks entries must use task-id:pass|struggle|fail');
    return [entry.slice(0, separator), entry.slice(separator + 1)];
  }));
}

function filesBelow(path) {
  if (!existsSync(path)) return [];
  const output = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const absolute = resolve(path, entry.name);
    if (entry.isDirectory()) output.push(...filesBelow(absolute));
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) output.push({ path: relative(root, absolute).replaceAll('\\', '/'), content: readFileSync(absolute, 'utf8') });
  }
  return output;
}

function loadTelemetry(args) {
  const input = flag(args, 'input');
  if (!input) return { status: 'unavailable', source: null, events: [], reason: 'No production export was supplied. Use --input=path.' };
  const absolute = resolve(root, input);
  const payload = readJson(absolute);
  if (!payload || !Array.isArray(payload.events)) throw new Error(`Telemetry export is invalid: ${absolute}`);
  const production = payload.source === 'production' && Boolean(payload.exportedAt);
  return { status: production ? 'current' : 'non-production', source: relative(root, absolute).replaceAll('\\', '/'), events: payload.events, exportedAt: payload.exportedAt || null };
}

function runCopyAudit(contract) {
  const files = contract.copy.scanRoots.flatMap((path) => filesBelow(resolve(root, path)));
  return auditCopyFiles(files, contract.copy);
}

function protocol(contract) {
  const lines = [
    '# Xenovoya observed-player session',
    '',
    'Do not teach, lead, or rescue unless the participant is fully blocked. Record behavior before interpretation. Do not store names, emails, wallet addresses, video, or raw transaction identifiers.',
    '',
    '## Before the session',
    '',
    '- Confirm consent for anonymous notes.',
    '- Choose cohort: first-time or returning.',
    '- Start from a clean browser profile for first-time sessions.',
    '- Ask the participant to think aloud without explaining the interface.',
    '',
    '## Tasks',
    '',
    ...contract.research.requiredTaskIds.map((task, index) => `${index + 1}. ${task}`),
    '',
    'Grade each task as pass, struggle, or fail. Record first-action time, wrong turns, help requests, errors, recovery time, delight (1-5), and return intent (1-5).',
    '',
    '## Record command',
    '',
    '```bash',
    "npm run ux:research:record -- --id=session-YYYYMMDD-01 --cohort=first-time '--tasks=explain-promise:pass,make-first-decision:struggle,predict-consequence:pass,recover-from-error:pass,name-return-reason:pass' '--observations=Anonymous behavioral notes' --delight=4 --return-intent=5 --severity=medium '--decision=Keep or change...' --owner=initials",
    '```',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function recordResearch(args, contract) {
  const tasks = taskFlag(args);
  const delight = Number(requiredFlag(args, 'delight'));
  const returnIntent = Number(requiredFlag(args, 'return-intent'));
  if (![delight, returnIntent].every((value) => Number.isInteger(value) && value >= 1 && value <= 5)) throw new Error('--delight and --return-intent must be integers from 1 to 5');
  const severity = flag(args, 'severity', 'medium');
  if (!['low', 'medium', 'high', 'critical'].includes(severity)) throw new Error('--severity must be low, medium, high, or critical');
  const observation = requiredFlag(args, 'observations');
  const session = {
    id: requiredFlag(args, 'id'),
    surface: 'player-validation',
    scenario: flag(args, 'scenario', 'first-and-return-loop'),
    cohort: requiredFlag(args, 'cohort'),
    objective: 'Observe comprehension, delight, pacing, recovery, and return intent without coaching.',
    hypothesis: flag(args, 'hypothesis', 'The player can make and explain a meaningful decision, recover, and name a reason to return.'),
    baseline: flag(args, 'baseline', 'not-recorded'),
    observations: observation,
    tasks,
    delight,
    returnIntent,
    evidence: flag(args, 'evidence') ? flag(args, 'evidence').split(',').filter(Boolean) : [],
    severity,
    grade: flag(args, 'grade', 'pending'),
    confidence: flag(args, 'confidence', 'medium'),
    decision: requiredFlag(args, 'decision'),
    owner: requiredFlag(args, 'owner'),
    nextExperiment: flag(args, 'next-experiment', 'Repeat with the next representative participant.'),
    consentSafe: true,
    recordedAt: new Date().toISOString(),
  };
  const validation = validateResearchSession(session, contract.research);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  const store = readJson(PLAYTESTS_PATH, { schemaVersion: 1, sessions: [] });
  if (store.sessions.some((entry) => entry.id === session.id)) throw new Error(`Duplicate session id: ${session.id}`);
  store.sessions.push(session);
  store.updatedAt = new Date().toISOString();
  writeJson(PLAYTESTS_PATH, store);
  console.log(`Recorded consent-safe session ${session.id} in ${PLAYTESTS_PATH}`);
}

function buildReport(args, contract) {
  const now = new Date();
  const playtests = readJson(PLAYTESTS_PATH, { sessions: [] });
  const research = summarizeResearch(playtests.sessions || [], contract.research, now);
  const journeyEvidence = evaluateJourneyEvidence(readJson(JOURNEY_REPORT_PATH, {}), contract.journeys);
  const browserEvidence = evaluateAutomatedEvidence(
    Object.fromEntries((contract.automatedEvidence?.suites || []).map((suite) => [suite.id, readJson(resolve(BROWSER_REPORT_ROOT, `${suite.id}.json`))])),
    contract.automatedEvidence,
    now,
  );
  const copy = runCopyAudit(contract);
  const telemetry = loadTelemetry(args);
  const friction = analyzeFriction(telemetry.events, contract.frictionRules);
  const automationPass = copy.status === 'pass' && journeyEvidence.status === 'pass' && browserEvidence.status === 'pass';
  const releaseReady = automationPass && research.status === 'current' && telemetry.status === 'current' && friction.findings.every((finding) => finding.severity !== 'critical');
  const report = {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    contractVersion: contract.version,
    grade: releaseReady ? 'A' : automationPass ? 'A-' : journeyEvidence.status === 'missing' ? 'B' : 'C',
    automationPass,
    releaseReady,
    gates: {
      journeyEvidence,
      browserEvidence,
      copy,
      research,
      telemetry: { status: telemetry.status, source: telemetry.source, exportedAt: telemetry.exportedAt || null, eventCount: telemetry.events.length, reason: telemetry.reason || null },
      friction,
    },
    nextActions: [
      ...(journeyEvidence.status !== 'pass' ? ['Run npm run ux:journeys.'] : []),
      ...(browserEvidence.status !== 'pass' ? browserEvidence.results.filter(({ status }) => status !== 'pass').map(({ id }) => `Run npm run ux:${id}.`) : []),
      ...(copy.status !== 'pass' ? ['Replace prohibited vague copy with contextual state and recovery language.'] : []),
      ...(research.status !== 'current' ? research.missingCohorts.map(({ cohort, have, need }) => `Observe ${need - have} more ${cohort} player session(s).`) : []),
      ...(telemetry.status !== 'current' ? ['Export production UX events and rerun with --input=path.'] : []),
      ...(friction.topPriority ? [`Address friction: ${friction.topPriority.title}.`] : []),
    ],
  };
  writeJson(REPORT_PATH, report);
  writeJson(PUBLIC_REPORT_PATH, report);
  return report;
}

function printReport(report) {
  console.log(`UX system grade: ${report.grade}`);
  console.log(`Automated contracts: ${report.automationPass ? 'PASS' : 'NOT READY'}`);
  console.log(`Release evidence: ${report.releaseReady ? 'READY' : 'NOT READY'}`);
  console.log(`Journey budgets: ${report.gates.journeyEvidence.status}`);
  console.log(`Input, assistive, and touch evidence: ${report.gates.browserEvidence.status}`);
  console.log(`Copy governance: ${report.gates.copy.status} (${report.gates.copy.findings.length} finding(s))`);
  console.log(`Observed research: ${report.gates.research.validSessions}/${report.gates.research.totalSessions} valid session(s), ${report.gates.research.status}`);
  console.log(`Production telemetry: ${report.gates.telemetry.status}`);
  if (report.gates.friction.topPriority) console.log(`Top friction: ${report.gates.friction.topPriority.title}`);
  for (const action of report.nextActions) console.log(`NEXT: ${action}`);
}

function help() {
  console.log(`Xenovoya UX evidence system

  report [--input=production-export.json]
  doctor [--input=production-export.json] [--release]
  copy
  friction --input=telemetry-export.json
  research protocol
  research report
  research record --id --cohort --tasks --observations --delight --return-intent --severity --decision --owner`);
}

try {
  const args = process.argv.slice(2);
  const command = args[0] || 'report';
  const contract = readJson(CONTRACT_PATH);
  if (!contract) throw new Error(`Missing UX contract: ${CONTRACT_PATH}`);
  const contractValidation = validateUXContract(contract);
  if (!contractValidation.ok) throw new Error(`Invalid UX contract: ${contractValidation.errors.join('; ')}`);
  if (command === 'research' && args[1] === 'protocol') protocol(contract);
  else if (command === 'research' && args[1] === 'record') recordResearch(args.slice(2), contract);
  else if (command === 'research' && args[1] === 'report') {
    const summary = summarizeResearch(readJson(PLAYTESTS_PATH, { sessions: [] }).sessions || [], contract.research);
    console.log(JSON.stringify(summary, null, 2));
  } else if (command === 'copy') {
    const result = runCopyAudit(contract);
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'pass') process.exitCode = 1;
  } else if (command === 'friction') {
    const telemetry = loadTelemetry(args.slice(1));
    const result = analyzeFriction(telemetry.events, contract.frictionRules);
    console.log(JSON.stringify({ telemetryStatus: telemetry.status, ...result }, null, 2));
  } else if (command === 'report' || command === 'doctor') {
    const report = buildReport(args.slice(1), contract);
    printReport(report);
    if (!report.automationPass || (args.includes('--release') && !report.releaseReady)) process.exitCode = 1;
  } else help();
} catch (error) {
  console.error(`UX system failed: ${error.message}`);
  process.exitCode = 1;
}
