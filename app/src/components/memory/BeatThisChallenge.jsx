import { Link } from 'react-router-dom';

export default function BeatThisChallenge({ challenge, compact = false }) {
  if (!challenge) return null;
  return (
    <section className="rounded border border-compass/40 bg-compass/10 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-compass">Beat This Challenge</p>
          <h3 className="mt-1 font-display text-xl uppercase tracking-[0.12em] text-exp-text">{challenge.title}</h3>
        </div>
        <span className="rounded border border-compass/45 bg-exp-dark/35 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-compass-bright">
          {challenge.reward}
        </span>
      </div>
      <p className="mt-2 font-mono text-sm leading-relaxed text-exp-text">{challenge.target}</p>
      {!compact && <p className="mt-1 font-mono text-xs leading-relaxed text-exp-text-dim">{challenge.reason}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={challenge.path || '/'} className="rounded border border-compass/55 bg-compass/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-compass-bright">
          Start attempt
        </Link>
        {challenge.metric && (
          <span className="rounded border border-exp-border bg-exp-dark/45 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-exp-text-dim">
            {challenge.metric} {challenge.targetValue ?? ''}
          </span>
        )}
      </div>
    </section>
  );
}
