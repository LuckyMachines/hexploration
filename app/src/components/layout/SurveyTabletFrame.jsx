export default function SurveyTabletFrame({
  title,
  subtitle,
  status,
  children,
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-[1.35rem] border border-compass/20 bg-[linear-gradient(180deg,rgba(21,32,22,0.94)_0%,rgba(13,15,10,0.98)_100%)] shadow-[0_0_0_1px_rgba(196,166,74,0.08),0_18px_80px_rgba(0,0,0,0.45)]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.04] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute inset-y-0 left-4 w-px bg-white/[0.03]" />
        <div className="absolute inset-y-0 right-4 w-px bg-white/[0.03]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(232,200,96,0.08),transparent_42%),radial-gradient(circle_at_bottom,rgba(64,160,128,0.06),transparent_52%)]" />
      </div>

      <div className="relative mx-2 my-2 overflow-hidden rounded-[1.1rem] border border-white/[0.05] bg-exp-surface/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="border-b border-exp-border/80 bg-exp-dark/45 px-4 sm:px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-exp-text-dim">
              Survey Tablet
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-[0.24em] text-compass uppercase font-display">
              {title}
            </h1>
          </div>

          {status && (
            <span className="shrink-0 font-mono text-[10px] sm:text-xs tracking-[0.25em] uppercase text-compass-bright border border-compass/30 rounded px-2.5 py-1 bg-compass/5">
              {status}
            </span>
          )}
        </div>

        {subtitle && (
          <div className="border-b border-exp-border/60 bg-exp-dark/25 px-4 sm:px-5 py-2.5">
            <p className="font-mono text-xs sm:text-sm text-exp-text-dim tracking-wider uppercase">
              {subtitle}
            </p>
          </div>
        )}

        <div className="px-4 sm:px-5 py-4 sm:py-5">
          {children}
        </div>
      </div>
    </section>
  );
}
