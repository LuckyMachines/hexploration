import { useEffect, useState } from 'react';

export default function UXQualityStatus() {
  const [result, setResult] = useState({ state: 'loading', report: null });

  useEffect(() => {
    const controller = new AbortController();
    fetch('/ux/latest.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`UX evidence returned ${response.status}.`);
        return response.json();
      })
      .then((report) => setResult({ state: 'ready', report }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ state: 'unavailable', report: null });
      });
    return () => controller.abort();
  }, []);

  const report = result.report;
  const research = report?.gates?.research;
  const telemetry = report?.gates?.telemetry;
  const browserEvidence = report?.gates?.browserEvidence;
  const browserProfileCount = new Set(browserEvidence?.results?.flatMap(({ projects = [] }) => projects) || []).size;
  return (
    <section className="overflow-hidden rounded-md border border-exp-border bg-exp-panel/80" aria-labelledby="ux-quality-title" data-testid="ux-quality-status">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-exp-border p-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">Behavioral quality contract</p>
          <h3 id="ux-quality-title" className="mt-2 font-display text-2xl uppercase tracking-[0.12em] text-exp-text">Automation proves paths; players prove experience</h3>
        </div>
        <span className={`rounded border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] ${report?.releaseReady ? 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green' : 'border-compass/45 bg-compass/10 text-compass-bright'}`}>
          {result.state === 'loading' ? 'Loading evidence' : result.state === 'unavailable' ? 'Evidence unavailable' : report.releaseReady ? 'Release evidence ready' : 'Human evidence pending'}
        </span>
      </div>
      <div className="grid gap-px bg-exp-border sm:grid-cols-[8rem_1fr]">
        <div className="bg-exp-dark/80 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-exp-text-dim">UX grade</p>
          <p className="mt-2 font-display text-4xl text-compass-bright">{report?.grade || '--'}</p>
        </div>
        <div className="bg-exp-dark/60 p-4">
          {report ? <>
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-exp-text">Journey, copy, input, assistive, and touch contracts {report.automationPass ? 'pass' : 'need review'}</p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">Browser evidence: {browserEvidence?.status || 'missing'} across {browserProfileCount} profiles. Observed sessions: {research?.validSessions || 0}. Production telemetry: {telemetry?.status || 'unavailable'}.</p>
            {report.nextActions?.[0] && <p className="mt-2 font-mono text-[11px] leading-relaxed text-compass-bright">Next: {report.nextActions[0]}</p>}
          </> : <p className="font-mono text-[11px] leading-relaxed text-exp-text-dim">{result.state === 'loading' ? 'Reading journey and research evidence...' : 'Run npm run ux:report to publish current evidence.'}</p>}
        </div>
      </div>
    </section>
  );
}
