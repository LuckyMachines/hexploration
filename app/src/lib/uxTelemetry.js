import { trackJourneyEvent } from './analytics';

const VITAL_THRESHOLDS = Object.freeze({
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
});

export function rateMetric(metric, value) {
  const thresholds = VITAL_THRESHOLDS[metric];
  if (!thresholds || !Number.isFinite(value)) return 'poor';
  if (value <= thresholds[0]) return 'good';
  if (value <= thresholds[1]) return 'needs-improvement';
  return 'poor';
}

export function bucketMetric(metric, value) {
  if (metric === 'CLS') return value < 0.1 ? 'under-0.1' : value <= 0.25 ? '0.1-0.25' : 'over-0.25';
  if (metric === 'INP') return value < 100 ? 'under-100ms' : value <= 300 ? '100ms-300ms' : 'over-300ms';
  return value < 1000 ? 'under-1s' : value <= 2500 ? '1s-2.5s' : value <= 4000 ? '2.5s-4s' : 'over-4s';
}

export function trackUXHelp(surface = 'help') {
  return trackJourneyEvent('ux_help', { surface }, { dedupeKey: `help-${Date.now()}` });
}

export function trackUXError({ surface = 'global', errorType = 'unexpected', severity = 'high' } = {}) {
  return trackJourneyEvent('ux_error', { surface, error_type: errorType, severity }, { dedupeKey: `error-${surface}-${Date.now()}` });
}

export function trackUXRecovery({ surface = 'global', recovery = 'retry' } = {}) {
  return trackJourneyEvent('ux_recovery', { surface, recovery }, { dedupeKey: `recovery-${surface}-${Date.now()}` });
}

export function trackUXTiming({ surface = 'global', metric, value } = {}) {
  if (!['first_action', 'recovery'].includes(metric) || !Number.isFinite(value)) return false;
  return trackJourneyEvent('ux_timing', {
    surface,
    metric,
    rating: rateMetric(metric === 'recovery' ? 'INP' : 'LCP', value),
    value_bucket: bucketMetric(metric === 'recovery' ? 'INP' : 'LCP', value),
  }, { dedupeKey: `${metric}-${surface}` });
}

export function initUXTelemetry() {
  if (typeof window === 'undefined' || window.__xenovoyaUXTelemetry) return false;
  window.__xenovoyaUXTelemetry = true;
  const startedAt = performance.now();
  const values = { LCP: 0, CLS: 0, INP: 0 };
  const observers = [];
  const observe = (type, callback) => {
    if (!('PerformanceObserver' in window)) return;
    try {
      const observer = new PerformanceObserver((list) => callback(list.getEntries()));
      observer.observe(type === 'event' ? { type, buffered: true, durationThreshold: 40 } : { type, buffered: true });
      observers.push(observer);
    } catch {
      // Unsupported performance entry types are expected in some browsers.
    }
  };
  observe('largest-contentful-paint', (entries) => { values.LCP = entries.at(-1)?.startTime || values.LCP; });
  observe('layout-shift', (entries) => { values.CLS += entries.filter((entry) => !entry.hadRecentInput).reduce((sum, entry) => sum + entry.value, 0); });
  observe('event', (entries) => { values.INP = Math.max(values.INP, ...entries.map((entry) => entry.duration || 0)); });

  let firstActionRecorded = false;
  const firstAction = () => {
    if (firstActionRecorded) return;
    firstActionRecorded = true;
    trackUXTiming({ surface: window.location.pathname === '/' ? 'home' : 'global', metric: 'first_action', value: performance.now() - startedAt });
  };
  window.addEventListener('pointerdown', firstAction, { once: true, passive: true });
  window.addEventListener('keydown', firstAction, { once: true, passive: true });

  let flushed = false;
  const flush = () => {
    if (flushed) return;
    flushed = true;
    for (const metric of ['LCP', 'CLS', 'INP']) {
      if (!values[metric]) continue;
      trackJourneyEvent('web_vital', {
        metric,
        rating: rateMetric(metric, values[metric]),
        value_bucket: bucketMetric(metric, values[metric]),
      }, { dedupeKey: metric });
    }
    observers.forEach((observer) => observer.disconnect());
  };
  window.addEventListener('pagehide', flush, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('error', (event) => {
    if (event.error) trackUXError({ errorType: 'unexpected', severity: 'high' });
  });
  window.addEventListener('unhandledrejection', () => trackUXError({ errorType: 'unexpected', severity: 'high' }));
  return true;
}
