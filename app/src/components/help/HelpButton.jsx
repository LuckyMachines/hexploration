export default function HelpButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded border border-exp-border
                 bg-exp-dark/40 text-exp-text-dim hover:text-compass hover:border-compass/40
                 transition-colors"
      aria-label="Open Field Manual"
      title="Field Manual"
    >
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="1" width="10" height="14" rx="1" />
        <line x1="6" y1="5" x2="10" y2="5" />
        <line x1="6" y1="8" x2="10" y2="8" />
        <line x1="6" y1="11" x2="8" y2="11" />
      </svg>
    </button>
  );
}
