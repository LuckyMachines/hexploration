#!/usr/bin/env node
import { existsSync } from 'fs';
import {
  buildDailyBrief,
  buildLabIndex,
  createDecision,
  generateAutoSummaryEntry,
  labDoctor,
  labScenarioPaths,
  loadLabMemory,
  loadLabState,
  markdownForDailyBrief,
  markdownForLabEntry,
  validateDecisionInput,
  writeDailyBrief,
  writeLabDecision,
  writeLabEntry,
  writeLabIndex,
} from './scenario-lab-notebook-utils.mjs';
import { readJson, slugify } from './scenario-utils.mjs';

const argv = process.argv.slice(2);
const commands = new Set(['entry', 'daily', 'decision', 'latest', 'doctor']);
const command = commands.has(argv[0]) ? argv[0] : argv.length > 0 ? 'entry' : 'doctor';
const rest = commands.has(argv[0]) ? argv.slice(1) : argv;

function arg(name, fallback) {
  const found = rest.find((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!found) return fallback;
  const eq = found.indexOf('=');
  return eq >= 0 ? found.slice(eq + 1) : true;
}

function boolArg(name, fallback = false) {
  const value = arg(name, fallback);
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'no'].includes(String(value).toLowerCase());
}

function positional() {
  return rest.filter((value) => !value.startsWith('--')).join(' ').trim();
}

function scenarioId() {
  const id = arg('id', arg('scenario', positional()));
  if (!id) throw new Error('Provide --id=<scenario-id>.');
  return slugify(String(id));
}

function print(value, markdown = false) {
  if (markdown) console.log(typeof value === 'string' ? value : markdownForLabEntry(value));
  else console.log(JSON.stringify(value, null, 2));
}

function loadMemory() {
  return loadLabMemory({ refreshMemory: boolArg('refresh-memory', false), includeRaw: true });
}

function refreshIndex(memory) {
  const index = buildLabIndex({ memory });
  writeLabIndex(index);
  return index;
}

function entryCommand() {
  const memory = loadMemory();
  const id = scenarioId();
  const state = loadLabState(id);
  const entry = generateAutoSummaryEntry({
    scenarioId: id,
    memory,
    priorState: state,
    refreshMemory: boolArg('refresh-memory', false),
  });
  if (!boolArg('no-write', false)) {
    writeLabEntry(entry);
    refreshIndex(memory);
  }
  print(entry, boolArg('markdown', false));
}

function dailyCommand() {
  const memory = loadMemory();
  const index = buildLabIndex({ memory });
  if (!boolArg('no-write', false)) writeLabIndex(index);
  const brief = buildDailyBrief({ date: String(arg('date', new Date().toISOString().slice(0, 10))), index });
  if (!boolArg('no-write', false)) writeDailyBrief(brief);
  if (boolArg('markdown', false)) console.log(markdownForDailyBrief(brief));
  else print(brief);
}

function decisionCommand() {
  const id = scenarioId();
  const decisionType = String(arg('decision', arg('type', ''))).trim();
  const reason = String(arg('why', arg('reason', ''))).trim();
  const validation = validateDecisionInput({ scenarioId: id, decisionType, reason });
  if (!validation.ok) throw new Error(validation.errors.join(' '));
  const state = loadLabState(id);
  const decision = createDecision({
    scenarioId: id,
    decisionType,
    reason,
    status: String(arg('status', 'recorded')),
    reversible: boolArg('reversible', true),
    followUpCommand: arg('follow-up', state.latestEntry?.nextAction?.command || null),
    confidence: String(arg('confidence', 'medium')),
    citations: state.latestEntry?.citations || [],
  });
  if (!boolArg('dry-run', false)) {
    writeLabDecision(decision);
    refreshIndex(loadMemory());
  }
  print(decision, boolArg('markdown', false));
}

function latestCommand() {
  const id = scenarioId();
  const paths = labScenarioPaths(id);
  if (boolArg('build', false) || boolArg('refresh', false) || !existsSync(paths.latestEntry)) {
    const memory = loadMemory();
    const entry = generateAutoSummaryEntry({ scenarioId: id, memory, priorState: loadLabState(id) });
    if (!boolArg('no-write', false)) {
      writeLabEntry(entry);
      refreshIndex(memory);
    }
    print(entry, boolArg('markdown', false));
    return;
  }
  const entry = readJson(paths.latestEntry);
  print(entry, boolArg('markdown', false));
}

function doctorCommand() {
  const report = labDoctor({ memory: loadMemory(), staleDays: Number(arg('stale-days', 14)) });
  if (boolArg('markdown', false)) {
    console.log(`# Scenario Lab Notebook Doctor

Generated: ${report.generatedAt}

Warnings: ${report.warningCount}

${report.findings.map((finding) => `- ${finding.severity}: ${finding.message}${finding.command ? ` - \`${finding.command}\`` : ''}`).join('\n') || '- No findings.'}
`);
  } else {
    print(report);
  }
  if (boolArg('gate', false) && !report.ok) process.exit(1);
}

try {
  if (command === 'entry') entryCommand();
  else if (command === 'daily') dailyCommand();
  else if (command === 'decision') decisionCommand();
  else if (command === 'latest') latestCommand();
  else if (command === 'doctor') doctorCommand();
} catch (error) {
  console.error(`[lab] ${error.message || String(error)}`);
  process.exit(1);
}
