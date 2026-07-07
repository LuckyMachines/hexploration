function SectionHeader({ children }) {
  return (
    <h3 className="font-display tracking-[0.25em] text-compass uppercase text-xs mb-2 mt-5 first:mt-0
                   border-b border-exp-border pb-1">
      {children}
    </h3>
  );
}

const STEPS = [
  'Enter an expedition and read the landing site.',
  'Move to reveal useful ground without losing the route home.',
  'Dig when the tile is worth the risk and the crew can afford the time.',
  'Rest or help when the crew needs another chance.',
  'Watch pressure, stats, and distance from landing as the route stretches.',
  'Return to the landing site with enough recovered value.',
  'Choose Flee to escape and lock in the run.',
];

const TIPS = [
  'The best run is not the deepest run; it is the deepest run that still gets home.',
  'Keep a readable route back to landing.',
  'Dig only when the crew can afford the time.',
  'Rest before zero movement turns the map into a trap.',
  'Use Help to keep a teammate from becoming the reason everyone stays too long.',
];

export default function SectionHowTo() {
  return (
    <div className="font-mono text-xs text-exp-text leading-relaxed">
      <SectionHeader>Step by Step</SectionHeader>
      <ol className="space-y-2 mt-2">
        {STEPS.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-compass/20 border border-compass/40
                             flex items-center justify-center text-compass text-xs tabular-nums">
              {i + 1}
            </span>
            <span className="text-exp-text-dim">{step}</span>
          </li>
        ))}
      </ol>

      <SectionHeader>Strategy Tips</SectionHeader>
      <ul className="space-y-1 mt-2">
        {TIPS.map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-exp-text-dim">
            <span className="text-compass shrink-0 mt-0.5">&#x2022;</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
