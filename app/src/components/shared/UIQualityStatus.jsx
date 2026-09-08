import { useEffect, useState } from 'react';

const EMPTY = { state: 'loading', report: null };

export default function UIQualityStatus() {
  const [result, setResult] = useState(EMPTY);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/ui-quality/latest.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Quality evidence returned ${response.status}.`);
        return response.json();
      })
      .then((report) => setResult({ state: 'ready', report }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ state: 'unavailable', report: null });
      });
    return () => controller.abort();
  }, []);

  const report = result.report;
  const passing = report?.status === 'pass';
  const status = result.state === 'loading' ? 'Loading evidence' : result.state === 'unavailable' ? 'Evidence unavailable' : passing ? 'Current' : 'Review required';

  return (
    <section className="overflow-hidden rounded-md border border-exp-border bg-exp-panel/80" aria-labelledby="ui-quality-title" data-testid="ui-quality-status">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-exp-border p-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-exp-text-dim">Rendered quality contract</p>
          <h3 id="ui-quality-title" className="mt-2 font-display text-2xl uppercase tracking-[0.12em] text-exp-text">Visual evidence stays accountable</h3>
        </div>
        <span role="status" className={`rounded border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] ${passing ? 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green' : 'border-compass/45 bg-compass/10 text-compass-bright'}`}>
          {status}
        </span>
      </div>
      <div className="grid gap-px bg-exp-border sm:grid-cols-[8rem_1fr]">
        <div className="bg-exp-dark/80 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-exp-text-dim">Grade</p>
          <p className="mt-2 font-display text-4xl text-compass-bright">{report?.grade || '--'}</p>
        </div>
        <div className="bg-exp-dark/60 p-4">
          {report ? (
            <>
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-exp-text">
                {report.summary.current} / {report.summary.total} approved scenes current
              </p>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-exp-text-dim">{report.nextAction}</p>
            </>
          ) : (
            <p className="font-mono text-[11px] leading-relaxed text-exp-text-dim">
              {result.state === 'loading' ? 'Reading the latest browser evidence...' : 'Run npm run ui:quality:report to publish the current status.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

