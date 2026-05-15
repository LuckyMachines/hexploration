#!/usr/bin/env node
import { existsSync } from 'fs';
import {
  buildProjectCurriculum,
  buildScenarioTutorLesson,
  completeLesson,
  loadTutorEvidence,
  markdownForProjectCurriculum,
  markdownForScenarioLesson,
  tutorDoctor,
  tutorPaths,
  writeProjectCurriculum,
  writeScenarioTutorLesson,
} from './scenario-self-driving-tutor-utils.mjs';
import { readJson, slugify } from './scenario-utils.mjs';

const argv = process.argv.slice(2);
const commands = new Set(['build', 'scenario', 'next', 'complete', 'doctor']);
const command = commands.has(argv[0]) ? argv[0] : argv.length > 0 ? 'scenario' : 'build';
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

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function evidence() {
  return loadTutorEvidence({ refreshMemory: boolArg('refresh-memory', false), includeRaw: true });
}

function buildCommand() {
  const curriculum = buildProjectCurriculum({ evidence: evidence() });
  if (!boolArg('no-write', false)) writeProjectCurriculum(curriculum);
  if (boolArg('markdown', false)) console.log(markdownForProjectCurriculum(curriculum));
  else printJson(curriculum);
}

function scenarioCommand() {
  const lesson = buildScenarioTutorLesson({ scenarioId: scenarioId(), evidence: evidence() });
  if (!boolArg('no-write', false)) writeScenarioTutorLesson(lesson);
  if (boolArg('markdown', false)) console.log(markdownForScenarioLesson(lesson));
  else printJson(lesson);
}

function nextCommand() {
  const paths = tutorPaths();
  let curriculum = existsSync(paths.latestCurriculum) && !boolArg('refresh', false)
    ? readJson(paths.latestCurriculum, null)
    : null;
  if (!curriculum) {
    curriculum = buildProjectCurriculum({ evidence: evidence() });
    if (!boolArg('no-write', false)) writeProjectCurriculum(curriculum);
  }
  const lesson = curriculum.highestPriorityLesson || curriculum.lessons?.[0] || null;
  if (!lesson) throw new Error('No tutor lesson exists.');
  if (boolArg('markdown', false)) console.log(markdownForScenarioLesson(lesson));
  else printJson(lesson);
}

function completeCommand() {
  const id = scenarioId();
  const lessonId = String(arg('lesson', arg('lesson-id', ''))).trim();
  const status = String(arg('status', '')).trim();
  const reason = String(arg('why', arg('reason', ''))).trim();
  const paths = tutorPaths(id);
  const latestLesson = readJson(paths.latestLesson, null);
  const record = completeLesson({
    scenarioId: id,
    lessonId: lessonId || latestLesson?.id,
    status,
    reason,
    followUpCommand: arg('follow-up', latestLesson?.commands?.primary || null),
    citations: latestLesson?.citations || [],
    dryRun: boolArg('dry-run', false),
  });
  printJson(record);
}

function doctorCommand() {
  const report = tutorDoctor({ evidence: evidence(), staleDays: Number(arg('stale-days', 14)) });
  if (boolArg('markdown', false)) {
    console.log(`# Scenario Self-Driving Tutor Doctor

Generated: ${report.generatedAt}

Warnings: ${report.warningCount}

${report.findings.map((finding) => `- ${finding.severity}: ${finding.message}${finding.command ? ` - \`${finding.command}\`` : ''}`).join('\n') || '- No findings.'}
`);
  } else {
    printJson(report);
  }
  if (boolArg('gate', false) && !report.ok) process.exit(1);
}

try {
  if (command === 'build') buildCommand();
  else if (command === 'scenario') scenarioCommand();
  else if (command === 'next') nextCommand();
  else if (command === 'complete') completeCommand();
  else if (command === 'doctor') doctorCommand();
} catch (error) {
  console.error(`[tutor] ${error.message || String(error)}`);
  process.exit(1);
}
