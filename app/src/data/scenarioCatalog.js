export const SCENARIO_CATALOG = [
  {
    id: 'solo-artifact-hunt',
    name: 'Solo Artifact Hunt',
    tags: ['solo', 'artifact', 'survival'],
    players: 1,
    turns: 12,
    strategies: ['dig', 'balanced', 'risky'],
    designQuestion: 'Does artifact hunting produce payoff before the run goes flat?',
    assumptions: ['playerStats: not enforced yet'],
    command: 'npm run scenario:run -- --id=solo-artifact-hunt',
  },
  {
    id: 'escape-pressure-4p',
    name: 'Escape Pressure 4P',
    tags: ['multiplayer', 'cooperation', 'escape', 'survival'],
    players: 4,
    turns: 10,
    strategies: ['balanced', 'rest', 'move', 'risky'],
    designQuestion: 'Does escape pressure create interesting cooperation instead of pure panic?',
    assumptions: ['playerStats: not enforced yet', 'artifactsHeld: not enforced yet', 'landingRevealed: observed only'],
    command: 'npm run scenario:run -- --id=escape-pressure-4p',
  },
];
