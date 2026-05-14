#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const reportDir = resolve(root, 'reports', 'simulator');
const experimentRoot = resolve(reportDir, 'experiments');
const publicExperimentDir = resolve(root, 'app', 'public', 'simulator', 'autotune');
const balancePath = resolve(root, 'simulator.balance.json');
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

function applyKnobPatch(balance, knobPatch = {}) {
  return {
    ...balance,
    knobs: {
      ...(balance.knobs || {}),
      ...knobPatch,
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

  const weightedScore = (
    deltas.lifeScore.delta * 3
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
    rejected: rejectedReasons.length > 0,
    rejectedReasons,
  };
}

function candidate(name, cause, hypothesis, knobPatch, expectedEffect, blastRadius = 'low') {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name,
    cause,
    hypothesis,
    patch: { knobs: knobPatch },
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
      candidate('Quiet Turn Signal', issue, 'Flat turns need visible feedback before rules change.', {
        quietTurnLifeBonus: knob(knobs, 'quietTurnLifeBonus', 0) + 6,
        noBoardDeltaPenalty: Math.max(12, knob(knobs, 'noBoardDeltaPenalty', 22) - 4),
      }, 'Raises life score for quiet-but-readable turns and lowers the flat penalty.', 'low'),
      candidate('Move Reveals Earlier', issue, 'Movement should be more likely to produce a visible board delta.', {
        moveBias: knob(knobs, 'moveBias', 1) + 1,
        movementLifeReward: knob(knobs, 'movementLifeReward', 8) + 4,
        discoveryLifeReward: knob(knobs, 'discoveryLifeReward', 12) + 2,
      }, 'Biases simulator agents toward movement and rewards board/location deltas.', 'medium'),
      candidate('First Step Priority', issue, 'The smallest movement nudge is to prefer valid movement fallback earlier.', {
        movementFallbackPriority: 2,
        moveBias: knob(knobs, 'moveBias', 1) + 1,
      }, 'Tries move before lower-information fallbacks more often.', 'medium'),
    ],
    oneChoice: [
      candidate('Choice Density Reward', issue, 'Choice-rich states should count more strongly as alive.', {
        choiceDensityReward: knob(knobs, 'choiceDensityReward', 18) + 6,
        idleBias: Math.max(0, knob(knobs, 'idleBias', 1) - 1),
      }, 'Rewards multiple valid choices and reduces idle selection pressure.', 'low'),
      candidate('Move Alternative Bias', issue, 'Movement should remain a practical alternative when choices collapse.', {
        movementFallbackPriority: 2,
        moveBias: knob(knobs, 'moveBias', 1) + 1,
      }, 'Moves valid movement earlier in candidate action ordering.', 'medium'),
    ],
    invalidFriction: [
      candidate('Invalid Friction Guard', issue, 'Invalid attempts should be punished in scoring and avoided by candidates.', {
        invalidAttemptPenalty: knob(knobs, 'invalidAttemptPenalty', 5) + 3,
        movementFallbackPriority: 2,
      }, 'Makes invalid-action regressions easier to reject and prefers safer move fallback.', 'low'),
      candidate('Less Flee Fishing', issue, 'Risky escape attempts are creating readability noise.', {
        fleeBias: Math.max(0, knob(knobs, 'fleeBias', 1) - 1),
        restBias: knob(knobs, 'restBias', 1) + 1,
      }, 'Reduces risky flee attempts and adds recovery fallback.', 'medium'),
    ],
    restDominance: [
      candidate('Active Recovery Bias', issue, 'Recovery should not require every turn to become rest.', {
        restBias: Math.max(0, knob(knobs, 'restBias', 1) - 1),
        moveBias: knob(knobs, 'moveBias', 1) + 1,
        progressLifeReward: knob(knobs, 'progressLifeReward', 4) + 2,
      }, 'Reduces rest frequency and rewards active progress.', 'medium'),
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
      candidate('Movement Feels Better', issue, 'Movement deltas should count as more alive.', {
        movementLifeReward: knob(knobs, 'movementLifeReward', 8) + 5,
        discoveryLifeReward: knob(knobs, 'discoveryLifeReward', 12) + 2,
      }, 'Increases life score from movement and reveal outcomes.', 'low'),
    ],
    noArtifactPayoff: [
      candidate('Dig Payoff Clarity', issue, 'Digging should feel worthwhile even before changing artifact math.', {
        digBias: knob(knobs, 'digBias', 1) + 1,
        artifactLifeReward: knob(knobs, 'artifactLifeReward', 22) + 5,
      }, 'Runs more dig checks and values artifact moments more strongly.', 'medium'),
      candidate('Dig Without Collapse', issue, 'Artifact chasing needs less stat-collapse collateral.', {
        digBias: knob(knobs, 'digBias', 1) + 1,
        statCollapsePenalty: knob(knobs, 'statCollapsePenalty', 14) + 4,
        restBias: knob(knobs, 'restBias', 1) + 1,
      }, 'Tests dig payoff while guarding against stat collapse.', 'medium'),
    ],
    statCollapse: [
      candidate('Earlier Rescue', issue, 'The system needs a rescue affordance before zero-stat collapse.', {
        recoverAtStat: 2,
        restBias: knob(knobs, 'restBias', 1) + 1,
        statCollapsePenalty: knob(knobs, 'statCollapsePenalty', 14) + 4,
      }, 'Starts recovery earlier and rejects collapse more aggressively.', 'medium'),
      candidate('Collapse Gate Hardening', issue, 'Life-score improvements are not acceptable if collapse worsens.', {
        statCollapsePenalty: knob(knobs, 'statCollapsePenalty', 14) + 8,
      }, 'Raises collapse penalty so bad candidates lose.', 'low'),
    ],
  };
  const selected = catalog[issue] || catalog.noBoardDelta;
  const scenarioTags = sourceReport?.scenarioDefinition?.tags || [];
  const scenarioCandidates = [];
  if (scenarioTags.includes('escape')) {
    scenarioCandidates.push(candidate('Escape Pressure Probe', issue, 'Escape scenarios need at least one high-stakes flee attempt without invalid-action noise.', {
      fleeBias: knob(knobs, 'fleeBias', 1) + 1,
      invalidAttemptPenalty: knob(knobs, 'invalidAttemptPenalty', 5) + 2,
    }, 'Raises escape pressure while keeping invalid attempts costly.', 'medium'));
  }
  if (scenarioTags.includes('cooperation')) {
    scenarioCandidates.push(candidate('Cooperation Recovery Probe', issue, 'Cooperation scenarios need visible help/recovery value.', {
      restBias: knob(knobs, 'restBias', 1) + 1,
      choiceDensityReward: knob(knobs, 'choiceDensityReward', 18) + 4,
    }, 'Increases recovery-oriented choices and rewards choice density.', 'medium'));
  }
  if (scenarioTags.includes('artifact')) {
    scenarioCandidates.push(candidate('Artifact Payoff Probe', issue, 'Artifact scenarios need stronger dig/reward evidence.', {
      digBias: knob(knobs, 'digBias', 1) + 1,
      artifactLifeReward: knob(knobs, 'artifactLifeReward', 22) + 4,
    }, 'Raises dig pressure and artifact-moment value.', 'medium'));
  }
  const fallback = [
    candidate('Low-Risk Life Weighting', issue, 'Improve debug sensitivity without behavior blast radius.', {
      quietTurnLifeBonus: knob(knobs, 'quietTurnLifeBonus', 0) + 3,
      choiceDensityReward: knob(knobs, 'choiceDensityReward', 18) + 3,
    }, 'Makes quiet feedback and choice density more visible in scoring.', 'low'),
  ];
  return [...scenarioCandidates, ...selected, ...fallback].slice(0, Math.max(2, Math.min(5, Number(arg('candidates', 4)))));
}

