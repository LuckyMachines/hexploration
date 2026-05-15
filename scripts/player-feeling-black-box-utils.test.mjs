import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArcSummary,
  buildFeelingReport,
  buildFeelingTimeline,
  classifyFeelingEvent,
  computeArcScore,
  computeTurnAgencyScore,
  computeTurnFrictionScore,
  computeTurnLifePulse,
  controlFeelNote,
  detectArcShape,
  diffTurnState,
  feelingDoctor,
  findBestMoment,
  findFirstAliveTurn,
  findFirstFlatTurn,
  findMostConfusingMoment,
  findPayoffMoment,
  findRecoveryMoment,
  findStrongestAgencyMoment,
  findStrongestFrictionMoment,
  findWorstMoment,
  labelCounts,
  markdownForFeelingReport,
  normalizeTurnEvidence,
  polarityMix,
  recommendFeelingImprovement,
  scoreFeelingConfidence,
} from './player-feeling-black-box-utils.mjs';

function state({ stats = [3, 3, 3], location = '0,0', activeZones = 1, artifacts = [], inventory = [] } = {}) {
  return {
    phase: 'Day',
    queuePhase: 'Submission',
    activeZones: { count: activeZones },
    players: [
      {
        playerId: 1,
        location,
        stats: { movement: stats[0], agility: stats[1], dexterity: stats[2] },
        artifacts,
        inventory,
        active: true,
      },
    ],
  };
}

function turn(turnNumber, before, after, submission = {}) {
  return {
    turn: turnNumber,
    before,
    after,
    submissions: [
      {
        playerId: 1,
        action: submission.action || 'Move',
        validChoiceCount: submission.validChoiceCount ?? 3,
        invalidAttempts: submission.invalidAttempts || 0,
        error: submission.error,
      },
    ],
  };
}

function report() {
  const first = state();
  const second = state({ location: '1,0', activeZones: 2 });
  const third = state({ location: '1,0', activeZones: 2, artifacts: ['Relic'] });
  const fourth = state({ location: '1,0', activeZones: 2, artifacts: ['Relic'], stats: [1, 1, 1] });
  const fifth = state({ location: '1,0', activeZones: 2, artifacts: ['Relic'], stats: [3, 2, 2] });
  return {
    generatedAt: '2026-05-15T00:00:00.000Z',
    config: { scenario: 'solo-artifact-hunt', strategy: 'balanced', players: 1 },
    initial: first,
    turns: [
      turn(1, first, second, { action: 'Move' }),
      turn(2, second, third, { action: 'Dig' }),
      turn(3, third, fourth, { action: 'Move', invalidAttempts: 1 }),
      turn(4, fourth, fifth, { action: 'Rest' }),
      turn(5, fifth, fifth, { action: 'Dig', validChoiceCount: 1 }),
    ],
    setupLevel: 'partial',
  };
}

test('diffs before and after turn state', () => {
  const diff = diffTurnState(state(), state({ location: '1,0', activeZones: 2, artifacts: ['Relic'] }));
  assert.equal(diff.locationChanges, 1);
  assert.equal(diff.revealedDelta, 1);
  assert.equal(diff.artifactDelta, 1);
});

test('normalizes turn evidence from a simulator report', () => {
  const events = normalizeTurnEvidence(report(), { sourcePath: 'reports/simulator/sample.json' });
  assert.equal(events.length, 5);
  assert.equal(events[0].scenarioId, 'solo-artifact-hunt');
  assert.equal(events[0].action, 'Move');
});

test('normalizes nested baseline and final run evidence', () => {
  const nested = {
    scenarioId: 'escape-pressure-4p',
    baselineRun: report(),
    finalRun: { ...report(), scenarioId: 'escape-pressure-4p' },
  };
  const events = normalizeTurnEvidence(nested, { sourcePath: 'reports/simulator/autopilot/latest-report.json' });
  assert.equal(events.length, 10);
  assert.equal(events[0].scenarioId, 'escape-pressure-4p');
  assert.equal(events[5].runIndex, 1);
});

test('classifies major feeling labels deterministically', () => {
  const events = normalizeTurnEvidence(report());
  assert.equal(classifyFeelingEvent(events[0], { report: report() }).feelingLabel, 'alive');
  assert.equal(classifyFeelingEvent(events[1], { report: report() }).feelingLabel, 'payoff');
  assert.ok(['confusing', 'friction', 'panic', 'tense'].includes(classifyFeelingEvent(events[2], { report: report() }).feelingLabel));
  assert.equal(classifyFeelingEvent(events[3], { report: report() }).feelingLabel, 'recovery');
  assert.ok(['flat', 'dead-end'].includes(classifyFeelingEvent(events[4], { report: report() }).feelingLabel));
});

test('scores confidence, agency, friction, and life pulse', () => {
  const event = normalizeTurnEvidence(report())[0];
  assert.ok(scoreFeelingConfidence(event) > 0.5);
  assert.ok(computeTurnAgencyScore(event) > computeTurnFrictionScore(event));
  assert.ok(computeTurnLifePulse(event) > 45);
  assert.match(controlFeelNote(event), /move changed the board/);
});

test('builds timeline counts and moments', () => {
  const timeline = buildFeelingTimeline(report());
  assert.equal(timeline.length, 5);
  assert.ok(labelCounts(timeline).alive >= 1);
  assert.ok(polarityMix(timeline).positive >= 1);
  assert.equal(findFirstAliveTurn(timeline).turn, 1);
  assert.ok(findFirstFlatTurn(timeline));
  assert.ok(findBestMoment(timeline));
  assert.ok(findWorstMoment(timeline));
  assert.ok(findMostConfusingMoment(timeline));
  assert.ok(findStrongestAgencyMoment(timeline));
  assert.ok(findStrongestFrictionMoment(timeline));
  assert.ok(findRecoveryMoment(timeline));
  assert.ok(findPayoffMoment(timeline));
});

test('detects arc shape and score', () => {
  const timeline = buildFeelingTimeline(report());
  assert.ok(['rising', 'spiky', 'recovery', 'payoff-then-drift', 'uncertain'].includes(detectArcShape(timeline)));
  assert.ok(computeArcScore(timeline) > 0);
  const arc = buildArcSummary(timeline, { scenarioId: 'solo-artifact-hunt' });
  assert.ok(arc.recommendedImprovement);
});

test('recommends improvements by arc shape', () => {
  assert.equal(recommendFeelingImprovement({ arcShape: 'flatline', labelCounts: {}, scenarioId: 'x' }).type, 'flatline');
  assert.equal(recommendFeelingImprovement({ arcShape: 'panic-loop', labelCounts: {}, scenarioId: 'x' }).type, 'panic-loop');
  assert.equal(recommendFeelingImprovement({ arcShape: 'uncertain', labelCounts: { friction: 2 }, scenarioId: 'x' }).type, 'friction');
});

test('builds full report and markdown', () => {
  const feeling = buildFeelingReport(report(), { sourcePath: 'reports/simulator/sample.json', generatedAt: '2026-05-15T01:00:00.000Z' });
  assert.equal(feeling.scenarioId, 'solo-artifact-hunt');
  assert.ok(feeling.arc.arcScore > 0);
  assert.ok(markdownForFeelingReport(feeling).includes('Player Feeling Black Box'));
});

test('doctor returns useful missing-source output', () => {
  const doctor = feelingDoctor({ file: 'reports/simulator/not-real.json' });
  assert.equal(doctor.ok, true);
  assert.ok(doctor.findings.some((finding) => finding.type === 'missing-source-report'));
});
