#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { comparePairedReports } from './gameplay-experiment-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const reportDir = resolve(root, 'reports', 'simulator');
const experimentRoot = resolve(reportDir, 'experiments');
const publicExperimentDir = resolve(root, 'app', 'public', 'simulator', 'autotune');
const policyPath = resolve(root, 'simulator.agent-policies.json');
const evaluationPath = resolve(root, 'simulator.evaluation.json');
const latestReportPath = resolve(reportDir, 'latest-report.json');
const publicLatestAutoTunePath = resolve(publicExperimentDir, 'latest-report.json');
const experimentIndexPath = resolve(experimentRoot, 'index.json');

const args = process.argv.slice(2);

function arg(name, fallback) {
  const found = args.find((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!found) return fallback;
  const eq = found.indexOf('=');
  return eq >= 0 ? found.slice(eq + 1) : true;
}

function boolArg(name, fallback = false) {
  const value = arg(name, fallback);
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'no'].includes(String(value).toLowerCase());
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const POLICY_KNOBS = new Set(['moveBias', 'digBias', 'restBias', 'idleBias', 'fleeBias', 'recoverAtStat', 'movementFallbackPriority']);

function applyKnobPatch(balance, knobPatch = {}) {
  const safePatch = Object.fromEntries(Object.entries(knobPatch).filter(([key]) => POLICY_KNOBS.has(key)));
  return {
    ...balance,
    knobs: {
      ...(balance.knobs || {}),
      ...safePatch,
    },
  };
}

function deltaMetric(candidate, baseline, path) {
  const before = path.reduce((value, key) => value?.[key], baseline) ?? 0;
  const after = path.reduce((value, key) => value?.[key], candidate) ?? 0;
  return { before: Number(before) || 0, after: Number(after) || 0, delta: (Number(after) || 0) - (Number(before) || 0) };
}

function summarizeMetrics(report) {
  return {
    lifeScore: report.funDebugger?.averageLifeScore || 0,
    oracleScore: report.oracle?.weightedScore || 0,
    oracleAgency: report.oracle?.experienceScores?.agency?.score || 0,
    oracleReadability: report.oracle?.experienceScores?.readability?.score || 0,
    flatTurnRate: report.funDebugger?.flatTurnRate || 0,
    aliveTurnRate: report.funDebugger?.aliveTurnRate || 0,
    artifacts: report.aggregate?.averages?.artifacts || 0,
    revealedZones: report.aggregate?.averages?.revealedZones || 0,
    statDelta: report.aggregate?.averages?.statDelta || 0,
    invalidAttempts: report.aggregate?.averages?.invalidAttempts || 0,
    zeroStatPlayers: report.aggregate?.averages?.zeroStatPlayers || 0,
    warnings: report.aggregate?.warnings?.length || 0,
  };
}

function scoreCandidate(candidateReport, baselineReport, balance) {
  const current = summarizeMetrics(candidateReport);
  const base = summarizeMetrics(baselineReport);
  const deltas = Object.fromEntries(Object.keys(current).map((metric) => [
    metric,
    { before: base[metric], after: current[metric], delta: current[metric] - base[metric] },
  ]));
  const gates = balance.gates || {};
  const rejectedReasons = [];
  if (deltas.lifeScore.delta < Number(gates.minLifeScoreGain ?? 2)) rejectedReasons.push(`life score gain ${deltas.lifeScore.delta.toFixed(2)} below ${gates.minLifeScoreGain ?? 2}`);
  if (deltas.flatTurnRate.delta > Number(gates.maxFlatTurnRateIncrease ?? 0.02)) rejectedReasons.push(`flat-turn rate worsened by ${deltas.flatTurnRate.delta.toFixed(3)}`);
  if (deltas.zeroStatPlayers.delta > Number(gates.maxZeroStatPlayersIncrease ?? 0.15)) rejectedReasons.push(`zero-stat players worsened by ${deltas.zeroStatPlayers.delta.toFixed(2)}`);
  if (deltas.invalidAttempts.delta > Number(gates.maxInvalidAttemptsIncrease ?? 1)) rejectedReasons.push(`invalid attempts worsened by ${deltas.invalidAttempts.delta.toFixed(2)}`);
  if (deltas.artifacts.delta < -Number(gates.maxArtifactLoss ?? 0.25)) rejectedReasons.push(`artifact average dropped by ${Math.abs(deltas.artifacts.delta).toFixed(2)}`);
  if (base.oracleScore > 0 && deltas.oracleScore.delta < -3) rejectedReasons.push(`oracle score regressed by ${Math.abs(deltas.oracleScore.delta).toFixed(2)}`);
  if (base.oracleReadability > 0 && deltas.oracleReadability.delta < -5) rejectedReasons.push(`oracle readability regressed by ${Math.abs(deltas.oracleReadability.delta).toFixed(2)}`);
  if (base.oracleAgency > 0 && deltas.oracleAgency.delta < -5) rejectedReasons.push(`oracle agency regressed by ${Math.abs(deltas.oracleAgency.delta).toFixed(2)}`);

  const weightedScore = (
    deltas.lifeScore.delta * 3
    + deltas.oracleScore.delta * 0.8
    + deltas.oracleAgency.delta * 0.3
    + deltas.oracleReadability.delta * 0.3
    + (-deltas.flatTurnRate.delta) * 60
    + deltas.aliveTurnRate.delta * 45
    + deltas.artifacts.delta * 8
    + deltas.revealedZones.delta * 4
    + (-Math.max(0, deltas.invalidAttempts.delta)) * 5
    + (-Math.max(0, deltas.zeroStatPlayers.delta)) * 12
    + (-Math.max(0, deltas.warnings.delta)) * 2
  );

  return {
    metrics: current,
    deltas,
    weightedScore,
    oracleScore: current.oracleScore,
    rejected: rejectedReasons.length > 0,
    rejectedReasons,
  };
}

function candidate(name, cause, hypothesis, knobPatch, expectedEffect, blastRadius = 'low') {
  const policyPatch = Object.fromEntries(Object.entries(knobPatch).filter(([key]) => POLICY_KNOBS.has(key)));
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name,
    cause,
    hypothesis,
    patch: { knobs: policyPatch },
    rejectedEvaluationKnobs: Object.keys(knobPatch).filter((key) => !POLICY_KNOBS.has(key)),
    expectedEffect,
    blastRadius,
  };
}

