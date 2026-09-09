export const designViews = [
  ['all', 'All systems'],
  ['foundation', 'Foundations'],
  ['components', 'Components'],
  ['gameplay', 'Gameplay'],
  ['journeys', 'Journeys'],
  ['standards', 'Standards'],
];

export const stateLenses = [
  ['ready', 'Ready'],
  ['waiting', 'Waiting'],
  ['resolving', 'Resolving'],
  ['danger', 'Danger'],
  ['complete', 'Complete'],
];

export const lifecycle = [
  ['01', 'Discover', 'Promise', 'Understand the fantasy and begin without friction.'],
  ['02', 'Stage', 'Belonging', 'See the crew, role, readiness, and shared objective.'],
  ['03', 'Plan', 'Agency', 'Preview route, cost, risk, and likely consequence.'],
  ['04', 'Commit', 'Trust', 'Lock one deliberate action with unmistakable feedback.'],
  ['05', 'Resolve', 'Drama', 'Follow cause, effect, loss, recovery, and the next opening.'],
  ['06', 'Remember', 'Meaning', 'Turn the run into a story, artifact, and invitation.'],
];

export const actionPatterns = [
  ['Move', 'Route changes, path previews, and board answers.', 'M', 'border-blueprint/55 bg-blueprint/10 text-blueprint-bright'],
  ['Camp', 'Create safety and future recovery.', 'C', 'border-oxide-green/55 bg-oxide-green/10 text-oxide-green-bright'],
  ['Dig', 'High payoff with visible pressure.', 'D', 'border-relic/55 bg-relic/10 text-exp-text'],
  ['Rest', 'Lower danger and restore agency.', 'R', 'border-oxide-green/55 bg-oxide-green/10 text-oxide-green-bright'],
  ['Help', 'Co-op rescue and shared momentum.', 'H', 'border-compass/55 bg-compass/10 text-compass-bright'],
  ['Depart', 'Final commitment under pressure.', 'F', 'border-signal-red/55 bg-signal-red/10 text-signal-red-bright'],
];

export const statusTones = [
  ['Idle', 'Neutral', 'No decision is required yet.', 'border-exp-border bg-exp-dark/45 text-exp-text-dim'],
  ['Ready', 'Compass', 'The player can act now.', 'border-compass/50 bg-compass/10 text-compass-bright'],
  ['Planning', 'Blueprint', 'The choice is still reversible.', 'border-blueprint/50 bg-blueprint/10 text-blueprint-bright'],
  ['Confirmed', 'Oxide', 'The system accepted the choice.', 'border-oxide-green/50 bg-oxide-green/10 text-oxide-green-bright'],
  ['Danger', 'Signal', 'Delay or action has a named cost.', 'border-signal-red/50 bg-signal-red/10 text-signal-red-bright'],
  ['Rare', 'Relic', 'A memorable artifact or discovery.', 'border-relic/50 bg-relic/10 text-exp-text'],
];

export const copyPairs = [
  ['Blocked action', 'Something went wrong.', 'Route exceeds Movement by 1. Undo the last step or Rest.'],
  ['Resolution', 'Success!', 'Camp secured. Pressure -12. The northern route is safe next turn.'],
  ['Waiting', 'Please wait...', 'Action locked. Waiting for P3; you may inspect the board.'],
  ['Danger', 'Are you sure?', 'One more turn risks the Sunstone Lens. Depart now to keep it.'],
];

export const accessibilityStandards = [
  ['Keyboard path', 'Visible focus, logical order, Escape closes layers, Enter confirms only focused intent.', 'automated', 'npm run ux:input'],
  ['Touch and pad', '44 px minimum targets, generous separation, current focus survives state updates.', 'automated', 'npm run ux:touch; hardware session still required'],
  ['Color independence', 'Every tone includes a label, icon, border, pattern, or explicit consequence.', 'automated', 'npm run ui:quality'],
  ['Motion choice', 'Reduced motion removes orbit, pulse, scan, shake, and parallax without hiding state.', 'automated', 'npm run ui:quality'],
  ['Readable scale', 'Core play survives 200% text zoom and narrow reflow without clipped actions.', 'automated', 'npm run ux:input'],
  ['Live feedback', 'Status changes use polite announcements; urgent errors move focus only when necessary.', 'automated', 'npm run ux:assistive; screen-reader session still required'],
];

