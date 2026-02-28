function SectionHeader({ children }) {
  return (
    <h3 className="font-display tracking-[0.25em] text-compass uppercase text-xs mb-2 mt-5 first:mt-0
                   border-b border-exp-border pb-1">
      {children}
    </h3>
  );
}

const STEPS = [
  'Connect your wallet and switch to the Sepolia network.',
  'Create a new expedition or join an existing one from the console.',
  'Wait for all players to register. The game starts automatically.',
  'On your turn, choose an action: Move to explore, Dig for artifacts, Rest to recover stats, or Help allies.',
  'Submit your action on-chain. A card draw determines the outcome using VRF randomness.',
  'Gather artifacts and relics while managing your Movement, Agility, and Dexterity stats.',
  'Return to the landing site with enough artifacts and choose Flee to escape and win.',
];

const TIPS = [
  'Keep an eye on your stats. If Movement hits zero, you cannot move.',
  'Setup camp before resting for better recovery odds.',
  'Mountains are dangerous but contain rare relics worth the risk.',
  'Coordinate with other players. The Help action can save an ally from stat depletion.',
  'Watch the day/night cycle. Night phases bring environmental hazards.',
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