function knob(knobs, key, fallback) {
  return Number(knobs[key] ?? fallback);
}

function generateCandidates(sourceReport, balance) {
  const issueKeys = [
    sourceReport?.funDebugger?.topIssue?.key,
    ...(sourceReport?.funDebugger?.repeatedFlatPatterns || []).map((pattern) => pattern.key),
  ].filter(Boolean);
  const issue = issueKeys[0] || 'noBoardDelta';
  const knobs = balance.knobs || {};
  const catalog = {
    noBoardDelta: [
      candidate('Move Reveals Earlier', issue, 'Movement should be more likely to produce a visible board delta.', {
        moveBias: knob(knobs, 'moveBias', 1) + 1,
      }, 'Biases synthetic players toward movement without changing the evaluation rubric.', 'medium'),
      candidate('First Step Priority', issue, 'The smallest movement nudge is to prefer valid movement fallback earlier.', {
        movementFallbackPriority: 2,
        moveBias: knob(knobs, 'moveBias', 1) + 1,
      }, 'Tries move before lower-information fallbacks more often.', 'medium'),
    ],
    oneChoice: [
      candidate('Less Idle Sampling', issue, 'Synthetic players should exercise available actions instead of over-sampling idle.', {
        idleBias: Math.max(0, knob(knobs, 'idleBias', 1) - 1),
      }, 'Reduces idle selection pressure while leaving choice scoring unchanged.', 'low'),
      candidate('Move Alternative Bias', issue, 'Movement should remain a practical alternative when choices collapse.', {
        movementFallbackPriority: 2,
        moveBias: knob(knobs, 'moveBias', 1) + 1,
      }, 'Moves valid movement earlier in candidate action ordering.', 'medium'),
    ],
    invalidFriction: [
      candidate('Safer Fallback Ordering', issue, 'Synthetic players should try a known-valid movement fallback before noisy invalid actions.', {
        movementFallbackPriority: 2,
      }, 'Prefers the valid movement fallback without changing invalid-action penalties.', 'low'),
      candidate('Less Flee Fishing', issue, 'Risky escape attempts are creating readability noise.', {
        fleeBias: Math.max(0, knob(knobs, 'fleeBias', 1) - 1),
        restBias: knob(knobs, 'restBias', 1) + 1,
      }, 'Reduces risky flee attempts and adds recovery fallback.', 'medium'),
    ],
    restDominance: [
      candidate('Active Recovery Bias', issue, 'Recovery should not require every turn to become rest.', {
        restBias: Math.max(0, knob(knobs, 'restBias', 1) - 1),
        moveBias: knob(knobs, 'moveBias', 1) + 1,
      }, 'Reduces rest frequency and samples more active progress.', 'medium'),
      candidate('Recover Later', issue, 'The bot may be resting too early.', {
        recoverAtStat: 0,
        restBias: Math.max(0, knob(knobs, 'restBias', 1) - 1),
      }, 'Delays recovery behavior until stats are truly critical.', 'medium'),
    ],
    movementFriction: [
      candidate('Movement Bias Up', issue, 'Exploration needs more chances to prove value.', {
        moveBias: knob(knobs, 'moveBias', 1) + 2,
        movementFallbackPriority: 2,
      }, 'Pushes movement into more turns.', 'medium'),
      candidate('Movement Over Idle', issue, 'Exploration behavior needs a second policy-only probe.', {
        moveBias: knob(knobs, 'moveBias', 1) + 1,
        idleBias: Math.max(0, knob(knobs, 'idleBias', 1) - 1),
      }, 'Trades idle selections for movement without changing movement scores.', 'low'),
    ],
    noArtifactPayoff: [
      candidate('Dig Sampling Up', issue, 'Artifact scenarios need more synthetic-player attempts before their payoff can be judged.', {
        digBias: knob(knobs, 'digBias', 1) + 1,
      }, 'Runs more dig checks while preserving artifact scoring.', 'medium'),
      candidate('Dig Without Collapse', issue, 'Artifact chasing needs less stat-collapse collateral.', {
        digBias: knob(knobs, 'digBias', 1) + 1,
        restBias: knob(knobs, 'restBias', 1) + 1,
      }, 'Samples dig and recovery together while the fixed rubric guards against collapse.', 'medium'),
    ],
    statCollapse: [
      candidate('Earlier Rescue', issue, 'The system needs a rescue affordance before zero-stat collapse.', {
        recoverAtStat: 2,
        restBias: knob(knobs, 'restBias', 1) + 1,
      }, 'Starts synthetic-player recovery earlier; the fixed collapse gate remains unchanged.', 'medium'),
      candidate('Recovery Over Idle', issue, 'Critical synthetic players should recover instead of spending low-information turns.', {
        recoverAtStat: 2,
        restBias: knob(knobs, 'restBias', 1) + 1,
        idleBias: Math.max(0, knob(knobs, 'idleBias', 1) - 1),
      }, 'Exercises the recovery branch more often without changing collapse scoring.', 'medium'),
    ],
  };
  const selected = catalog[issue] || catalog.noBoardDelta;
  const scenarioTags = sourceReport?.scenarioDefinition?.tags || [];
  const scenarioCandidates = [];
  if (scenarioTags.includes('escape')) {
    scenarioCandidates.push(candidate('Escape Pressure Probe', issue, 'Escape scenarios need at least one high-stakes flee attempt without invalid-action noise.', {
      fleeBias: knob(knobs, 'fleeBias', 1) + 1,
    }, 'Raises synthetic-player escape pressure while the fixed rubric continues to reject invalid attempts.', 'medium'));
  }
  if (scenarioTags.includes('cooperation')) {
    scenarioCandidates.push(candidate('Cooperation Recovery Probe', issue, 'Cooperation scenarios need visible help/recovery value.', {
      restBias: knob(knobs, 'restBias', 1) + 1,
    }, 'Increases recovery-oriented synthetic-player choices without changing choice scoring.', 'medium'));
  }
  if (scenarioTags.includes('artifact')) {
    scenarioCandidates.push(candidate('Artifact Attempt Probe', issue, 'Artifact scenarios need more dig attempts before payoff evidence is conclusive.', {
      digBias: knob(knobs, 'digBias', 1) + 1,
    }, 'Raises dig-attempt frequency while preserving artifact evaluation weights.', 'medium'));
  }
  const fallback = [
    candidate('Conservative Explore Probe', issue, 'When diagnosis is ambiguous, sample a small behavior-only exploration nudge.', {
      moveBias: knob(knobs, 'moveBias', 1) + 1,
    }, 'Changes only synthetic-player action selection and leaves the evaluator fixed.', 'low'),
  ];
  return [...scenarioCandidates, ...selected, ...fallback]
    .filter((item) => Object.keys(item.patch.knobs).length > 0)
    .slice(0, Math.max(2, Math.min(5, Number(arg('candidates', 4)))));
}

