import { createHash } from 'node:crypto';

const ACTION_INDEX = Object.freeze({ Idle: 0, Move: 1, Camp: 2, 'Setup Camp': 2, Dig: 4, Rest: 5, Help: 6, Flee: 7, Depart: 7 });
const REQUIRED_ACTIONS = [1, 2, 4, 5, 6, 7];

function unique(values = []) {
  return [...new Set((values || []).filter((value) => value !== null && value !== undefined && value !== ''))];
}

export function validateBoardSystem(contract = {}) {
  const errors = [];
  if (contract.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!/^\d+\.\d+\.\d+$/.test(contract.version || '')) errors.push('version must be semantic version text');
  if (!contract.objective) errors.push('objective is required');
  const layerIds = new Set((contract.layers || []).map((layer) => layer.id));
  for (const required of ['terrain', 'landmarks', 'affordances', 'intent', 'route', 'party', 'assistance', 'atmosphere']) {
    if (!layerIds.has(required)) errors.push(`missing renderer layer: ${required}`);
  }
  const evidenceStates = contract.requiredEvidence?.states || [];
  for (const required of ['ready', 'hover', 'selected', 'invalid', 'danger', 'committed', 'resolving', 'rescue', 'recovery', 'complete']) {
    if (!evidenceStates.includes(required)) errors.push(`missing evidence state: ${required}`);
  }
  const actionIndices = new Set((contract.mechanics || []).map((mechanic) => mechanic.actionIndex));
  for (const action of REQUIRED_ACTIONS) if (!actionIndices.has(action)) errors.push(`missing mechanic expression for action ${action}`);
  for (const mechanic of contract.mechanics || []) {
    for (const field of ['id', 'loop', 'cue', 'preview', 'consequence', 'recovery', 'soundCue', 'motionCue', 'reducedMotion']) {
      if (!mechanic[field]) errors.push(`${mechanic.id || 'mechanic'} is missing ${field}`);
    }
  }
  if (contract.spatialStability?.immutableBaseTileTransform !== true) errors.push('base tile transforms must be immutable');
  if (contract.camera?.autoMoveOnHover !== false) errors.push('camera auto movement on hover must be disabled');
  for (const [key, value] of Object.entries(contract.performance || {})) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) errors.push(`performance budget ${key} must be a non-negative number`);
  }
  return { ok: errors.length === 0, errors };
}

function locationMap(players = []) {
  const map = {};
  players.forEach((player, index) => {
    if (!player?.location) return;
    if (!map[player.location]) map[player.location] = [];
    map[player.location].push(index);
  });
  return map;
}

function cellsFromSnapshot(snapshot = {}) {
  const zones = snapshot.activeZones?.zones || [];
  const tiles = snapshot.activeZones?.tiles || [];
  const campsites = snapshot.activeZones?.campsites || [];
  return zones.map((alias, index) => ({
    alias,
    tileType: Number(tiles[index] || 0),
    revealed: true,
    hasCampsite: Boolean(campsites[index]),
  }));
}

function describeTurn(turn = {}) {
  const recap = (turn.analysis?.recap || []).map((item) => `${item.label}: ${item.value}`).slice(0, 3);
  return recap.length ? recap.join(' / ') : `Exact-engine turn ${turn.turn || 0}`;
}

