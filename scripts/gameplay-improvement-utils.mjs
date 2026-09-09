import { createHash } from 'crypto';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { readJson, root } from './scenario-utils.mjs';
import { isProductionScenarioId } from './fun-report-utils.mjs';

export const GAMEPLAY_IMPROVEMENT_VERSION = '1.2.0';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function absolute(path) {
  return resolve(root, path);
}

function modified(path) {
  const target = absolute(path);
  return existsSync(target) ? statSync(target).mtimeMs : 0;
}

export function fingerprint(path) {
  const target = absolute(path);
  if (!existsSync(target)) return null;
  return createHash('sha256').update(readFileSync(target)).digest('hex');
}

export function productionScenarios(store = {}) {
  return asArray(store.scenarios).filter((scenario) => isProductionScenarioId(scenario.id, store));
}

export function evaluateCoverage(store = {}, contract = {}) {
  const scenarios = productionScenarios(store);
  const playerCounts = [...new Set(scenarios.map((scenario) => Number(scenario.players)).filter(Boolean))].sort((a, b) => a - b);
  const externalLoops = Object.entries(contract.externalLoopEvidence || {})
    .filter(([, path]) => existsSync(absolute(path)))
    .map(([loop]) => loop);
  const loops = [...new Set([...scenarios.flatMap((scenario) => asArray(scenario.loopCoverage)), ...externalLoops])].sort();
  const requiredPlayerCounts = asArray(contract.requiredPlayerCounts);
  const requiredLoops = asArray(contract.requiredLoops);
  return {
    scenarioCount: scenarios.length,
    scenarioIds: scenarios.map((scenario) => scenario.id),
    playerCounts,
    loops,
    externalLoops,
    missingPlayerCounts: requiredPlayerCounts.filter((count) => !playerCounts.includes(Number(count))),
    missingLoops: requiredLoops.filter((loop) => !loops.includes(loop)),
  };
}

const PIPELINE = [
  { id: 'simulator', output: 'reports/simulator/latest-report.json', inputs: ['scripts/gameplay-simulator.mjs', 'simulator.scenarios.json', 'simulator.agent-policies.json', 'simulator.evaluation.json'] },
  { id: 'oracle', output: 'reports/simulator/oracle/project-latest.json', inputs: ['scripts/gameplay-oracle-utils.mjs', 'simulator.scenarios.json', 'reports/simulator/latest-report.json'] },
  { id: 'feeling', output: 'reports/simulator/feeling-black-box/index.json', inputs: ['scripts/player-feeling-black-box-utils.mjs', 'reports/simulator/oracle/project-latest.json'] },
  { id: 'memory', output: 'reports/simulator/memory/index.json', inputs: ['scripts/playable-design-memory-utils.mjs', 'reports/simulator/oracle/project-latest.json', 'reports/simulator/feeling-black-box/index.json'] },
  { id: 'time-machine', output: 'reports/simulator/time-machine/index.json', inputs: ['scripts/scenario-time-machine-utils.mjs', 'reports/simulator/memory/index.json'] },
  { id: 'lab', output: 'reports/simulator/lab-notebook/index.json', inputs: ['scripts/scenario-lab-notebook-utils.mjs', 'reports/simulator/memory/index.json', 'reports/simulator/time-machine/index.json'] },
  { id: 'tutor', output: 'reports/simulator/tutor/latest-curriculum.json', inputs: ['scripts/scenario-self-driving-tutor-utils.mjs', 'reports/simulator/lab-notebook/index.json', 'reports/simulator/memory/index.json'] },
  { id: 'bridge', output: 'reports/bridge/latest-report.json', inputs: ['scripts/scenario-evidence-bridge-utils.mjs', 'reports/simulator/oracle/project-latest.json', 'reports/simulator/feeling-black-box/index.json', 'reports/simulator/tutor/latest-curriculum.json'] },
  { id: 'fun', output: 'reports/fun/latest-report.json', inputs: ['scripts/fun-report-utils.mjs', 'reports/simulator/feeling-black-box/index.json', 'reports/simulator/time-machine/index.json', 'reports/bridge/latest-report.json'] },
];

export function inspectPipeline() {
  return PIPELINE.map((stage) => {
    const outputModified = modified(stage.output);
    const newestInput = Math.max(...stage.inputs.map(modified), 0);
    const missingInputs = stage.inputs.filter((path) => !existsSync(absolute(path)));
    return {
      ...stage,
      outputExists: outputModified > 0,
      missingInputs,
      fresh: outputModified > 0 && missingInputs.length === 0 && outputModified >= newestInput,
      outputHash: fingerprint(stage.output),
      outputModifiedAt: outputModified ? new Date(outputModified).toISOString() : null,
      newestInputAt: newestInput ? new Date(newestInput).toISOString() : null,
    };
  });
}

