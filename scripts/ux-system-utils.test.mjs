import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeFriction, auditCopyFiles, evaluateAutomatedEvidence, evaluateJourneyEvidence, summarizeResearch, validateResearchSession, validateUXContract } from './ux-system-utils.mjs';

const research = {
  maxAgeDays: 30,
  minimumSessions: 2,
  minimumCohorts: { 'first-time': 1, returning: 1 },
  requiredTaskIds: ['choose', 'recover'],
  requiredFields: ['id', 'cohort', 'tasks', 'delight', 'returnIntent', 'consentSafe', 'recordedAt'],
};

const session = (id, cohort) => ({ id, cohort, tasks: { choose: 'pass', recover: 'struggle' }, delight: 4, returnIntent: 5, consentSafe: true, recordedAt: '2026-09-01T00:00:00.000Z' });

test('UX contract rejects incomplete journey budgets', () => {
  const contract = { version: '1.0.0', journeys: [{ id: 'a', requiredEvents: ['open'], budgets: {} }, { id: 'b', requiredEvents: ['resume'], budgets: {} }], research: { minimumSessions: 1, minimumCohorts: { first: 1 }, requiredTaskIds: ['choose'] }, frictionRules: [{}], copy: { scanRoots: ['app/src'], prohibited: [] } };
  assert.equal(validateUXContract(contract).ok, false);
  assert.match(validateUXContract(contract).errors.join(' '), /maxActions/);
});

test('research evidence requires valid, recent sessions in every cohort', () => {
  assert.equal(validateResearchSession(session('a', 'first-time'), research).ok, true);
  const summary = summarizeResearch([session('a', 'first-time'), session('b', 'returning')], research, new Date('2026-09-08T00:00:00.000Z'));
  assert.equal(summary.status, 'current');
  assert.equal(summary.taskPassRate, 0.5);
  assert.equal(summary.delightAverage, 4);
});

test('research validation rejects personal identifiers', () => {
  const unsafe = { ...session('a', 'first-time'), observations: 'Contact player@example.com' };
  assert.match(validateResearchSession(unsafe, research).errors.join(' '), /email address/);
});

test('friction inbox ranks unrecovered errors above repeated help', () => {
  const events = [
    { name: 'ux_error', journey_id: 'a', journey_sequence: 1 },
    { name: 'ux_help', journey_id: 'b', journey_sequence: 1 },
    { name: 'ux_help', journey_id: 'b', journey_sequence: 2 },
  ];
  const rules = [
    { id: 'error', title: 'Error', severity: 'critical', start: 'ux_error', missingAfter: 'ux_recovery' },
    { id: 'help', title: 'Help', severity: 'medium', event: 'ux_help', minimumCount: 2 },
  ];
  assert.equal(analyzeFriction(events, rules).topPriority.id, 'error');
});

test('copy audit excludes labs and finds vague production copy', () => {
  const result = auditCopyFiles([
    { path: 'app/src/pages/HomePage.jsx', content: 'Something went wrong' },
    { path: 'app/src/pages/DesignSystemPage.jsx', content: 'Something went wrong' },
  ], { excludePatterns: ['DesignSystemPage.jsx'], prohibited: [{ text: 'Something went wrong', reason: 'be specific' }] });
  assert.equal(result.filesScanned, 1);
  assert.equal(result.findings.length, 1);
});

test('journey evidence enforces event and interaction budgets', () => {
  const contract = [{ id: 'first', requiredEvents: ['open', 'choice'], budgets: { maxActions: 2, maxBacktracks: 0, maxErrors: 0, maxFirstActionMs: 1000, maxCompletionMs: 2000, maxRecoveryMs: 1000 } }];
  assert.equal(evaluateJourneyEvidence({ journeys: [{ id: 'first', actions: 2, backtracks: 0, errors: 0, firstActionMs: 500, completionMs: 1500, recoveryMs: 0, events: ['open', 'choice'] }] }, contract).status, 'pass');
  assert.equal(evaluateJourneyEvidence({ journeys: [{ id: 'first', actions: 3, events: ['open'] }] }, contract).status, 'fail');
});

test('automated evidence requires fresh reports from every declared browser project', () => {
  const contract = {
    maxAgeDays: 14,
    suites: [
      { id: 'assistive', label: 'Assistive', requiredProjects: ['chromium-desktop', 'webkit-desktop'] },
      { id: 'touch', label: 'Touch', requiredProjects: ['pixel-7'] },
    ],
  };
  const current = { status: 'pass', generatedAt: '2026-09-08T00:00:00.000Z', projects: ['chromium-desktop', 'webkit-desktop'] };
  const result = evaluateAutomatedEvidence({ assistive: current, touch: { ...current, projects: ['pixel-7'] } }, contract, new Date('2026-09-08T12:00:00.000Z'));
  assert.equal(result.status, 'pass');
  assert.equal(evaluateAutomatedEvidence({ assistive: { ...current, projects: ['chromium-desktop'] } }, contract, new Date('2026-09-08T12:00:00.000Z')).status, 'fail');
});