function simulatorArgs(extra = {}) {
  const scenario = String(arg('scenario', 'benchmark'));
  const batch = String(arg('batch', '10'));
  const strategies = arg('strategies', null);
  const turns = arg('turns', null);
  const players = arg('players', null);
  const seed = String(arg('seed', 'autotune'));
  const result = [
    resolve(root, 'scripts', 'gameplay-simulator.mjs'),
    `--scenario=${scenario}`,
    `--batch=${batch}`,
    `--seed=${seed}`,
    '--quiet',
  ];
  if (strategies) result.push(`--strategies=${strategies}`);
  if (arg('scenario-id', null)) result.push(`--scenario-id=${arg('scenario-id', null)}`);
  if (arg('scenario-file', null)) result.push(`--scenario-file=${arg('scenario-file', null)}`);
  if (turns) result.push(`--turns=${turns}`);
  if (players) result.push(`--players=${players}`);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== false) result.push(`--${key}=${value}`);
  }
  return result;
}

function runSimulator(label, policyFile, sessionDir) {
  const result = spawnSync(process.execPath, simulatorArgs({
    policy: policyFile,
    evaluation: evaluationPath,
    note: `autotune ${label}`,
    changed: label,
  }), {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`Simulator failed for ${label}: ${result.stderr || result.stdout}`);
  }
  const report = readJson(latestReportPath);
  const reportPath = resolve(sessionDir, label, 'report.json');
  writeJson(reportPath, report);
  writeFileSync(resolve(sessionDir, label, 'stdout.txt'), result.stdout || '');
  writeFileSync(resolve(sessionDir, label, 'stderr.txt'), result.stderr || '');
  return { report, reportPath };
}