export function exactReportToBoardReplay(report = {}, scenario = {}) {
  const runs = report.runs?.length ? report.runs : [report];
  const run = runs.find((candidate) => candidate.summary?.terminal) || runs[0] || {};
  const traceHash = run.summary?.traceHash || report.aggregate?.traceHashes?.[0] || null;
  const frames = (run.turns || []).filter((turn) => turn.after).map((turn, index) => {
    const before = turn.before || run.initial || {};
    const after = turn.after || before;
    const players = after.players || [];
    const currentPlayerIndex = Math.max(0, players.findIndex((player) => player.isActive));
    const currentPlayer = players[currentPlayerIndex] || players[0] || {};
    const beforePlayer = (before.players || []).find((player) => String(player.playerId) === String(currentPlayer.playerId)) || {};
    const tension = Number(turn.analysis?.funDebugger?.evidence?.tension || run.summary?.tensionCurve?.[index]?.tension || 0);
    const lowStats = players.some((player) => Math.min(...Object.values(player.stats || {}).map(Number)) <= 1);
    const action = ACTION_INDEX[currentPlayer.action] ?? 0;
    const moved = beforePlayer.location && currentPlayer.location && beforePlayer.location !== currentPlayer.location;
    const phase = after.gameOver ? 'complete' : action === 5 || action === 6 || lowStats ? 'recovery' : tension >= 50 || action === 7 ? 'danger' : 'planning';
    const cells = cellsFromSnapshot(after);
    const landingSite = cells.find((cell) => cell.tileType === 5)?.alias || '';
    return {
      id: `turn-${turn.turn || index + 1}`,
      label: `Turn ${turn.turn || index + 1}`,
      description: describeTurn(turn),
      viewModel: {
        cells,
        currentLocation: currentPlayer.location || landingSite || cells[0]?.alias || '',
        intentAlias: currentPlayer.location || landingSite || cells[0]?.alias || '',
        selectedPath: moved ? [currentPlayer.location] : [],
        previewPath: moved ? [currentPlayer.location] : [],
        reachableAliases: [],
        landingSite,
        playerLocationMap: locationMap(players),
        crew: players.map((player, playerIndex) => ({
          name: `Explorer ${player.playerId || playerIndex + 1}`,
          currentZone: player.location,
          stats: player.stats,
          hasArtifact: Boolean(player.inventory?.artifact || player.artifacts?.length),
          inventory: player.inventory,
        })),
        currentPlayerIndex,
        activeAction: action,
        hasSubmitted: false,
        isDanger: phase === 'danger',
        lowStats,
        isComplete: after.gameOver,
        phase,
        source: {
          kind: 'exact-engine',
          scenarioId: scenario.id || report.scenarioDefinition?.id || report.config?.scenario || 'unknown',
          traceHash,
          turn: turn.turn || index + 1
        }
      }
    };
  });
  return {
    schemaVersion: 1,
    scenarioId: scenario.id || report.scenarioDefinition?.id || report.config?.scenario || 'unknown',
    label: scenario.name || report.scenarioDefinition?.name || report.config?.scenarioLabel || 'Exact-engine replay',
    exactEngine: report.exactEngine === true || run.exactEngine === true,
    generatedAt: report.generatedAt || new Date(0).toISOString(),
    traceHash,
    outcome: run.summary?.outcome || null,
    terminal: Boolean(run.summary?.terminal),
    frames,
  };
}

export function boardFindingAttribution(finding = {}) {
  const id = String(finding.id || finding.type || finding.message || '').toLowerCase();
  if (/draw|frame|render|triangle|memory|heap|remount|context/.test(id)) return 'app/src/components/board/ThreeBoard.jsx';
  if (/asset|texture|load/.test(id)) return 'app/src/components/board/boardAssetRegistry.js';
  if (/state|projection|view-model|viewmodel/.test(id)) return 'app/src/components/board/boardViewModel.js';
  if (/camera|pick|pointer|keyboard|touch|input/.test(id)) return 'app/src/components/board/boardInteraction.js';
  if (/beat|audio|motion|lighting/.test(id)) return 'app/src/components/board/boardBeatDirector.js';
  if (/scenario|terminal|experiment|trace/.test(id)) return 'scripts/gameplay-simulator.mjs';
  if (/visual|screenshot|capture|diff/.test(id)) return 'app/e2e/board-system.spec.js';
  return 'app/src/board-system/board-system.json';
}