function simulatorArgs(extra = {}) {
  const scenario = String(arg('scenario', 'benchmark'));
  const batch = String(arg('batch', '3'));
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

function runSimulator(label, balanceFile, sessionDir) {
  const result = spawnSync(process.execPath, simulatorArgs({
    balance: balanceFile,
    note: `autotune ${label}`,
    changed: label,
  }), {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
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
      batch: Number(arg('batch', '3')),
      strategies: arg('strategies', null),
      seed: String(arg('seed', 'autotune')),
    },
    safety: {
      baselineBalancePath: balancePath,
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
      : 'No candidate passed rejection gates; keep the current balance file.',
  };
}

async function main() {
  const dryRun = boolArg('dry-run', false);
  const applyWinner = boolArg('apply-winner', false);
  const balance = readJson(balancePath);
  if (!balance) throw new Error(`Missing ${balancePath}`);
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
    results.push({
      ...item,
      reportPath: candidateRun.reportPath,
      balancePath: candidateBalancePath,
      ...score,
      explanation: score.rejected
        ? `Rejected: ${score.rejectedReasons.join('; ')}.`
        : `Improved life by ${score.deltas.lifeScore.delta.toFixed(2)} and flat-turn rate by ${score.deltas.flatTurnRate.delta.toFixed(3)}.`,
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
    copyFileSync(balancePath, resolve(sessionDir, 'pre-apply-balance.json'));
    writeJson(balancePath, winnerBalance);
    report.appliedWinner = { id: report.winner.id, name: report.winner.name, balancePath };
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
