import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function sha256File(filePath) {
  if (!existsSync(filePath)) return null;
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

export function sourceHash(appRoot, sources = []) {
  const hash = createHash('sha256');
  for (const source of [...sources].sort()) {
    const absolute = resolve(appRoot, source);
    hash.update(source);
    hash.update('\0');
    if (existsSync(absolute)) hash.update(readFileSync(absolute));
    else hash.update('MISSING');
    hash.update('\0');
  }
  return hash.digest('hex');
}

function ageDays(timestamp, now) {
  const time = Date.parse(timestamp || '');
  return Number.isFinite(time) ? Math.max(0, (Date.parse(now) - time) / 86_400_000) : Number.POSITIVE_INFINITY;
}

export function evaluateScene({ scene, approval, appRoot, baselinePath, actualPath, metrics, generatedAt }) {
  const currentSourceHash = sourceHash(appRoot, scene.sources);
  const currentBaselineHash = sha256File(baselinePath);
  const missingSources = scene.sources.filter((source) => !existsSync(resolve(appRoot, source)));
  let status = 'current';
  let reason = 'Approved baseline and source inputs are current.';

  if (missingSources.length) {
    status = 'invalid';
    reason = `Missing source inputs: ${missingSources.join(', ')}`;
  } else if (!currentBaselineHash) {
    status = 'missing-baseline';
    reason = 'No approved screenshot baseline exists.';
  } else if (!approval) {
    status = 'unapproved';
    reason = 'A baseline exists but has no explicit human approval record.';
  } else if (ageDays(approval.approvedAt, generatedAt) > 30) {
    status = 'stale-approval';
    reason = 'The explicit visual approval is older than 30 days.';
  } else if (approval.sourceHash !== currentSourceHash) {
    status = 'stale-source';
    reason = 'A source file changed after the visual approval.';
  } else if (approval.baselineHash !== currentBaselineHash) {
    status = 'stale-baseline';
    reason = 'The baseline pixels changed after the visual approval.';
  }

  return {
    id: scene.id,
    label: scene.label,
    route: scene.route,
    status,
    reason,
    currentSourceHash,
    currentBaselineHash,
    approval: approval || null,
    baselinePath,
    actualPath,
    metrics: metrics || null,
    missingSources,
  };
}

export function buildUiQualityReport({ scenes, approvals = {}, appRoot, baselinePathFor, actualPathFor, metrics = [], generatedAt = new Date().toISOString(), metricsGeneratedAt = generatedAt }) {
  const metricsById = new Map(metrics.map((entry) => [entry.id, entry]));
  const results = scenes.map((scene) => evaluateScene({
    scene,
    approval: approvals[scene.id],
    appRoot,
    baselinePath: baselinePathFor(scene),
    actualPath: actualPathFor(scene),
    metrics: metricsById.get(scene.id),
    generatedAt,
  }));
  const current = results.filter(({ status }) => status === 'current').length;
  const missing = results.filter(({ status }) => status.startsWith('missing')).length;
  const stale = results.filter(({ status }) => status.startsWith('stale')).length;
  const unapproved = results.filter(({ status }) => status === 'unapproved').length;
  const invalid = results.filter(({ status }) => status === 'invalid').length;
  const metricsComplete = results.every(({ metrics: sceneMetrics }) => Boolean(sceneMetrics));
  const metricsFresh = metricsComplete && ageDays(metricsGeneratedAt, generatedAt) <= 14;
  const healthy = current === results.length && metricsComplete && metricsFresh;
  const grade = healthy ? 'A' : current === results.length ? 'A-' : current >= Math.ceil(results.length * 0.75) ? 'B+' : current >= Math.ceil(results.length * 0.5) ? 'B' : 'C';
  const next = results.find(({ status }) => status !== 'current');
  return {
    schemaVersion: 1,
    generatedAt,
    status: healthy ? 'pass' : 'attention',
    grade,
    summary: { total: results.length, current, missing, stale, unapproved, invalid, metricsComplete, metricsFresh },
    nextAction: next ? `${next.id}: ${next.reason}` : metricsFresh ? 'Run an observed player session to validate delight and comprehension.' : 'Run npm run ui:quality to refresh rendered metrics.',
    scenes: results,
  };
}

export function markdownForUiQuality(report) {
  const lines = [
    '# UI Quality Evidence',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Grade: **${report.grade}** - ${report.summary.current}/${report.summary.total} scenes current`,
    '',
    '| Scene | Status | Approval | Rendered evidence |',
    '| --- | --- | --- | --- |',
    ...report.scenes.map((scene) => `| ${scene.label} | ${scene.status} | ${scene.approval?.approvedAt || '-'} | ${scene.metrics ? 'current' : 'missing'} |`),
    '',
    `Next action: ${report.nextAction}`,
    '',
    'An approval is current only when both the baseline pixel hash and every declared source input hash still match.',
    '',
  ];
  return lines.join('\n');
}
