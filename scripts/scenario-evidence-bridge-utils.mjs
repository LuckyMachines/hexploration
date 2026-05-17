import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import {
  loadScenarioStore,
  readJson,
  root,
  slugify,
  writeJson,
} from './scenario-utils.mjs';

export const BRIDGE_VERSION = '1.0.0';
export const bridgeReportRoot = resolve(root, 'reports', 'bridge');
export const publicBridgeRoot = resolve(root, 'app', 'public', 'bridge');
export const FEATURED_READY_THRESHOLD = 78;
export const PLAYABLE_THRESHOLD = 56;
export const TARGET_ARC_FALLBACK = 64;
export const STALE_DAYS = 14;

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''));
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(number(value))));
}

function timestamp(value) {
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysOld(value, generatedAt = nowIso()) {
  const time = timestamp(value);
  if (!time) return Infinity;
  return Math.max(0, (timestamp(generatedAt) - time) / 86400000);
}

function latestByGeneratedAt(items = []) {
  return [...items].filter(Boolean).sort((a, b) => timestamp(b.generatedAt || b.latestGeneratedAt || b.timestamp) - timestamp(a.generatedAt || a.latestGeneratedAt || a.timestamp))[0] || null;
}

function byScenario(items = [], scenarioId = '') {
  const id = slugify(scenarioId);
  return latestByGeneratedAt(asArray(items).filter((item) => slugify(item.scenarioId || item.id || item.scenario?.id) === id));
}

function hasGoodMoment(feeling = null, fun = null) {
  const labels = [feeling?.bestMomentLabel, fun?.shareWorthyMoment?.feelingLabel, fun?.shareWorthyMoment?.momentTitle].filter(Boolean).map((item) => String(item).toLowerCase());
  return labels.some((label) => /payoff|surprise|recovery|alive|clutch|escape|artifact/.test(label)) || Boolean(fun?.gates?.shareWorthy);
}

function setupBlocked(setup = null, lab = null, timeMachine = null) {
  const status = lab?.readiness?.status;
  const setupLevel = setup?.setupLevel || setup?.appliedLevel || setup?.application?.level || setup?.setupApplication?.level || timeMachine?.setupLevel;
  const failed = number(setup?.summary?.failed ?? setup?.failed ?? setup?.setupApplication?.failed?.length);
  const blockedFields = [
    ...asArray(setup?.blockedFields),
    ...asArray(setup?.summary?.blockedFields),
    ...asArray(setup?.setupApplication?.failed).map((item) => item.field || item.key),
    ...asArray(setup?.setupApplication?.skipped).filter((item) => item.support === 'notYetSupported').map((item) => item.field || item.key),
  ].filter(Boolean);
  return status === 'blocked-by-setup' || setupLevel === 'blocked' || failed > 0 || blockedFields.length > 0;
}

function publicRouteFor(scenarioId, seed = null) {
  const query = [`scenario=${encodeURIComponent(scenarioId)}`];
  if (seed) query.push(`seed=${encodeURIComponent(seed)}`);
  return `/play?${query.join('&')}`;
}

function challengeRouteFor(scenarioId, seed) {
  return `/challenge?scenario=${encodeURIComponent(scenarioId)}&seed=${encodeURIComponent(seed)}`;
}

export function bridgePaths() {
  return {
    latest: resolve(bridgeReportRoot, 'latest-report.json'),
    latestMarkdown: resolve(bridgeReportRoot, 'latest-report.md'),
    publicLatest: resolve(publicBridgeRoot, 'latest-report.json'),
  };
}

export function bridgeScenarioPaths(scenarioId) {
  const id = slugify(scenarioId);
  return {
    dir: resolve(bridgeReportRoot, id),
    readiness: resolve(bridgeReportRoot, id, 'readiness.json'),
    markdown: resolve(bridgeReportRoot, id, 'readiness.md'),
    publicReadiness: resolve(publicBridgeRoot, id, 'readiness.json'),
  };
}

export function loadBridgeEvidence({ scenarioStore = loadScenarioStore() } = {}) {
  return {
    scenarioStore,
    feelingIndex: readJson(resolve(root, 'reports', 'simulator', 'feeling-black-box', 'index.json'), null),
    timeMachineIndex: readJson(resolve(root, 'reports', 'simulator', 'time-machine', 'index.json'), null),
    labIndex: readJson(resolve(root, 'reports', 'simulator', 'lab-notebook', 'index.json'), null),
    funReport: readJson(resolve(root, 'reports', 'fun', 'latest-report.json'), null),
    growthReport: readJson(resolve(root, 'reports', 'growth', 'latest-report.json'), null),
    oracleIndex: readJson(resolve(root, 'reports', 'simulator', 'oracle', 'summary-index.json'), null),
    setupIndex: readJson(resolve(root, 'reports', 'simulator', 'setup-forge', 'index.json'), null),
  };
}

export function normalizeScenarioDefinition(scenario = {}) {
  const id = slugify(scenario.id || scenario.scenarioId);
  return compact({
    scenarioId: id,
    name: scenario.name || scenario.title || id,
    designQuestion: scenario.designQuestion || scenario.description,
    players: number(scenario.players, 1),
    turns: number(scenario.turns || scenario.maxTurns, 6),
    tags: asArray(scenario.tags),
    targetArcScore: number(scenario.targetArcScore || scenario.oracleGoals?.minimums?.emotionalTexture, TARGET_ARC_FALLBACK),
    requiredSetupLevel: scenario.requiredSetupLevel || scenario.setupForge?.requiredSetupLevel,
    setupLevel: scenario.setupForge?.requiredSetupLevel,
    importance: scenario.importance,
    command: `npm run scenario:run -- --id=${id}`,
  });
}

export function findFeelingEvidence(evidence = {}, scenarioId = '') {
  return byScenario(evidence.feelingIndex?.scenarios, scenarioId);
}

export function findTimeMachineEvidence(evidence = {}, scenarioId = '') {
  return byScenario(evidence.timeMachineIndex?.scenarios, scenarioId);
}

export function findLabEvidence(evidence = {}, scenarioId = '') {
  return byScenario(evidence.labIndex?.scenarios, scenarioId);
}

export function findFunEvidence(evidence = {}, scenarioId = '') {
  return byScenario(evidence.funReport?.scenarioQualities, scenarioId);
}

export function findGrowthEvidence(evidence = {}, scenarioId = '') {
  return byScenario(evidence.growthReport?.topScenarios, scenarioId) || compact({
    scenarioId,
    completions: 0,
    startsOrEvidence: evidence.growthReport?.scenarioCounts?.[scenarioId] || 0,
    completionRate: 0,
  });
}

export function findOracleEvidence(evidence = {}, scenarioId = '') {
  const source = Array.isArray(evidence.oracleIndex) ? evidence.oracleIndex : evidence.oracleIndex?.scenarios;
  return byScenario(source, scenarioId);
}

export function findSetupEvidence(evidence = {}, scenarioId = '') {
  const indexed = byScenario(evidence.setupIndex?.scenarios || evidence.setupIndex, scenarioId);
  if (indexed) return indexed;
  const id = slugify(scenarioId);
  const perScenario = resolve(root, 'reports', 'simulator', 'scenarios', id, 'latest-setup-report.json');
  return existsSync(perScenario) ? readJson(perScenario, null) : null;
}

export function buildScenarioEvidenceBundle({ scenario = {}, evidence = {} } = {}) {
  const definition = normalizeScenarioDefinition(scenario);
  const scenarioId = definition.scenarioId;
  return {
    definition,
    feeling: findFeelingEvidence(evidence, scenarioId),
    timeMachine: findTimeMachineEvidence(evidence, scenarioId),
    lab: findLabEvidence(evidence, scenarioId),
    fun: findFunEvidence(evidence, scenarioId),
    growth: findGrowthEvidence(evidence, scenarioId),
    oracle: findOracleEvidence(evidence, scenarioId),
    setup: findSetupEvidence(evidence, scenarioId),
  };
}

export function blockersForBundle(bundle = {}, generatedAt = nowIso()) {
  const blockers = [];
  const { definition, feeling, timeMachine, lab, fun, setup } = bundle;
  if (!definition?.scenarioId) blockers.push({ code: 'missing-scenario', severity: 'hard', message: 'No scenario definition exists.' });
  if (!feeling && !timeMachine && !lab && !fun) blockers.push({ code: 'missing-evidence', severity: 'hard', message: 'No simulator-family readiness evidence exists.' });
  if (setupBlocked(setup, lab, timeMachine)) blockers.push({ code: 'setup-blocked', severity: 'hard', message: 'Setup fidelity or failed setup fields block a trustworthy public claim.' });
  if (timeMachine?.trend === 'regressing' || lab?.readiness?.status === 'regressed') blockers.push({ code: 'regressing', severity: 'hard', message: 'Latest evidence is regressing.' });
  if (['blocked-by-setup', 'regressed'].includes(lab?.readiness?.status)) blockers.push({ code: 'lab-blocked', severity: 'hard', message: `Lab readiness is ${lab.readiness.status}.` });
  const firstAlive = feeling?.firstAliveTurn ?? fun?.firstAliveTurn;
  if ((feeling || fun) && (firstAlive === null || firstAlive === undefined || number(firstAlive, 99) > 2)) {
    blockers.push({ code: 'late-first-alive', severity: 'featured', message: 'First alive turn is missing or later than turn 2, so it should not be featured yet.' });
  }
  const firstFlat = feeling?.firstFlatTurn ?? fun?.firstFlatTurn;
  if (firstFlat !== null && firstFlat !== undefined && number(firstFlat, 99) <= 1) blockers.push({ code: 'early-flat-turn', severity: 'hard', message: 'The run goes flat too early.' });
  if (fun && fun.gates?.shareWorthy === false && !hasGoodMoment(feeling, fun)) blockers.push({ code: 'no-share-worthy-moment', severity: 'featured', message: 'No share-worthy moment has been detected.' });
  if (daysOld(feeling?.generatedAt || timeMachine?.latestGeneratedAt || lab?.latestGeneratedAt, generatedAt) > STALE_DAYS * 2 && (feeling || timeMachine || lab)) {
    blockers.push({ code: 'stale-evidence', severity: 'featured', message: 'Primary readiness evidence is stale.' });
  }
  return blockers;
}

export function warningsForBundle(bundle = {}, generatedAt = nowIso()) {
  const warnings = [];
  const { definition, feeling, timeMachine, lab, fun, growth, oracle, setup } = bundle;
  const arcScore = number(feeling?.arcScore ?? fun?.arcScore, NaN);
  if (definition?.requiredSetupLevel === 'partial' || setup?.setupLevel === 'partial') warnings.push({ code: 'partial-setup', message: 'Scenario depends on partial setup support.' });
  if (Number.isFinite(arcScore) && arcScore < number(definition?.targetArcScore, TARGET_ARC_FALLBACK)) warnings.push({ code: 'arc-below-target', message: `Arc score ${arcScore} is below target ${definition.targetArcScore}.` });
  if (number(growth?.completions) <= 0) warnings.push({ code: 'no-completions', message: 'No public completions are recorded yet.' });
  if (number(growth?.shareEvents ?? growth?.shares) <= 0) warnings.push({ code: 'no-shares', message: 'No public share events are recorded yet.' });
  if (daysOld(feeling?.generatedAt || timeMachine?.latestGeneratedAt || lab?.latestGeneratedAt, generatedAt) > STALE_DAYS && (feeling || timeMachine || lab)) warnings.push({ code: 'stale', message: 'Readiness evidence is older than the freshness target.' });
  if (oracle?.confidence !== undefined && number(oracle.confidence, 1) < 0.6) warnings.push({ code: 'low-oracle-confidence', message: `Oracle confidence is ${Math.round(number(oracle.confidence) * 100)}%.` });
  if (number(lab?.unresolvedCount) > 0) warnings.push({ code: 'unresolved-assumptions', message: `${lab.unresolvedCount} lab assumption(s) remain unresolved.` });
  if (number(timeMachine?.timelineCount) > 0 && number(timeMachine.timelineCount) < 2) warnings.push({ code: 'insufficient-history', message: 'Only one timeline point exists.' });
  if (fun && fun.funVerdict !== 'share-worthy') warnings.push({ code: 'fun-not-share-worthy', message: `Fun verdict is ${fun.funVerdict}.` });
  return warnings;
}

export function scoreScenarioReadiness(bundle = {}, blockers = [], warnings = []) {
  const { definition, feeling, timeMachine, lab, fun, growth } = bundle;
  const reasons = [];
  let score = 0;
  const arcScore = number(feeling?.arcScore ?? fun?.arcScore, NaN);
  const firstAlive = feeling?.firstAliveTurn ?? fun?.firstAliveTurn;
  if (feeling) {
    score += 25;
    reasons.push('Feeling evidence exists.');
  }
  if (Number.isFinite(arcScore) && arcScore >= number(definition?.targetArcScore, TARGET_ARC_FALLBACK)) {
    score += 20;
    reasons.push(`Arc score ${arcScore} meets target.`);
  }
  if (firstAlive !== null && firstAlive !== undefined && number(firstAlive, 99) <= 2) {
    score += 15;
    reasons.push('The scenario feels alive by turn 2.');
  }
  if (hasGoodMoment(feeling, fun)) {
    score += 10;
    reasons.push('Payoff or share-worthy moment exists.');
  }
  if (fun?.gates?.recovery || String(feeling?.arcShape || '').includes('recovery')) {
    score += 10;
    reasons.push('Recovery or comeback evidence exists.');
  }
  if (['stable', 'improving', 'local-evidence'].includes(timeMachine?.trend)) {
    score += 10;
    reasons.push(`Scenario trend is ${timeMachine.trend}.`);
  }
  if (['ready', 'ready-with-caveats'].includes(lab?.readiness?.status)) {
    score += 10;
    reasons.push(`Lab readiness is ${lab.readiness.status}.`);
  }
  if (number(growth?.completions) > 0) {
    score += 5;
    reasons.push('Public completion evidence exists.');
  }
  if (number(growth?.shareEvents ?? growth?.shares) > 0) {
    score += 5;
    reasons.push('Share evidence exists.');
  }
  for (const blocker of blockers) score -= blocker.severity === 'hard' ? 18 : 10;
  score -= Math.min(18, warnings.length * 3);
  return { score: clamp(score), reasons };
}

export function verdictForScenario(score = 0, blockers = [], bundle = {}) {
  const hardCodes = new Set(blockers.filter((item) => item.severity === 'hard').map((item) => item.code));
  if (hardCodes.has('missing-scenario') || hardCodes.has('missing-evidence')) return 'missing-evidence';
  if (hardCodes.has('setup-blocked') || hardCodes.has('lab-blocked')) return 'blocked-by-setup';
  if (hardCodes.has('regressing')) return 'regressing';
  if (score >= FEATURED_READY_THRESHOLD && blockers.filter((item) => item.severity === 'featured').length === 0) return 'featured-ready';
  if (score >= PLAYABLE_THRESHOLD) return 'playable-with-caveats';
  if (bundle.fun || bundle.feeling) return 'needs-fun-work';
  return 'missing-evidence';
}

export function nextFixForScenario(bundle = {}, blockers = [], warnings = []) {
  const { definition, feeling, timeMachine, lab, fun } = bundle;
  const scenarioId = definition?.scenarioId || 'scenario';
  const firstBlocker = blockers[0];
  if (firstBlocker?.code === 'missing-evidence') {
    return {
      title: 'Capture exact-engine scenario evidence',
      command: `npm run scenario:run -- --id=${scenarioId} && npm run feel:scenario -- --id=${scenarioId} && npm run bridge:scenario -- --id=${scenarioId}`,
      reason: 'The bridge will not promote a scenario without simulator-family evidence.',
    };
  }
  if (['setup-blocked', 'lab-blocked'].includes(firstBlocker?.code) || lab?.readiness?.status === 'blocked-by-setup') {
    return {
      title: 'Repair setup fidelity',
      command: `npm run setup:explain -- --id=${scenarioId}`,
      reason: 'Public promotion needs supported starting conditions or an explicit caveat.',
    };
  }
  if (firstBlocker?.code === 'regressing' || timeMachine?.trend === 'regressing') {
    return {
      title: 'Compare against the last good run',
      command: `npm run time-machine:compare -- --id=${scenarioId} --against=last-good --markdown`,
      reason: 'Regressing evidence should be understood before featuring the scenario.',
    };
  }
  if (fun?.recommendation?.command || feeling?.recommendation?.command) {
    return {
      title: fun?.recommendation?.title || feeling?.recommendation?.title || 'Improve scenario feel',
      command: fun?.recommendation?.command || feeling?.recommendation?.command,
      reason: fun?.recommendation?.reason || feeling?.recommendation?.reason || 'The weakest fun or feeling gate points here.',
    };
  }
  if (warnings.some((item) => item.code === 'no-completions' || item.code === 'no-shares')) {
    return {
      title: 'Capture public run evidence',
      command: 'Open /play, complete a run, generate a share card, then run npm run growth:report && npm run bridge:build.',
      reason: 'Promotion confidence increases when players complete and share runs.',
    };
  }
  return {
    title: 'Refresh bridge evidence',
    command: `npm run feel:scenario -- --id=${scenarioId} && npm run bridge:scenario -- --id=${scenarioId}`,
    reason: 'Fresh felt-control evidence keeps the public route honest.',
  };
}

export function buildScenarioReadiness({ scenario = {}, evidence = {}, generatedAt = nowIso() } = {}) {
  const bundle = buildScenarioEvidenceBundle({ scenario, evidence });
  const blockers = blockersForBundle(bundle, generatedAt);
  const warnings = warningsForBundle(bundle, generatedAt);
  const scored = scoreScenarioReadiness(bundle, blockers, warnings);
  const verdict = verdictForScenario(scored.score, blockers, bundle);
  const scenarioId = bundle.definition.scenarioId;
  const seed = `${scenarioId}-bridge-${generatedAt.slice(0, 10)}`;
  const eligible = ['featured-ready', 'playable-with-caveats'].includes(verdict);
  return {
    schemaVersion: 1,
    bridgeVersion: BRIDGE_VERSION,
    generatedAt,
    scenarioId,
    name: bundle.definition.name,
    eligible,
    readinessScore: scored.score,
    gateVerdict: verdict,
    reasons: scored.reasons,
    blockers,
    warnings,
    evidence: compact({
      scenario: bundle.definition,
      feeling: bundle.feeling,
      timeMachine: bundle.timeMachine,
      lab: bundle.lab,
      fun: bundle.fun,
      growth: bundle.growth,
      oracle: bundle.oracle,
      setup: bundle.setup,
    }),
    publicRoute: publicRouteFor(scenarioId),
    challengeRoute: challengeRouteFor(scenarioId, seed),
    challengeSeed: seed,
    nextFix: nextFixForScenario(bundle, blockers, warnings),
  };
}

export function publicScenarioReadiness(readiness = {}) {
  return {
    scenarioId: readiness.scenarioId,
    name: readiness.name,
    eligible: readiness.eligible,
    readinessScore: readiness.readinessScore,
    gateVerdict: readiness.gateVerdict,
    reasons: asArray(readiness.reasons).slice(0, 4),
    blockers: asArray(readiness.blockers).map((item) => ({ code: item.code, message: item.message })),
    warnings: asArray(readiness.warnings).map((item) => ({ code: item.code, message: item.message })).slice(0, 5),
    publicRoute: readiness.publicRoute,
    challengeRoute: readiness.challengeRoute,
    challengeSeed: readiness.challengeSeed,
    nextFix: readiness.nextFix,
    evidence: {
      feeling: compact({
        arcScore: readiness.evidence?.feeling?.arcScore,
        arcShape: readiness.evidence?.feeling?.arcShape,
        firstAliveTurn: readiness.evidence?.feeling?.firstAliveTurn,
        sourcePath: readiness.evidence?.feeling?.sourcePath,
      }),
      timeMachine: compact({
        trend: readiness.evidence?.timeMachine?.trend,
        latestHealth: readiness.evidence?.timeMachine?.latestHealth,
        latestGeneratedAt: readiness.evidence?.timeMachine?.latestGeneratedAt,
      }),
      lab: compact({
        readiness: readiness.evidence?.lab?.readiness,
        latestLearning: readiness.evidence?.lab?.latestLearning,
      }),
    },
  };
}

export function buildBridgePublicPayload(report = {}) {
  return {
    schemaVersion: 1,
    bridgeVersion: report.bridgeVersion,
    generatedAt: report.generatedAt,
    verdict: report.verdict,
    featuredScenario: report.featuredScenario ? publicScenarioReadiness(report.featuredScenario) : null,
    challengeScenario: report.challengeScenario ? publicScenarioReadiness(report.challengeScenario) : null,
    scenarios: asArray(report.scenarios).map(publicScenarioReadiness),
    doctor: report.doctor,
  };
}

export function buildBridgeReport({ evidence = loadBridgeEvidence(), generatedAt = nowIso() } = {}) {
  const scenarios = asArray(evidence.scenarioStore?.scenarios)
    .filter((scenario) => scenario.archived !== true)
    .map((scenario) => buildScenarioReadiness({ scenario, evidence, generatedAt }))
    .sort((a, b) => b.readinessScore - a.readinessScore || a.scenarioId.localeCompare(b.scenarioId));
  const featuredScenario = scenarios.find((scenario) => scenario.gateVerdict === 'featured-ready') || scenarios.find((scenario) => scenario.gateVerdict === 'playable-with-caveats') || scenarios[0] || null;
  const challengeScenario = scenarios.find((scenario) => scenario.eligible && /escape|cooperation|survival|pressure/.test(asArray(scenario.evidence?.scenario?.tags).join(' ')))
    || featuredScenario
    || scenarios[0]
    || null;
  const report = {
    schemaVersion: 1,
    bridgeVersion: BRIDGE_VERSION,
    generatedAt,
    verdict: featuredScenario?.gateVerdict || 'missing-evidence',
    featuredScenario,
    challengeScenario,
    scenarioCount: scenarios.length,
    scenarios,
    doctor: bridgeDoctor({ scenarios }),
  };
  return report;
}

export function writeBridgeReport(report, { markdown = true } = {}) {
  const paths = bridgePaths();
  writeJson(paths.latest, report);
  writeJson(paths.publicLatest, buildBridgePublicPayload(report));
  for (const scenario of asArray(report.scenarios)) {
    const scenarioPaths = bridgeScenarioPaths(scenario.scenarioId);
    writeJson(scenarioPaths.readiness, scenario);
    writeJson(scenarioPaths.publicReadiness, publicScenarioReadiness(scenario));
    if (markdown) {
      mkdirSync(dirname(scenarioPaths.markdown), { recursive: true });
      writeFileSync(scenarioPaths.markdown, markdownForScenarioReadiness(scenario));
    }
  }
  if (markdown) {
    mkdirSync(dirname(paths.latestMarkdown), { recursive: true });
    writeFileSync(paths.latestMarkdown, markdownForBridgeReport(report));
  }
  return paths;
}

export function bridgeDoctor({ scenarios = [] } = {}) {
  const rows = asArray(scenarios);
  const findings = [];
  const featured = rows.find((scenario) => scenario.gateVerdict === 'featured-ready');
  if (!featured) findings.push({ severity: 'warning', message: 'No scenario is featured-ready.', command: 'npm run bridge:build -- --markdown' });
  for (const scenario of rows.filter((item) => item.gateVerdict === 'missing-evidence')) {
    findings.push({ severity: 'error', scenarioId: scenario.scenarioId, message: `${scenario.name} is missing readiness evidence.`, command: scenario.nextFix?.command });
  }
  for (const scenario of rows.filter((item) => item.gateVerdict === 'regressing' || item.gateVerdict === 'blocked-by-setup')) {
    findings.push({ severity: 'error', scenarioId: scenario.scenarioId, message: `${scenario.name} is ${scenario.gateVerdict}.`, command: scenario.nextFix?.command });
  }
  return {
    ok: findings.filter((finding) => finding.severity === 'error').length === 0,
    findingCount: findings.length,
    featuredReadyCount: rows.filter((scenario) => scenario.gateVerdict === 'featured-ready').length,
    playableCount: rows.filter((scenario) => scenario.eligible).length,
    findings,
  };
}

export function markdownForScenarioReadiness(readiness = {}) {
  const blockers = asArray(readiness.blockers).map((item) => `- ${item.code}: ${item.message}`).join('\n') || '- None.';
  const warnings = asArray(readiness.warnings).map((item) => `- ${item.code}: ${item.message}`).join('\n') || '- None.';
  const reasons = asArray(readiness.reasons).map((item) => `- ${item}`).join('\n') || '- No positive readiness reasons yet.';
  return `# Scenario Evidence Readiness

Generated: ${readiness.generatedAt || 'unknown'}

Scenario: ${readiness.name || readiness.scenarioId}

Verdict: ${readiness.gateVerdict || 'unknown'}

Score: ${readiness.readinessScore ?? 'n/a'}

## Reasons

${reasons}

## Blockers

${blockers}

## Warnings

${warnings}

## Next Fix

${readiness.nextFix?.title || 'Refresh evidence'}

\`${readiness.nextFix?.command || 'npm run bridge:build'}\`

${readiness.nextFix?.reason || ''}
`;
}

export function markdownForBridgeReport(report = {}) {
  const rows = asArray(report.scenarios).map((scenario) => `- ${scenario.scenarioId}: ${scenario.gateVerdict}, score ${scenario.readinessScore}, next \`${scenario.nextFix?.command || 'npm run bridge:build'}\``).join('\n') || '- No scenarios.';
  const findings = asArray(report.doctor?.findings).map((finding) => `- ${finding.severity}: ${finding.message}${finding.command ? ` - \`${finding.command}\`` : ''}`).join('\n') || '- No findings.';
  return `# Scenario Evidence Bridge

Generated: ${report.generatedAt || 'unknown'}

Featured: ${report.featuredScenario?.scenarioId || 'none'}

Challenge: ${report.challengeScenario?.scenarioId || 'none'}

Project verdict: ${report.verdict || 'unknown'}

## Scenarios

${rows}

## Doctor

${findings}
`;
}