export function evaluateCalibration(playtests = {}, contract = {}) {
  const sessions = asArray(playtests.sessions);
  const minimum = Number(contract.humanCalibration?.minimumObservedSessions || 5);
  const rated = sessions.filter((session) => Number.isFinite(Number(session.funScore)) && Number.isFinite(Number(session.automatedFunScore)));
  const agreements = sessions.filter((session) => ['agree', 'disagree'].includes(session.recommendationAgreement));
  const agreementRate = agreements.length
    ? agreements.filter((session) => session.recommendationAgreement === 'agree').length / agreements.length
    : null;
  const correlation = rated.length >= 3 ? (() => {
    const playerMean = rated.reduce((sum, session) => sum + Number(session.funScore), 0) / rated.length;
    const automatedMean = rated.reduce((sum, session) => sum + Number(session.automatedFunScore), 0) / rated.length;
    const numerator = rated.reduce((sum, session) => sum + ((Number(session.funScore) - playerMean) * (Number(session.automatedFunScore) - automatedMean)), 0);
    const playerSpread = Math.sqrt(rated.reduce((sum, session) => sum + ((Number(session.funScore) - playerMean) ** 2), 0));
    const automatedSpread = Math.sqrt(rated.reduce((sum, session) => sum + ((Number(session.automatedFunScore) - automatedMean) ** 2), 0));
    return playerSpread > 0 && automatedSpread > 0 ? numerator / (playerSpread * automatedSpread) : null;
  })() : null;
  const minimumCorrelation = Number(contract.humanCalibration?.minimumFunScoreCorrelation || 0.5);
  return {
    sessions: sessions.length,
    minimumSessions: minimum,
    enoughSessions: sessions.length >= minimum,
    pairedRatings: rated.length,
    recommendationAgreementRate: agreementRate,
    funScoreCorrelation: correlation,
    minimumFunScoreCorrelation: minimumCorrelation,
    calibrated: sessions.length >= minimum
      && agreementRate !== null
      && agreementRate >= Number(contract.humanCalibration?.minimumRecommendationAgreement || 0.6)
      && correlation !== null
      && correlation >= minimumCorrelation,
  };
}

export function evaluateEffectiveness({ experiments = {}, decisions = {}, funReport = {} } = {}) {
  const experimentItems = asArray(experiments.experiments);
  const resolvedItems = experimentItems.filter((item) => ['accepted', 'rejected', 'complete', 'completed'].includes(item.status)
    || (item.decision && !['pending', 'planned'].includes(item.decision)));
  const acceptedItems = resolvedItems.filter((item) => item.status === 'accepted' || item.decision === 'accepted');
  const measuredDurations = resolvedItems.map((item) => {
    const start = Date.parse(item.startedAt || item.createdAt || '');
    const end = Date.parse(item.resolvedAt || item.completedAt || '');
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? (end - start) / 3_600_000 : null;
  }).filter(Number.isFinite).sort((a, b) => a - b);
  const medianDuration = measuredDurations.length
    ? measuredDurations[Math.floor(measuredDurations.length / 2)]
    : null;
  const decisionItems = asArray(decisions.decisions);
  return {
    experiments: experimentItems.length,
    resolvedExperiments: resolvedItems.length,
    experimentResolutionRate: experimentItems.length ? resolvedItems.length / experimentItems.length : 0,
    recommendationAcceptanceRate: resolvedItems.length ? acceptedItems.length / resolvedItems.length : null,
    recordedDecisions: decisionItems.length,
    regressionsCaught: asArray(funReport.releaseBlockers).filter((item) => item.gate === 'regressing').length,
    productionBlockers: Number(funReport.metrics?.releaseBlockerCount || 0),
    falsePositiveRate: resolvedItems.some((item) => typeof item.falsePositive === 'boolean')
      ? resolvedItems.filter((item) => item.falsePositive === true).length / resolvedItems.filter((item) => typeof item.falsePositive === 'boolean').length
      : null,
    medianTimeToLearningHours: medianDuration,
    note: 'False-positive rate and time-to-learning require completed experiments with timestamps.',
  };
}