export function evaluateBoardMetrics(metrics = {}, contract = {}) {
  const budgets = contract.performance || {};
  const failures = [];
  const scenes = metrics.scenes || [];
  if (!scenes.length) failures.push({ id: 'missing-scene-metrics' });
  if (typeof metrics.remountHeapGrowthMiB !== 'number' || !Number.isFinite(metrics.remountHeapGrowthMiB)) {
    failures.push({ id: 'missing-remount-heap-growth' });
  } else if (Number(metrics.remountHeapGrowthMiB) > Number(budgets.maxRemountHeapGrowthMiB)) {
    failures.push({
      id: 'remount-heap-growth',
      actual: Number(metrics.remountHeapGrowthMiB),
      budget: Number(budgets.maxRemountHeapGrowthMiB),
    });
  }
  for (const scene of scenes) {
    if (Number(scene.canvasCount) > Number(budgets.maxCanvasCount)) failures.push({ id: 'canvas-count', scene: scene.id, actual: scene.canvasCount, budget: budgets.maxCanvasCount });
    if (Number(scene.drawCalls) > Number(budgets.maxDrawCalls)) failures.push({ id: 'draw-calls', scene: scene.id, actual: scene.drawCalls, budget: budgets.maxDrawCalls });
    if (Number(scene.triangles) > Number(budgets.maxTriangles)) failures.push({ id: 'triangles', scene: scene.id, actual: scene.triangles, budget: budgets.maxTriangles });
    if (Number(scene.contextLosses) > Number(budgets.maxContextLosses)) failures.push({ id: 'context-losses', scene: scene.id, actual: scene.contextLosses, budget: budgets.maxContextLosses });
    if (Number(scene.assetFailures) > Number(budgets.maxAssetFailures)) failures.push({ id: 'asset-failures', scene: scene.id, actual: scene.assetFailures, budget: budgets.maxAssetFailures });
    if (Number(scene.assetLoading) > 0) failures.push({ id: 'assets-still-loading', scene: scene.id, actual: scene.assetLoading });
    if (Number(scene.assetExpected) <= 0) failures.push({ id: 'missing-asset-inventory', scene: scene.id });
    if (Number(scene.assetLoaded) + Number(scene.assetFailures) !== Number(scene.assetExpected)) failures.push({ id: 'incomplete-asset-inventory', scene: scene.id, expected: scene.assetExpected, loaded: scene.assetLoaded, failed: scene.assetFailures });
    const frameBudget = scene.timingEnvironment === 'headless-browser' ? budgets.maxHeadlessFrameP95Ms : budgets.maxFrameP95Ms;
    if (scene.frameP95Ms !== null && Number(scene.frameP95Ms) > Number(frameBudget)) failures.push({ id: 'frame-p95', scene: scene.id, actual: scene.frameP95Ms, budget: frameBudget });
    if (scene.renderP95Ms !== null && Number(scene.renderP95Ms) > Number(budgets.maxRenderP95Ms)) failures.push({ id: 'render-p95', scene: scene.id, actual: scene.renderP95Ms, budget: budgets.maxRenderP95Ms });
  }
  if (!scenes.some((scene) => typeof scene.frameP95Ms === 'number' && Number.isFinite(scene.frameP95Ms) && typeof scene.renderP95Ms === 'number' && Number.isFinite(scene.renderP95Ms))) {
    failures.push({ id: 'missing-performance-sample' });
  }
  return {
    ok: failures.length === 0,
    failures: failures.map((failure) => ({ ...failure, module: boardFindingAttribution(failure) })),
  };
}

export function compareBoardMetrics(baseline = {}, candidate = {}) {
  const baselineById = new Map((baseline.scenes || []).map((scene) => [scene.id, scene]));
  const comparisons = (candidate.scenes || []).map((scene) => {
    const before = baselineById.get(scene.id) || {};
    return {
      id: scene.id,
      drawCallsDelta: Number(scene.drawCalls || 0) - Number(before.drawCalls || 0),
      trianglesDelta: Number(scene.triangles || 0) - Number(before.triangles || 0),
      frameP95DeltaMs: Number(scene.frameP95Ms || 0) - Number(before.frameP95Ms || 0),
      renderP95DeltaMs: Number(scene.renderP95Ms || 0) - Number(before.renderP95Ms || 0),
      assetFailureDelta: Number(scene.assetFailures || 0) - Number(before.assetFailures || 0),
    };
  });
  const regressions = comparisons.filter((entry) => entry.drawCallsDelta > 0 || entry.frameP95DeltaMs > 2 || entry.renderP95DeltaMs > 1 || entry.assetFailureDelta > 0);
  const remountHeapGrowthDeltaMiB = Number(candidate.remountHeapGrowthMiB || 0) - Number(baseline.remountHeapGrowthMiB || 0);
  if (remountHeapGrowthDeltaMiB > 1) {
    regressions.push({ id: 'remount-heap-growth', remountHeapGrowthDeltaMiB });
  }
  return { schemaVersion: 1, comparedScenes: comparisons.length, remountHeapGrowthDeltaMiB, comparisons, regressions };
}