function updateExperimentIndex(entry) {
  const existing = readJson(experimentIndexPath, []);
  const index = Array.isArray(existing) ? existing : [];
  index.unshift(entry);
  writeJson(experimentIndexPath, index.slice(0, 100));
}

function buildReport({ sessionId, sessionDir, baseline, candidates, results, dryRun, sourceReport, balance }) {
  const ranked = [...results].sort((a, b) => {
    if (a.rejected !== b.rejected) return a.rejected ? 1 : -1;
    return b.weightedScore - a.weightedScore;
  });
  const winner = ranked.find((item) => !item.rejected) || null;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    dryRun,
    sessionId,
    sessionDir,
    config: {
      scenario: String(arg('scenario', 'benchmark')),
      batch: Number(arg('batch', '10')),
      strategies: arg('strategies', null),
      seed: String(arg('seed', 'autotune')),
    },
    safety: {
      baselinePolicyPath: policyPath,
      immutableEvaluationPath: evaluationPath,
      pairedSeeds: true,
      baselineReportPath: baseline?.reportPath || null,
      applyWinnerRequested: boolArg('apply-winner', false),
    },
    sourceFunDebugger: sourceReport?.funDebugger || null,
    baseline: baseline ? {
      reportPath: baseline.reportPath,
      metrics: summarizeMetrics(baseline.report),
      topIssue: baseline.report.funDebugger?.topIssue || null,
      topExperiment: baseline.report.funDebugger?.topExperiments?.[0] || null,
    } : null,
    candidates,
    results,
    ranked,
    winner,
    recommendation: winner
      ? `Apply "${winner.name}" only if its design hypothesis matches the next intended tuning pass.`
      : 'No candidate passed rejection gates; keep the current agent policy.',
  };
}

