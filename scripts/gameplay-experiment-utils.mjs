function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - center) ** 2), 0) / (values.length - 1));
}

function runKey(run = {}, index = 0) {
  return `${run.config?.strategy || 'unknown'}:${run.config?.runIndex || index + 1}`;
}

function runMetrics(run = {}) {
  const turns = Math.max(1, Number(run.summary?.turnsRun || run.turns?.length || 1));
  const tension = mean((run.summary?.tensionCurve || []).map((point) => number(point.tension)));
  const terminal = run.summary?.terminal === true || run.summary?.gameOver === true ? 1 : 0;
  const consequenceVisibility = number(run.summary?.consequenceVisibility);
  return {
    lifeScore: number(run.funDebugger?.averageLifeScore || run.summary?.funDebugger?.averageLifeScore),
    artifacts: number(run.summary?.totalArtifacts),
    revealedZones: number(run.summary?.revealedZonesGained),
    meaningfulChoiceDensity: number(run.summary?.meaningfulChoiceDensity),
    decisionEntropy: number(run.summary?.decisionEntropy),
    consequenceVisibility,
    invalidAttempts: number(run.summary?.invalidAttempts),
    zeroStatPlayers: number(run.summary?.zeroStatPlayers),
    tension,
    recovery: number(run.summary?.rescueOutcomes?.stabilized) + Math.max(0, number(run.summary?.statTotalDelta)) / 10,
    readability: Math.max(0, 1 - number(run.summary?.invalidAttempts) / turns),
    outcomeLegibility: terminal * 0.7 + consequenceVisibility * 0.3,
    artifactFrequency: number(run.summary?.totalArtifacts),
    terminalRate: terminal,
    timeoutRate: run.summary?.timedOut === true || run.summary?.outcome === 'timed-out' ? 1 : 0,
  };
}

export function comparePairedReports(baseline = {}, candidate = {}, options = {}) {
  const minimumReplicates = Math.max(2, number(options.minimumReplicates, 10));
  const baselineByKey = new Map((baseline.runs || []).map((run, index) => [runKey(run, index), run]));
  const candidateByKey = new Map((candidate.runs || []).map((run, index) => [runKey(run, index), run]));
  const sharedKeys = [...baselineByKey.keys()].filter((key) => candidateByKey.has(key));
  const seedMismatches = sharedKeys.filter((key) => {
    const beforeSeed = baselineByKey.get(key)?.config?.seed;
    const afterSeed = candidateByKey.get(key)?.config?.seed;
    return beforeSeed && afterSeed && beforeSeed !== afterSeed;
  });
  const strategies = [...new Set(sharedKeys.map((key) => key.split(':')[0]))];
  const replicateFailures = strategies
    .map((strategy) => ({ strategy, count: sharedKeys.filter((key) => key.startsWith(`${strategy}:`)).length }))
    .filter((entry) => entry.count < minimumReplicates);
  const metricNames = Object.keys(runMetrics({}));
  const metrics = {};
  for (const metric of metricNames) {
    const deltas = sharedKeys.map((key) => runMetrics(candidateByKey.get(key))[metric] - runMetrics(baselineByKey.get(key))[metric]);
    const deltaMean = mean(deltas);
    const deviation = standardDeviation(deltas);
    const standardError = deltas.length ? deviation / Math.sqrt(deltas.length) : 0;
    metrics[metric] = {
      pairs: deltas.length,
      baselineMean: mean(sharedKeys.map((key) => runMetrics(baselineByKey.get(key))[metric])),
      candidateMean: mean(sharedKeys.map((key) => runMetrics(candidateByKey.get(key))[metric])),
      meanDelta: deltaMean,
      standardDeviation: deviation,
      pairedEffectSize: deviation > 0 ? deltaMean / deviation : deltaMean === 0 ? 0 : Math.sign(deltaMean) * 99,
      confidenceInterval95: [deltaMean - 1.96 * standardError, deltaMean + 1.96 * standardError],
    };
  }
  const failures = [];
  const baselineEvaluationHash = baseline.simulationContract?.evaluationHash || null;
  const candidateEvaluationHash = candidate.simulationContract?.evaluationHash || null;
  if (!baselineEvaluationHash || !candidateEvaluationHash) failures.push('evaluation-rubric hash missing');
  else if (baselineEvaluationHash !== candidateEvaluationHash) failures.push('evaluation rubric changed between baseline and candidate');
  if (sharedKeys.length === 0) failures.push('no paired runs found');
  if (seedMismatches.length > 0) failures.push(`${seedMismatches.length} paired seed mismatch(es)`);
  for (const entry of replicateFailures) failures.push(`${entry.strategy} has ${entry.count}/${minimumReplicates} paired replicates`);
  const guardrails = {
    invalidAttempts: number(options.maxInvalidAttemptsIncrease, 0.25),
    zeroStatPlayers: number(options.maxZeroStatPlayersIncrease, 0.1),
    meaningfulChoiceDensity: number(options.maxChoiceDensityLoss, -0.03),
    ...(options.guardrails || {}),
  };
  if (metrics.invalidAttempts.meanDelta > guardrails.invalidAttempts) failures.push('invalid-attempt guardrail regressed');
  if (metrics.zeroStatPlayers.meanDelta > guardrails.zeroStatPlayers) failures.push('zero-stat guardrail regressed');
  if (metrics.meaningfulChoiceDensity.meanDelta < guardrails.meaningfulChoiceDensity) failures.push('meaningful-choice guardrail regressed');
  const primaryMetric = options.primaryMetric || null;
  const direction = options.primaryDirection || (['invalidAttempts', 'zeroStatPlayers', 'timeoutRate'].includes(primaryMetric) ? 'decrease' : 'increase');
  const minimumEffect = Math.abs(number(options.minimumEffect, 0));
  const primary = primaryMetric && metrics[primaryMetric] ? metrics[primaryMetric] : null;
  const primaryPassed = primary
    ? direction === 'decrease'
      ? primary.confidenceInterval95[1] <= -minimumEffect
      : primary.confidenceInterval95[0] >= minimumEffect
    : null;
  if (primaryMetric && !primary) failures.push(`unknown primary metric: ${primaryMetric}`);
  const decision = failures.length > 0
    ? 'invalid'
    : primaryPassed === true
      ? 'accepted'
      : primary && ((direction === 'decrease' && primary.meanDelta > 0) || (direction === 'increase' && primary.meanDelta < 0))
        ? 'rejected'
        : 'inconclusive';
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    paired: true,
    minimumReplicates,
    pairs: sharedKeys.length,
    strategies,
    seedMismatches,
    evaluationHashes: { baseline: baselineEvaluationHash, candidate: candidateEvaluationHash },
    replicateFailures,
    metrics,
    primaryMetric,
    primaryDirection: direction,
    minimumEffect,
    primaryPassed,
    decision,
    passed: failures.length === 0,
    failures,
  };
}