export const languageTerms = [
  ['Expedition', 'The complete player journey from discovery through remembrance.', 'Use "run" only in compact history and artifact contexts.'],
  ['Survey', 'The live shared session and the act of revealing the map.', 'Use "game" only for technical IDs or platform-level copy.'],
  ['Depart', 'The player-facing commitment to leave the expedition.', '"Flee" remains an internal action enum, never primary interface copy.'],
  ['Pressure', 'The escalating shared risk that makes delay meaningful.', 'Always pair the level with its next concrete consequence.'],
  ['Relic', 'A rare object recovered during an expedition.', 'Use the object name in play; do not call every reward a relic.'],
  ['Run Relic', 'The shareable memory artifact created from a finished expedition.', 'Always capitalize the named artifact and include people, decision, outcome, and replay invitation.'],
];

export const emotionalBeats = [
  ['Discovery', '?', 'A hidden tile becomes possibility.', 'Soft scan and terrain bloom', 'Border and terrain label appear together', 'border-blueprint/45 bg-blueprint/10 text-blueprint-bright'],
  ['Cooperation', '+', 'Your choice makes someone else safer.', 'Two markers answer one another', 'Linked line and named beneficiary', 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green-bright'],
  ['Relief', '~', 'The interface exhales after danger recedes.', 'Pressure halo releases once', 'Pressure delta and safe-state label', 'border-oxide-green/45 bg-oxide-green/10 text-oxide-green-bright'],
  ['Jeopardy', '!', 'The possible loss is specific and preventable.', 'Tight pulse at the endangered object', 'Signal border, cost name, and recovery action', 'border-signal-red/45 bg-signal-red/10 text-signal-red-bright'],
  ['Triumph', '*', 'The result celebrates the decision, not confetti.', 'Route resolves into the relic mark', 'Outcome, crew, value, and named moment', 'border-compass/45 bg-compass/10 text-compass-bright'],
  ['Remembrance', '#', 'The run becomes an artifact worth keeping.', 'Ambient relic shimmer', 'Quote, route fingerprint, and replay invitation', 'border-relic/45 bg-relic/10 text-relic-bright'],
];

export const playersFixture = [
  {
    playerID: 1,
    roleId: 'scout',
    characterId: 'signal-cartographer',
    playerAddress: '0xA17cF882F82D86F58fA4F5B9d77E7B66A11B05E2',
    currentZone: '0,0',
    movement: 4,
    agility: 3,
    dexterity: 2,
    action: 'Move',
    isActive: true,
  },
  {
    playerID: 2,
    roleId: 'medic',
    characterId: 'field-mender',
    playerAddress: '0x2B4D164A4C0c44C725D0D92A69fAE8aE8C8B2Ea3',
    currentZone: '1,1',
    movement: 2,
    agility: 1,
    dexterity: 4,
    action: 'Rest',
    isActive: true,
  },
  {
    playerID: 3,
    roleId: 'carrier',
    characterId: 'relic-tender',
    playerAddress: '0x771FB03A843D1A04C7f94C26a205fb9981147EE9',
    currentZone: '2,1',
    movement: 3,
    agility: 3,
    dexterity: 3,
    action: '',
    isActive: true,
  },
  {
    playerID: 4,
    roleId: 'guard',
    characterId: 'routekeeper',
    playerAddress: '0xA90509dEA8bF2B4C8116F53B5BE18e27E4D6eC43',
    currentZone: '1,2',
    movement: 1,
    agility: 2,
    dexterity: 1,
    action: 'Help',
    isActive: true,
  },
];

export const escapePreviewFixture = {
  level: 'artifact-risk',
  costType: 'artifact-risk',
  tone: 'red',
  pressure: 78,
  label: 'Artifact at risk',
  headline: 'The Sunstone Lens will be exposed',
  body: 'Departing now keeps the crew intact, but the highest-value artifact is no longer guaranteed.',
  nextDelayWarning: 'One more unresolved turn can turn this into crew risk.',
  bestMitigation: { label: 'Rest or reach landing' },
  canEscape: true,
};

export const arcFixture = {
  id: 'redline',
  label: 'Redline',
  shortLabel: 'Redline',
  tone: 'red',
  summary: 'Delay now has a named cost.',
  playerQuestion: 'What cost do we prevent right now?',
  directive: 'Pick a reduction action before the next delay gets worse.',
  nextThreshold: 'Reduce cost or reach Final Call.',
  progress: {
    chartProgress: 76,
    valueProgress: 100,
    routeProgress: 46,
    crewProgress: 75,
  },
};

export const aftermathFixture = {
  title: 'The route held - barely',
  category: 'costly-progress',
  tone: 'gold',
  summary: 'The crew secured the Sunstone Lens, but pressure climbed and P4 lost a point of Movement.',
  whyItMatters: 'You gained enough value to leave with a story. Waiting again risks turning strain into a crew loss.',
  nextPrompt: 'Depart cleanly, or Rest once to bring P4 home safely.',
  receipts: [
    { label: 'Value', value: '+1 artifact' },
    { label: 'Pressure', value: '+14' },
  ],
};

export const memoryFixture = {
  id: 'run-7',
  title: 'The Lantern Route',
  scenarioName: 'Verdant Signal',
  outcome: 'escaped',
  outcomeLabel: 'Crew escaped with the Lens',
  score: 842,
  finalPressure: 78,
  escapeCostLevel: 'artifact-risk',
  escapeCostLabel: 'Artifact risk',
  artifacts: 2,
  survivors: 4,
  crew: 4,
  insight: 'The decisive moment was not the relic discovery. It was choosing to Help before the final departure.',
  badges: ['Routekeeper', 'No One Left', 'Redline Exit', 'Relic Bearer'],
};

export const relicCardFixture = {
  id: 'run-relic-7',
  eyebrow: 'Xenovoya run relic / Verdant Signal',
  title: 'The Lantern Route',
  subtitle: 'A four-explorer expedition remembered at the edge of collapse.',
  stamp: 'Escaped',
  quote: 'We did not leave when it was easy. We left when everyone could.',
  score: '842',
  arc: 'Redline',
  pressure: '78',
  crew: '4 / 4',
  outcome: 'Crew intact',
  cost: 'Sunstone exposed',
  value: '2 artifacts',
  badges: ['Routekeeper', 'No One Left', 'Redline Exit', 'Relic Bearer'],
  challengeTitle: 'Beat the Lantern Route',
  challengeTarget: 'Escape with four crew, two artifacts, and final pressure below 72.',
  fingerprint: {
    title: 'Protective Cartographer',
    replayHook: 'You map widely, take one calculated risk, then spend your final turns protecting the crew.',
  },
  routeMarks: Array.from({ length: 18 }, (_, index) => ({
    active: [1, 2, 3, 6, 7, 8, 11, 14, 15].includes(index),
    danger: [14, 15].includes(index),
    value: [8, 11].includes(index),
  })),
  palette: {
    bg: '#0d0f0a',
    panel: '#1a2016',
    accent: '#e8c860',
    accent2: '#40a080',
    route: '#4c91db',
    danger: '#e86060',
    dim: '#939e88',
  },
};

export const challengeFixture = {
  title: 'Bring everyone home',
  target: 'Escape with four active explorers and final pressure below 72.',
  reason: 'This keeps the same dramatic route but asks for cleaner coordination.',
  reward: '+ Routekeeper mark',
  metric: 'Target pressure',
  targetValue: '< 72',
  path: '/play',
};

const coverageCatalog = [
  ['Navigation', 'Header + Footer', 'Global wayfinding, status, help', 'Ready'],
  ['Navigation', 'Field Manual', 'Open, search, close, keyboard return', 'Ready'],
  ['Navigation', 'Section actions', 'Help, explain, share, inspect', 'Ready'],
  ['Discovery', 'Home hero', 'Promise, proof, primary start', 'Ready'],
  ['Discovery', 'How to play', 'Scan, learn, launch', 'Ready'],
  ['Discovery', 'Game Browser', 'Loading, empty, available, failed', 'Ready'],
  ['Discovery', 'Scenario cards', 'Default, featured, locked, complete', 'Ready'],
  ['Lobby', 'Live Client Stack', 'Disconnected, connecting, ready', 'Ready'],
  ['Lobby', 'Game Lobby', 'Join, wait, ready, creator start', 'Ready'],
  ['Lobby', 'Crew roster', 'Active, inactive, self, full', 'Ready'],
  ['Lobby', 'Share Game Link', 'Copy, copied, unavailable', 'Ready'],
  ['Board', 'Hex Board', 'Fog, revealed, landing, relic, terrain', 'Ready'],
  ['Board', 'Path Overlay', 'Preview, invalid, committed, heavy', 'Ready'],
  ['Board', 'Board Presence', 'Idle, input, fatigue, danger, observing', 'Ready'],
  ['Board', 'Terrain Legend', 'Compact, expanded, trait detail', 'Ready'],
  ['Controls', 'Action Panel', 'Eligible, blocked, selected, submitted', 'Ready'],
  ['Controls', 'Move Control', 'Empty, valid, over budget, undo', 'Ready'],
  ['Controls', 'Action Simulator', 'Likely valid, likely revert', 'Ready'],
  ['Controls', 'Transaction Button', 'Idle, wallet, pending, retry', 'Ready'],
  ['Mission', 'Mission Status', 'Plan, wait, resolve, watch, complete', 'Ready'],
  ['Mission', 'Expedition Arc', 'Survey through Final Call', 'Ready'],
  ['Mission', 'Escape Cost', 'Clean, close, artifact, crew, collapse', 'Ready'],
  ['Mission', 'Readiness Matrix', 'No queue, pending, submitted', 'Ready'],
  ['Mission', 'Turn Timeline', 'Submit, process, play, close, fail', 'Ready'],
  ['Player', 'Player Dossier', 'Self, focused, near intent, inactive', 'Ready'],
  ['Player', 'Stat Bars', 'Healthy, strained, critical', 'Ready'],
  ['Player', 'Inventory', 'Empty, held, protected, bagged', 'Ready'],
  ['Feedback', 'Empty State', 'Neutral, guidance, recoverable error', 'Ready'],
  ['Feedback', 'Transaction Status', 'Pending, confirming, success, error', 'Ready'],
  ['Feedback', 'Modal', 'Open, focus trap, dismiss, stacked content', 'Ready'],
  ['Feedback', 'System Health', 'Healthy, degraded, unavailable', 'Ready'],
  ['Feedback', 'Automation Status', 'Live, delayed, paused', 'Ready'],
  ['Resolution', 'Aftermath Moment', 'Gain, cost, rescue, collapse', 'Ready'],
  ['Resolution', 'Game Over', 'Escaped, lost, abandoned', 'Ready'],
  ['Memory', 'Memory Card', 'Empty, compact, complete', 'Ready'],
  ['Memory', 'Run Relic Card', 'Default, compact, social', 'Ready'],
  ['Memory', 'Share Panel', 'Preview, copy, download, failure', 'Ready'],
  ['Memory', 'Challenge', 'Invite, target, attempt', 'Ready'],
  ['Settings', 'Preferences', 'Density, scale, motion, reset', 'Ready'],
  ['Settings', 'Audio Controls', 'Muted, ambient, feedback, unavailable', 'Ready'],
  ['Wallet', 'Connect Button', 'Disconnected, pending, connected', 'Ready'],
  ['Wallet', 'Network Badge', 'Correct, wrong, switching', 'Ready'],
  ['Responsive', 'Phone play stack', '360-430 px, safe areas, zoom', 'Audit'],
  ['Responsive', 'Desktop cockpit', '1024-1920 px, board priority', 'Ready'],
  ['Responsive', 'TV / handheld', 'Distance reading and pad focus', 'Prototype'],
];

const sourceByPattern = {
  'Header + Footer': 'src/components/layout/Header.jsx',
  'Field Manual': 'src/components/help/FieldManual.jsx',
  'Section actions': 'src/components/help/SectionActions.jsx',
  'Home hero': 'src/pages/HomePage.jsx',
  'How to play': 'src/components/help/SectionHowTo.jsx',
  'Game Browser': 'src/components/game/GameBrowser.jsx',
  'Scenario cards': 'src/pages/GrowthPage.jsx',
  'Live Client Stack': 'src/components/game/LiveClientStack.jsx',
  'Game Lobby': 'src/components/game/GameLobby.jsx',
  'Crew roster': 'src/components/game/GameLobby.jsx',
  'Share Game Link': 'src/components/shared/ShareGameLink.jsx',
  'Hex Board': 'src/components/board/HexGrid.jsx',
  'Path Overlay': 'src/components/board/PathOverlay.jsx',
  'Board Presence': 'src/components/board/BoardPresence.jsx',
  'Terrain Legend': 'src/components/board/TerrainLegend.jsx',
  'Action Panel': 'src/components/actions/ActionPanel.jsx',
  'Move Control': 'src/components/actions/MoveControl.jsx',
  'Action Simulator': 'src/components/actions/ActionSimulator.jsx',
  'Transaction Button': 'src/components/actions/ActionPanel.jsx',
  'Mission Status': 'src/components/expedition/MissionStatus.jsx',
  'Expedition Arc': 'src/components/expedition/ExpeditionArcTrack.jsx',
  'Escape Cost': 'src/components/expedition/EscapeCostPreview.jsx',
  'Readiness Matrix': 'src/components/expedition/ReadinessMatrix.jsx',
  'Turn Timeline': 'src/components/expedition/TurnTimeline.jsx',
  'Player Dossier': 'src/components/player/PlayerDossier.jsx',
  'Stat Bars': 'src/components/player/StatBar.jsx',
  Inventory: 'src/components/player/InventoryPanel.jsx',
  'Empty State': 'src/components/shared/EmptyState.jsx',
  'Transaction Status': 'src/components/shared/TxStatus.jsx',
  Modal: 'src/components/shared/Modal.jsx',
  'System Health': 'src/components/shared/SystemHealth.jsx',
  'Automation Status': 'src/components/shared/AutomationStatus.jsx',
  'Aftermath Moment': 'src/components/resolution/AftermathMoment.jsx',
  'Game Over': 'src/components/game/GameOver.jsx',
  'Memory Card': 'src/components/memory/MemoryCard.jsx',
  'Run Relic Card': 'src/components/memory/RunRelicCard.jsx',
  'Share Panel': 'src/components/memory/RunRelicSharePanel.jsx',
  Challenge: 'src/components/memory/BeatThisChallenge.jsx',
  Preferences: 'src/components/shared/UserPreferencesPanel.jsx',
  'Audio Controls': 'src/components/audio/AudioControls.jsx',
  'Connect Button': 'src/components/wallet/ConnectButton.jsx',
  'Network Badge': 'src/components/wallet/NetworkBadge.jsx',
  'Phone play stack': 'src/pages/DesignSystemPage.jsx',
  'Desktop cockpit': 'src/pages/DesignSystemPage.jsx',
  'TV / handheld': 'src/pages/DesignSystemPage.jsx',
};

const evidenceByPattern = {
  'Header + Footer': ['e2e/home.spec.js', 'e2e/visual.spec.js'],
  'Field Manual': ['e2e/home.spec.js'],
  'Home hero': ['e2e/home.spec.js', 'e2e/visual.spec.js'],
  'Game Browser': ['e2e/home.spec.js'],
  'Scenario cards': ['e2e/growth.spec.js'],
  'Live Client Stack': ['e2e/release-integrity.spec.js'],
  'Game Lobby': ['e2e/visual.spec.js'],
  'Crew roster': ['e2e/visual.spec.js'],
  'Share Game Link': ['src/components/shared/ShareGameLink.test.jsx', 'e2e/home.spec.js'],
  'Hex Board': ['src/components/board/HexGrid.test.jsx', 'e2e/visual.spec.js'],
  'Path Overlay': ['e2e/visual.spec.js'],
  'Board Presence': ['e2e/visual.spec.js'],
  'Terrain Legend': ['e2e/visual.spec.js'],
  'Action Panel': ['src/components/actions/ActionPanel.test.jsx', 'e2e/game-page.spec.js'],
  'Move Control': ['e2e/game-page.spec.js'],
  'Action Simulator': ['e2e/game-page.spec.js'],
  'Transaction Button': ['src/components/actions/ActionPanel.test.jsx'],
  'Mission Status': ['e2e/game-page.spec.js', 'e2e/visual.spec.js'],
  'Expedition Arc': ['src/components/expedition/ExpeditionArcTrack.test.jsx', 'e2e/visual.spec.js'],
  'Escape Cost': ['src/lib/escapeCostPreview.test.js', 'e2e/visual.spec.js'],
  'Readiness Matrix': ['src/components/expedition/ReadinessMatrix.test.jsx', 'e2e/visual.spec.js'],
  'Turn Timeline': ['src/components/expedition/TurnTimeline.test.jsx'],
  'Player Dossier': ['e2e/visual.spec.js'],
  'Stat Bars': ['e2e/visual.spec.js'],
  Inventory: ['e2e/visual.spec.js'],
  'Empty State': ['e2e/visual.spec.js'],
  'Transaction Status': ['e2e/visual.spec.js'],
  Modal: ['src/components/shared/Modal.test.jsx', 'e2e/home.spec.js'],
  'System Health': ['src/components/shared/SystemHealth.test.jsx', 'e2e/release-integrity.spec.js'],
  'Automation Status': ['e2e/release-integrity.spec.js'],
  'Aftermath Moment': ['src/components/resolution/AftermathMoment.test.jsx', 'e2e/visual.spec.js'],
  'Game Over': ['e2e/growth.spec.js'],
  'Memory Card': ['e2e/growth.spec.js', 'e2e/visual.spec.js'],
  'Run Relic Card': ['src/components/memory/RunRelicSharePanel.test.jsx', 'e2e/visual.spec.js'],
  'Share Panel': ['src/components/memory/RunRelicSharePanel.test.jsx', 'e2e/growth.spec.js'],
  Challenge: ['e2e/growth.spec.js'],
  Preferences: ['src/hooks/useUserPreferences.test.jsx'],
  'Audio Controls': ['e2e/home.spec.js'],
  'Connect Button': ['e2e/home.spec.js'],
  'Network Badge': ['e2e/release-integrity.spec.js'],
  'Phone play stack': ['e2e/game-page.spec.js', 'e2e/visual.spec.js'],
  'Desktop cockpit': ['e2e/game-page.spec.js', 'e2e/visual.spec.js'],
};

function evidenceMaturity(pattern, declaredStatus, evidence) {
  if (declaredStatus === 'Prototype') return 'Prototype';
  const hasComponentTest = evidence.some((path) => path.includes('.test.'));
  const hasBrowserTest = evidence.some((path) => path.startsWith('e2e/'));
  if (hasComponentTest && hasBrowserTest) return 'Proven';
  if (evidence.length > 0) return 'Verified';
  return 'Audit';
}

export const coverageRegistry = coverageCatalog.map(([family, pattern, states, declaredStatus]) => {
  const evidence = evidenceByPattern[pattern] || [];
  return [family, pattern, states, evidenceMaturity(pattern, declaredStatus, evidence), {
    source: sourceByPattern[pattern],
    evidence,
    reviewedAt: '2026-09-06',
  }];
});