export function buildGameplayImprovementReport({ generatedAt = new Date().toISOString() } = {}) {
  const store = readJson(absolute('simulator.scenarios.json'), { scenarios: [] });
  const contract = readJson(absolute('gameplay.quality-contract.json'), {});
  const funReport = readJson(absolute('reports/fun/latest-report.json'), {});
  const pipeline = inspectPipeline();
  const coverage = evaluateCoverage(store, contract);
  const exactRunnerReport = readJson(absolute('reports/gameplay-improvement/exact-runner/latest-report.json'), null);
  const exactSourceDrift = Object.entries(exactRunnerReport?.sourceHashes || {})
    .filter(([path, hash]) => fingerprint(path) !== hash)
    .map(([path]) => path);
  const exactScenarioResults = asArray(exactRunnerReport?.scenarios);
  const exactRun = {
    reportPath: 'reports/gameplay-improvement/exact-runner/latest-report.json',
    exists: Boolean(exactRunnerReport),
    passed: exactRunnerReport?.passed === true,
    generatedAt: exactRunnerReport?.generatedAt || null,
    batch: Number(exactRunnerReport?.batch || 0),
    managedRpc: exactRunnerReport?.rpc?.managed === true,
    scenarioIds: exactScenarioResults.map((item) => item.scenarioId),
    passedScenarioIds: exactScenarioResults.filter((item) => item.status === 'passed').map((item) => item.scenarioId),
    failedScenarioIds: exactScenarioResults.filter((item) => item.status === 'failed').map((item) => item.scenarioId),
    cachedScenarioIds: exactScenarioResults.filter((item) => item.cached).map((item) => item.scenarioId),
    sourceDrift: exactSourceDrift,
  };
  const scenarioEvidence = productionScenarios(store).map((scenario) => {
    const simulatorPath = `reports/simulator/scenarios/${scenario.id}/latest-report.json`;
    const oraclePath = `reports/simulator/scenarios/${scenario.id}/latest-oracle.json`;
    const oracle = readJson(absolute(oraclePath), null);
    const simulatorModified = modified(simulatorPath);
    const newestSimulatorInput = Math.max(modified('scripts/gameplay-simulator.mjs'), modified('simulator.scenarios.json'), modified('simulator.agent-policies.json'), modified('simulator.evaluation.json'));
    return {
      scenarioId: scenario.id,
      simulatorPath,
      oraclePath,
      hasSimulatorReport: existsSync(absolute(simulatorPath)),
      hasOracleReport: Boolean(oracle),
      simulatorEvidenceFresh: simulatorModified > 0 && simulatorModified >= newestSimulatorInput,
      verdict: oracle?.oracleVerdict || null,
      truthGatesPassed: oracle?.truthGates?.passed === true,
      truthGateFailures: [...asArray(oracle?.truthGates?.hardFailures), ...asArray(oracle?.truthGates?.confidenceFailures)],
    };
  });
  const calibration = evaluateCalibration(readJson(absolute('improvement/records/playtests.json'), {}), contract);
  const effectiveness = evaluateEffectiveness({
    experiments: readJson(absolute('gameplay.experiments.json'), {}),
    decisions: readJson(absolute('improvement/records/decisions.json'), {}),
    funReport,
  });
  const automatedOnly = contract.evaluationMode === 'automated-only' || contract.humanCalibration?.enabled === false;
  const checks = {
    splitPolicyAndEvaluation: Boolean(fingerprint('simulator.agent-policies.json') && fingerprint('simulator.evaluation.json')),
    scenarioCoverage: coverage.missingPlayerCounts.length === 0 && coverage.missingLoops.length === 0,
    canonicalEvidenceComplete: scenarioEvidence.every((item) => item.hasSimulatorReport && item.hasOracleReport && item.simulatorEvidenceFresh && item.truthGatesPassed),
    pipelineFresh: pipeline.every((stage) => stage.fresh),
    productionEvidenceClean: Number(funReport.evidenceHygiene?.excludedCount || 0) >= 0
      && !asArray(funReport.scenarioQualities).some((item) => /^autopilot(?:-test)?-/i.test(item.scenarioId || '')),
    pairedExperimentContract: Number(contract.minimumIndependentReplicates || 0) >= 10 && contract.requirePairedSeeds === true,
    selfManagedExactRunner: Boolean(fingerprint('scripts/gameplay-exact-runner.mjs')),
    ...(automatedOnly ? {} : { humanCalibration: calibration.calibrated }),
  };
  const architectureChecks = ['splitPolicyAndEvaluation', 'scenarioCoverage', 'productionEvidenceClean', 'pairedExperimentContract', 'selfManagedExactRunner'];
  const evidenceChecks = ['canonicalEvidenceComplete', 'pipelineFresh'];
  const gradeFor = (ids, ceiling = 'A') => {
    const passed = ids.filter((id) => checks[id]).length;
    if (passed === ids.length) return ceiling;
    if (passed >= ids.length - 1) return 'B+';
    if (passed >= Math.max(1, ids.length - 2)) return 'B';
    return 'C';
  };
  const architectureGrade = gradeFor(architectureChecks, 'A');
  const evidenceGrade = gradeFor(evidenceChecks, 'A');
  const grade = evidenceGrade;
  const missingEvidence = scenarioEvidence.filter((item) => !item.hasSimulatorReport || !item.hasOracleReport || !item.simulatorEvidenceFresh);
  const incompleteTruth = scenarioEvidence.filter((item) => item.hasSimulatorReport && !item.truthGatesPassed);
  const nextActions = [
    ...(coverage.missingPlayerCounts.length || coverage.missingLoops.length ? [{
      priority: 'P0',
      title: 'Complete canonical scenario coverage',
      command: 'npm run scenario:validate',
      reason: [...coverage.missingPlayerCounts.map((count) => `${count}P`), ...coverage.missingLoops].join(', '),
      estimatedMinutes: 10,
    }] : []),
    ...(missingEvidence.length ? [{
      priority: 'P0',
      title: 'Refresh exact same-engine evidence',
      command: 'npm run gameplay:refresh:exact -- --resume',
      reason: `${missingEvidence.length} canonical scenarios are missing or stale`,
      estimatedMinutes: Math.max(15, scenarioEvidence.length * 8),
    }] : []),
    ...(incompleteTruth.length ? [{
      priority: 'P0',
      title: 'Repair truth-gated gameplay loops',
      command: `npm run oracle:scenario -- --id=${incompleteTruth[0].scenarioId}`,
      reason: incompleteTruth.map((item) => `${item.scenarioId}: ${item.truthGateFailures.join('; ')}`).join(' | '),
      estimatedMinutes: 30,
    }] : []),
    ...(!checks.pipelineFresh ? [{
      priority: 'P1',
      title: 'Rebuild derived gameplay evidence',
      command: 'npm run gameplay:refresh',
      reason: pipeline.filter((stage) => !stage.fresh).map((stage) => stage.id).join(', '),
      estimatedMinutes: 3,
    }] : []),
    ...(effectiveness.resolvedExperiments === 0 ? [{
      priority: 'P1',
      title: 'Resolve the first pre-registered experiment',
      command: 'npm run gameplay:experiment -- --strict --baseline=<path> --candidate=<path>',
      reason: `${effectiveness.experiments} experiments are planned and none are resolved`,
      estimatedMinutes: 20,
    }] : []),
  ];
  return {
    schemaVersion: 1,
    systemVersion: GAMEPLAY_IMPROVEMENT_VERSION,
    generatedAt,
    grade,
    grades: { architecture: architectureGrade, evidenceReadiness: evidenceGrade },
    evaluationMode: automatedOnly ? 'automated-only' : 'human-calibrated',
    qualityPassed: Object.values(checks).every(Boolean),
    checks,
    coverage,
    exactRun,
    scenarioEvidence,
    pipeline,
    calibration,
    effectiveness,
    nextActions,
    sourceHashes: Object.fromEntries([
      'simulator.scenarios.json',
      'simulator.agent-policies.json',
      'simulator.evaluation.json',
      'gameplay.quality-contract.json',
      'gameplay.experiments.json',
      'scripts/gameplay-simulator.mjs',
      'scripts/gameplay-oracle-utils.mjs',
      'scripts/gameplay-exact-runner.mjs',
    ].map((path) => [path, fingerprint(path)])),
    blockers: [
      ...coverage.missingPlayerCounts.map((count) => `missing ${count}-player scenario coverage`),
      ...coverage.missingLoops.map((loop) => `missing loop coverage: ${loop}`),
      ...scenarioEvidence.filter((item) => !item.hasSimulatorReport).map((item) => `missing same-engine evidence: ${item.scenarioId}`),
      ...scenarioEvidence.filter((item) => item.hasSimulatorReport && !item.simulatorEvidenceFresh).map((item) => `stale same-engine evidence: ${item.scenarioId}`),
      ...scenarioEvidence.filter((item) => item.hasSimulatorReport && !item.truthGatesPassed).map((item) => `truth gates incomplete: ${item.scenarioId} (${item.truthGateFailures.join('; ')})`),
      ...pipeline.filter((stage) => !stage.fresh).map((stage) => `stale or missing pipeline stage: ${stage.id}`),
      ...(!automatedOnly && !calibration.calibrated ? [`human calibration needs ${Math.max(0, calibration.minimumSessions - calibration.sessions)} more observed sessions and agreement labels`] : []),
    ],
  };
}
