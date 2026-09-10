export const SESSION_BUDGETS = Object.freeze({
  cached_resume_ms: 1_000,
  cold_resume_ms: 3_000,
  local_save_ack_ms: 50,
  cloud_save_p95_ms: 1_500,
  reconnect_p95_ms: 5_000,
  lobby_propagation_p95_ms: 750,
  lcp_ms: 2_500,
  long_task_ms: 200,
});

const samples = new Map();

export function recordSessionMetric(name, value, detail = {}) {
  if (!Number.isFinite(value) || value < 0) return null;
  const sample = { name, value: Math.round(value), detail, at: new Date().toISOString(), budget: SESSION_BUDGETS[name] || null };
  const list = [...(samples.get(name) || []), sample].slice(-100);
  samples.set(name, list);
  if (typeof window !== 'undefined') {
    window.__xenovoyaSessionMetrics = Object.fromEntries(samples);
    window.dispatchEvent(new CustomEvent('xenovoya:session-metric', { detail: sample }));
  }
  return sample;
}

export function markSessionMilestone(name) {
  if (typeof performance === 'undefined') return;
  performance.mark(`xenovoya:${name}`);
}

export function measureSessionSpan(name, start, end) {
  if (typeof performance === 'undefined') return null;
  try {
    const measurement = performance.measure(`xenovoya:${name}`, `xenovoya:${start}`, `xenovoya:${end}`);
    return recordSessionMetric(name, measurement.duration);
  } catch { return null; }
}

export function sessionMetricSummary(name) {
  const values = (samples.get(name) || []).map((sample) => sample.value).sort((a, b) => a - b);
  if (!values.length) return null;
  const p95 = values[Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1)];
  return { count: values.length, p50: values[Math.floor((values.length - 1) * 0.5)], p95, budget: SESSION_BUDGETS[name] || null, passing: !SESSION_BUDGETS[name] || p95 <= SESSION_BUDGETS[name] };
}

export function initSessionTelemetry() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return () => {};
  const observers = [];
  if (PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
    const observer = new PerformanceObserver((list) => {
      const entry = list.getEntries().at(-1);
      if (entry) recordSessionMetric('lcp_ms', entry.startTime);
    });
    observer.observe({ type: 'largest-contentful-paint', buffered: true });
    observers.push(observer);
  }
  if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => recordSessionMetric('long_task_ms', entry.duration)));
    observer.observe({ type: 'longtask', buffered: true });
    observers.push(observer);
  }
  return () => observers.forEach((observer) => observer.disconnect());
}