export function stableBoardHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildBoardReport({ contract, replays = [], metrics = null, gameplay = null, browserCompatibility = null, currentSourceHash = null, generatedAt = new Date().toISOString() } = {}) {
  const validation = validateBoardSystem(contract);
  const metricEvaluation = metrics ? evaluateBoardMetrics(metrics, contract) : { ok: false, failures: [{ id: 'missing-browser-metrics', module: 'app/e2e/board-system.spec.js' }] };
  const requiredStates = contract.requiredEvidence?.states || [];
  const requiredViewports = (contract.requiredEvidence?.viewports || []).map((viewport) => viewport.id);
  const capturedStates = unique((metrics?.scenes || []).map((scene) => scene.state));
  const missingStates = requiredStates.filter((state) => !capturedStates.includes(state));
  const capturedPairs = new Set((metrics?.scenes || []).map((scene) => `${scene.state}:${scene.viewport}`));
  const missingCaptures = requiredStates.flatMap((state) => requiredViewports.map((viewport) => `${state}:${viewport}`)).filter((pair) => !capturedPairs.has(pair));
  const exactReplays = replays.filter((replay) => replay.exactEngine && replay.frames.length > 0);
  const gameplayBlockers = gameplay?.blockers || [];
  const metricScenes = metrics?.scenes || [];
  const maxMetric = (key) => {
    const values = metricScenes.map((scene) => scene[key]).filter((value) => typeof value === 'number' && Number.isFinite(value));
    return values.length ? Math.max(...values) : null;
  };
  const failures = [
    ...validation.errors.map((message) => ({ id: 'contract', message, module: 'app/src/board-system/board-system.json' })),
    ...metricEvaluation.failures,
    ...missingStates.map((state) => ({ id: 'missing-state-capture', state, module: 'app/e2e/board-system.spec.js' })),
    ...missingCaptures.map((capture) => ({ id: 'missing-state-viewport-capture', capture, module: 'app/e2e/board-system.spec.js' })),
    ...(exactReplays.length ? [] : [{ id: 'missing-exact-replays', module: 'scripts/board-system.mjs' }]),
    ...(currentSourceHash && metrics?.sourceHash !== currentSourceHash ? [{ id: 'stale-browser-metrics', module: 'app/e2e/board-system.spec.js' }] : []),
    ...(browserCompatibility?.passed === true ? [] : [{ id: browserCompatibility ? 'cross-browser-failed' : 'missing-cross-browser-evidence', module: 'app/e2e/board-system.spec.js' }]),
    ...(currentSourceHash && browserCompatibility?.sourceHash !== currentSourceHash ? [{ id: 'stale-cross-browser-evidence', module: 'app/e2e/board-system.spec.js' }] : []),
    ...gameplayBlockers.map((message) => ({ id: 'gameplay-gate', message, module: 'scripts/gameplay-improvement.mjs' })),
  ];
  const grade = !validation.ok || !exactReplays.length ? 'C' : failures.length === 0 ? 'A' : metricEvaluation.ok && missingStates.length === 0 ? 'A-' : 'B';
  const nextActions = failures.map((failure) => ({
    title: failure.message || `Resolve ${failure.id}${failure.state ? `: ${failure.state}` : ''}`,
    module: failure.module || boardFindingAttribution(failure),
  })).filter((action, index, all) => all.findIndex((item) => item.title === action.title) === index);
  return {
    schemaVersion: 1,
    generatedAt,
    contractVersion: contract.version,
    status: failures.length ? 'attention' : 'pass',
    grade,
    validation,
    evidence: {
      exactReplayCount: exactReplays.length,
      replayFrameCount: exactReplays.reduce((sum, replay) => sum + replay.frames.length, 0),
      capturedStates,
      missingStates,
      missingCaptures,
      browserMetrics: Boolean(metrics),
      sourceHash: currentSourceHash,
      crossBrowserPassed: browserCompatibility?.passed === true,
      crossBrowserProjects: browserCompatibility?.projects || [],
      gameplayGrade: gameplay?.grade || null,
      gameplayBlockerCount: gameplayBlockers.length,
      performance: {
        maxDrawCalls: maxMetric('drawCalls'),
        maxTriangles: maxMetric('triangles'),
        maxFrameP95Ms: maxMetric('frameP95Ms'),
        maxRenderP95Ms: maxMetric('renderP95Ms'),
        maxAssetFailures: maxMetric('assetFailures'),
        remountHeapGrowthMiB: metrics?.remountHeapGrowthMiB ?? null,
      },
    },
    metrics: metrics || null,
    failures,
    nextAction: nextActions[0] || null,
    nextActions,
  };
}
