const GLASSROOT_CAVERN = '/images/art/environments/glassroot-cavern.webp';
const CHOIR_SEED = '/images/art/relics/choir-seed.png';

export default function RelicMemoryArtwork({ card, compact = false }) {
  const p = card.palette;

  return (
    <div
      className={`relative isolate overflow-hidden rounded border ${compact ? 'min-h-52' : 'min-h-60 sm:min-h-72'}`}
      style={{ borderColor: `${p.route}66`, backgroundColor: p.bg }}
      role="img"
      aria-label="A Choir Seed memory vessel in the Glassroot Cavern"
      data-art-composition="choir-seed-glassroot-memory"
    >
      <img
        src={GLASSROOT_CAVERN}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, ${p.bg}f5 0%, ${p.bg}c9 42%, ${p.bg}14 72%), linear-gradient(0deg, ${p.bg}f2 0%, transparent 58%)`,
        }}
      />
      <div className="absolute -bottom-[18%] -right-[8%] h-[92%] w-[58%] rounded-full bg-oxide-green/10 blur-2xl" aria-hidden="true" />
      <img
        src={CHOIR_SEED}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute -bottom-[7%] -right-[4%] h-[82%] w-[55%] origin-bottom-right scale-[1.28] object-contain object-bottom drop-shadow-[0_18px_28px_rgba(0,0,0,0.72)]"
      />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] sm:text-[10px]" style={{ color: p.accent }}>
          {card.eyebrow}
        </p>
        <span className="rounded border bg-exp-dark/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] backdrop-blur-sm sm:text-[10px]" style={{ borderColor: `${p.accent2}99`, color: p.accent2 }}>
          {card.stamp}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 z-10 w-[68%] p-3 sm:p-4">
        <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-exp-text-dim sm:text-[9px]">
          Memory vessel / Choir Seed
        </p>
        <h3 className="mt-2 font-display text-xl uppercase leading-none tracking-[0.08em] text-exp-text sm:text-3xl">
          {card.title}
        </h3>
        <p className="mt-2 line-clamp-2 font-mono text-[10px] leading-relaxed sm:text-[11px]" style={{ color: p.dim }}>
          {card.subtitle}
        </p>
      </div>
    </div>
  );
}
