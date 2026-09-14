import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import contract from '../app/src/board-system/board-system.json' with { type: 'json' };
import { buildBoardReport, compareBoardMetrics, exactReportToBoardReplay, stableBoardHash, validateBoardSystem } from './board-system-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const command = args.find((value) => !value.startsWith('--')) || 'report';
const valueArg = (name, fallback = null) => {
  const found = args.find((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (!found) return fallback;
  const split = found.indexOf('=');
  return split >= 0 ? found.slice(split + 1) : true;
};
const readJson = (path, fallback = null) => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : fallback;
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const replayPath = resolve(root, 'app', 'public', 'board-system', 'replays.json');
const metricsPath = resolve(root, 'artifacts', 'board-system', 'metrics', 'latest.json');
const baselineMetricsPath = resolve(root, 'artifacts', 'board-system', 'metrics', 'baseline.json');
const reportPath = resolve(root, 'reports', 'board-system', 'latest.json');
const publicReportPath = resolve(root, 'app', 'public', 'board-system', 'latest.json');
const markdownPath = resolve(root, 'reports', 'board-system', 'latest.md');
const crossBrowserReportPath = resolve(root, 'reports', 'board-system', 'cross-browser-latest.json');
const BOARD_SOURCE_PATHS = [
  'app/src/board-system/board-system.json',
  'app/src/board-system/boardLabFixtures.js',
  'app/src/art-pipeline/material-system.json',
  'app/src/components/board/HexGrid.jsx',
  'app/src/components/board/ThreeBoard.jsx',
  'app/src/components/board/boardAssetRegistry.js',
  'app/src/components/board/boardBeatDirector.js',
  'app/src/components/board/boardInteraction.js',
  'app/src/components/board/boardQuality.js',
  'app/src/components/board/boardSceneState.js',
  'app/src/components/board/boardViewModel.js',
  'app/src/components/board/boardWorld.js',
  'app/src/components/board/lightingRigs.js',
  'app/src/components/board/surfaceCatalog.js',
  'app/src/components/board/tileKit.js',
  'app/src/pages/BoardLabPage.jsx',
  'app/e2e/board-system.spec.js',
];

function boardSourceHash() {
  return stableBoardHash(Object.fromEntries(BOARD_SOURCE_PATHS.map((path) => [path, readFileSync(resolve(root, path), 'utf8')])));
}

function generateReplays() {
  const store = readJson(resolve(root, 'simulator.scenarios.json'), { scenarios: [] });
  const replays = [];
  for (const scenario of store.scenarios || []) {
    if (scenario.archived || scenario.productionEligible === false || (scenario.tags || []).includes('regression')) continue;
    const sourcePath = resolve(root, 'reports', 'simulator', 'scenarios', scenario.id, 'latest-report.json');
    if (!existsSync(sourcePath)) continue;
    const replay = exactReportToBoardReplay(readJson(sourcePath), scenario);
    replay.sourcePath = sourcePath.replaceAll('\\', '/').replace(root.replaceAll('\\', '/'), '').replace(/^\//, '');
    replay.sourceHash = stableBoardHash(readJson(sourcePath));
    replays.push(replay);
  }
  const payload = { schemaVersion: 1, generatedAt: new Date().toISOString(), contractVersion: contract.version, replays };
  writeJson(replayPath, payload);
  return payload;
}

function markdown(report) {
  const lines = [
    '# Board System Verification',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status.toUpperCase()}`,
    `Grade: ${report.grade}`,
    `Contract: ${report.contractVersion}`,
    '',
    '## Evidence',
    '',
    `- Exact-engine replays: ${report.evidence.exactReplayCount}`,
    `- Exact-engine frames: ${report.evidence.replayFrameCount}`,
    `- Captured states: ${report.evidence.capturedStates.length}`,
    `- Missing states: ${report.evidence.missingStates.join(', ') || 'none'}`,
    `- Cross-browser compatibility: ${report.evidence.crossBrowserPassed ? `pass (${report.evidence.crossBrowserProjects.join(', ')})` : 'missing or failed'}`,
    `- Gameplay grade / blockers: ${report.evidence.gameplayGrade || 'unavailable'} / ${report.evidence.gameplayBlockerCount}`,
    `- Peak draw calls / triangles: ${report.evidence.performance.maxDrawCalls ?? 'unavailable'} / ${report.evidence.performance.maxTriangles ?? 'unavailable'}`,
    `- Frame p95 / render p95: ${report.evidence.performance.maxFrameP95Ms ?? 'unavailable'} ms / ${report.evidence.performance.maxRenderP95Ms ?? 'unavailable'} ms`,
    `- Remount heap growth: ${report.evidence.performance.remountHeapGrowthMiB ?? 'unavailable'} MiB`,
    `- Asset failures: ${report.evidence.performance.maxAssetFailures ?? 'unavailable'}`,
    '',
    '## Findings',
    '',
  ];
  if (!report.failures.length) lines.push('- All board contract, replay, browser, and gameplay gates pass.');
  report.failures.forEach((failure) => lines.push(`- ${failure.message || failure.id} (${failure.module})`));
  lines.push('', '## Ranked next actions', '');
  if (!report.nextActions.length) lines.push('- Raise the A bar before the next board iteration.');
  report.nextActions.forEach((action, index) => lines.push(`${index + 1}. ${action.title} - ${action.module}`));
  return `${lines.join('\n')}\n`;
}

function generateReport() {
  const replayPayload = readJson(replayPath) || generateReplays();
  const metrics = readJson(metricsPath);
  const gameplay = readJson(resolve(root, 'reports', 'gameplay-improvement', 'latest-report.json'), { blockers: [] });
  const browserCompatibility = readJson(crossBrowserReportPath);
  const report = buildBoardReport({ contract, replays: replayPayload.replays, metrics, gameplay, browserCompatibility, currentSourceHash: boardSourceHash() });
  writeJson(reportPath, report);
  writeJson(publicReportPath, report);
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, markdown(report));
  return report;
}

function runPlaywright(playwrightArgs) {
  const cliPath = resolve(root, 'app', 'node_modules', '@playwright', 'test', 'cli.js');
  const result = spawnSync(process.execPath, [cliPath, ...playwrightArgs], {
    cwd: resolve(root, 'app'),
    env: { ...process.env, VITE_ENABLE_INTERNAL_TOOLS: 'true' },
    windowsHide: true,
    stdio: 'inherit',
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exitCode = result.status || 1;
  return result.status === 0;
}

function capture({ updateSnapshots = false } = {}) {
  const passed = runPlaywright([
    'test', 'e2e/board-system.spec.js', '--project=chromium-desktop',
    ...(updateSnapshots ? ['--update-snapshots'] : []),
  ]);
  const metrics = readJson(metricsPath);
  if (passed && metrics) writeJson(metricsPath, { ...metrics, sourceHash: boardSourceHash() });
  return passed;
}

function crossBrowser() {
  const passed = runPlaywright([
    'test', 'e2e/board-system.spec.js',
    '--project=firefox-desktop', '--project=webkit-desktop',
    '--grep', 'exact-engine|transient state|camera controls|context loss|forced colors|keyboard tile controls',
  ]);
  writeJson(crossBrowserReportPath, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    passed,
    projects: ['firefox-desktop', 'webkit-desktop'],
    contractVersion: contract.version,
    sourceHash: boardSourceHash(),
  });
  return passed;
}

if (command === 'replay') {
  const result = generateReplays();
  console.log(JSON.stringify({ replayPath, replayCount: result.replays.length, frameCount: result.replays.reduce((sum, replay) => sum + replay.frames.length, 0) }, null, 2));
} else if (command === 'baseline') {
  const report = generateReport();
  const metrics = readJson(metricsPath);
  if (!metrics || report.status !== 'pass') {
    console.error('A passing board report with current browser metrics is required before baseline promotion.');
    process.exitCode = 1;
  } else {
    writeJson(baselineMetricsPath, {
      ...metrics,
      approvedAt: new Date().toISOString(),
      approvedContractVersion: contract.version,
      sourceReport: 'reports/board-system/latest.json',
    });
    console.log(JSON.stringify({ baselineMetricsPath, contractVersion: contract.version }, null, 2));
  }
} else if (command === 'compare') {
  const baselinePath = resolve(root, String(valueArg('baseline', 'artifacts/board-system/metrics/baseline.json')));
  const candidatePath = resolve(root, String(valueArg('candidate', 'artifacts/board-system/metrics/latest.json')));
  if (!existsSync(baselinePath) || !existsSync(candidatePath)) {
    console.error('Both board metric files are required for comparison.');
    process.exitCode = 2;
  } else {
    const comparison = compareBoardMetrics(readJson(baselinePath), readJson(candidatePath));
    const outputPath = resolve(root, 'reports', 'board-system', 'latest-comparison.json');
    writeJson(outputPath, comparison);
    console.log(JSON.stringify({ outputPath, comparedScenes: comparison.comparedScenes, regressions: comparison.regressions.length }, null, 2));
    if (valueArg('strict', false) && comparison.regressions.length) process.exitCode = 1;
  }
} else if (command === 'cross-browser') {
  crossBrowser();
} else if (command === 'capture' || command === 'refresh') {
  generateReplays();
  const capturePassed = capture({ updateSnapshots: valueArg('update-snapshots', false) === true });
  const compatibilityPassed = command === 'refresh' ? crossBrowser() : true;
  const report = generateReport();
  console.log(JSON.stringify({ reportPath, grade: report.grade, status: report.status }, null, 2));
  if (!capturePassed || !compatibilityPassed) process.exitCode = 1;
} else {
  if (command === 'doctor') {
    const validation = validateBoardSystem(contract);
    if (!validation.ok) console.error(validation.errors.join('\n'));
  }
  const report = generateReport();
  console.log(JSON.stringify({ reportPath, grade: report.grade, status: report.status, nextAction: report.nextAction }, null, 2));
  if ((command === 'doctor' || valueArg('strict', false)) && report.status !== 'pass') process.exitCode = 1;
}
