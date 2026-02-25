export default function DayNightBadge({ phase }) {
  const isDay = phase === 'Day';
  const isNight = phase === 'Night';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded border font-mono text-xs tracking-widest uppercase
      ${isDay
        ? 'text-day border-day/30 bg-day/5'
        : isNight
          ? 'text-night border-night/30 bg-night/5'
          : 'text-exp-text-dim border-exp-border bg-exp-dark/40'
      }`}
    >
      {/* Sun/Moon icon */}
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
        {isDay ? (
          <>
            <circle cx="8" cy="8" r="3" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
              const rad = (angle * Math.PI) / 180;
              const x1 = 8 + Math.cos(rad) * 5;
              const y1 = 8 + Math.sin(rad) * 5;
              const x2 = 8 + Math.cos(rad) * 6.5;
              const y2 = 8 + Math.sin(rad) * 6.5;
              return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1" />;
            })}
          </>
        ) : (
          <path d="M8 2a6 6 0 004.5 10A6 6 0 118 2z" />
        )}
      </svg>
      <span>{phase || 'Unknown'}</span>
    </div>
  );
}