async function main() {
  const dryRun = boolArg('dry-run', false);
  const applyWinner = boolArg('apply-winner', false);
  const balance = readJson(policyPath);
  if (!balance) throw new Error(`Missing ${policyPath}`);
  const evaluation = readJson(evaluationPath);
  if (!evaluation) throw new Error(`Missing ${evaluationPath}`);
  balance.gates = evaluation.gates || {};
  const sourceReport = readJson(latestReportPath, null);
  const candidates = generateCandidates(sourceReport, balance);
  const sessionId = stamp();
  const sessionDir = resolve(experimentRoot, sessionId);
  mkdirSync(sessionDir, { recursive: true });
  mkdirSync(publicExperimentDir, { recursive: true });
  writeJson(resolve(sessionDir, 'baseline-balance.json'), balance);
  writeJson(resolve(sessionDir, 'candidates.json'), candidates);

  if (dryRun) {
    const report = buildReport({ sessionId, sessionDir, baseline: null, candidates, results: [], dryRun, sourceReport, balance });
    writeJson(resolve(sessionDir, 'autotune-report.json'), report);
    writeJson(publicLatestAutoTunePath, report);
    updateExperimentIndex({ sessionId, generatedAt: report.generatedAt, dryRun: true, winner: null, reportPath: resolve(sessionDir, 'autotune-report.json') });
    console.log(JSON.stringify({ dryRun: true, candidates, reportPath: resolve(sessionDir, 'autotune-report.json') }, null, 2));
    return;
  }

  const baselineBalancePath = resolve(sessionDir, 'baseline-balance-active.json');
  writeJson(baselineBalancePath, balance);
  const baseline = runSimulator('baseline', baselineBalancePath, sessionDir);
  const results = [];

  for (const item of candidates) {
    const candidateDir = resolve(sessionDir, item.id);
    mkdirSync(candidateDir, { recursive: true });
    const patchedBalance = applyKnobPatch(balance, item.patch.knobs);
    const candidateBalancePath = resolve(candidateDir, 'balance.json');
    writeJson(candidateBalancePath, patchedBalance);
    writeJson(resolve(candidateDir, 'candidate.json'), item);
    const candidateRun = runSimulator(item.id, candidateBalancePath, sessionDir);
    const score = scoreCandidate(candidateRun.report, baseline.report, balance);
    const pairedEvidence = comparePairedReports(baseline.report, candidateRun.report, {
      minimumReplicates: Number(arg('batch', 10)),
    });
    if (!pairedEvidence.passed) {
      score.rejected = true;
      score.rejectedReasons.push(...pairedEvidence.failures.map((failure) => `paired evidence: ${failure}`));
    }
    results.push({
      ...item,
      reportPath: candidateRun.reportPath,
      balancePath: candidateBalancePath,
      ...score,
      pairedEvidence,
      explanation: score.rejected
        ? `Rejected: ${score.rejectedReasons.join('; ')}.`
        : `Improved life by ${score.deltas.lifeScore.delta.toFixed(2)}, Oracle by ${score.deltas.oracleScore.delta.toFixed(2)}, and flat-turn rate by ${score.deltas.flatTurnRate.delta.toFixed(3)}.`,
    });
  }

  const report = buildReport({ sessionId, sessionDir, baseline, candidates, results, dryRun, sourceReport: baseline.report, balance });
  const reportPath = resolve(sessionDir, 'autotune-report.json');
  writeJson(reportPath, report);
  writeJson(publicLatestAutoTunePath, report);
  updateExperimentIndex({
    sessionId,
    generatedAt: report.generatedAt,
    dryRun: false,
    winner: report.winner ? { id: report.winner.id, name: report.winner.name, weightedScore: report.winner.weightedScore } : null,
    reportPath,
  });

  if (applyWinner && report.winner) {
    const winnerBalance = applyKnobPatch(balance, report.winner.patch.knobs);
    copyFileSync(policyPath, resolve(sessionDir, 'pre-apply-policy.json'));
    delete winnerBalance.gates;
    writeJson(policyPath, winnerBalance);
    report.appliedWinner = { id: report.winner.id, name: report.winner.name, policyPath };
    writeJson(reportPath, report);
    writeJson(publicLatestAutoTunePath, report);
  }

  console.log(JSON.stringify({
    sessionId,
    winner: report.winner ? {
      id: report.winner.id,
      name: report.winner.name,
      weightedScore: report.winner.weightedScore,
      explanation: report.winner.explanation,
    } : null,
    rejected: report.results.filter((item) => item.rejected).map((item) => ({ id: item.id, reasons: item.rejectedReasons })),
    reportPath,
  }, null, 2));
}

main().catch((error) => {
  console.error('[autotune] fatal:', error.message || String(error));
  process.exit(1);
});
