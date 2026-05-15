export const FUN_ACTION_PREVIEWS = {
  move: {
    intent: 'Close distance',
    upside: 'The route shortens or a zone opens.',
    risk: 'Danger rises if the route resists.',
    line: 'If the path answers, we move now.',
    reactionClass: 'fun-react-move',
  },
  dig: {
    intent: 'Press your luck',
    upside: 'Artifact payoff or a strange clue.',
    risk: 'Danger spike, cave-in, or wasted turn.',
    line: 'One more dig could make the story.',
    reactionClass: 'fun-react-dig',
  },
  rest: {
    intent: 'Create recovery',
    upside: 'Morale and safety rebound.',
    risk: 'Route progress stalls.',
    line: 'Breathe now, move better after.',
    reactionClass: 'fun-react-rest',
  },
  help: {
    intent: 'Save the team',
    upside: 'Teammate recovery and morale.',
    risk: 'Slower escape.',
    line: 'Nobody gets left as a statistic.',
    reactionClass: 'fun-react-help',
  },
  flee: {
    intent: 'Force the ending',
    upside: 'Escape or dramatic near miss.',
    risk: 'Danger if the route is still too long.',
    line: 'This is the button we remember.',
    reactionClass: 'fun-react-flee',
  },
  inspect: {
    intent: 'Turn uncertainty into a choice',
    upside: 'Useful information and safer next input.',
    risk: 'Low direct progress.',
    line: 'Name the danger before it names us.',
    reactionClass: 'fun-react-inspect',
  },
};

export const FUN_ARTIFACTS = [
  { id: 'sun-compass', name: 'Sun Compass', hook: 'Points toward the landing flash.', effect: 'flee-focus', shareFlavor: 'sunlit escape' },
  { id: 'bone-lantern', name: 'Bone Lantern', hook: 'Makes fog feel less empty.', effect: 'fog-read', shareFlavor: 'lantern run' },
  { id: 'storm-key', name: 'Storm Key', hook: 'Turns danger into a door.', effect: 'storm-route', shareFlavor: 'storm-key gamble' },
  { id: 'glass-idol', name: 'Glass Idol', hook: 'Pays off greed with brittle pressure.', effect: 'greed-payoff', shareFlavor: 'glass idol sprint' },
  { id: 'root-crown', name: 'Root Crown', hook: 'Lets recovery feel ancient and earned.', effect: 'recovery-boost', shareFlavor: 'root crown comeback' },
];

export const FUN_ROLES = [
  { id: 'scout', name: 'Scout', ability: 'Move can reveal an extra zone.' },
  { id: 'medic', name: 'Medic', ability: 'Rest and help recover more morale.' },
  { id: 'carrier', name: 'Carrier', ability: 'Artifacts lower flee risk.' },
  { id: 'guard', name: 'Guard', ability: 'Danger spikes are softened.' },
];

export const FUN_EVENT_CARDS = [
  { id: 'storm-front', title: 'Storm Front', text: 'Weather slams the route sideways.', actions: ['move', 'flee'], effect: { danger: 8 }, feelingBias: 'panic', momentType: 'panic' },
  { id: 'old-trail', title: 'Old Trail', text: 'A half-buried trail cuts the distance.', actions: ['move', 'inspect'], effect: { distance: -1, revealed: 1 }, feelingBias: 'surprise', momentType: 'clean-read' },
  { id: 'hollow-ground', title: 'Hollow Ground', text: 'The dig opens bad air under the crew.', actions: ['dig'], effect: { danger: 10, morale: -5 }, feelingBias: 'panic', momentType: 'route-betrayal' },
  { id: 'signal-spark', title: 'Signal Spark', text: 'A signal flashes through the fog.', actions: ['rest', 'help', 'inspect'], effect: { danger: -8, morale: 5 }, feelingBias: 'recovery', momentType: 'recovery' },
  { id: 'broken-strap', title: 'Broken Strap', text: 'Gear fails at the worst second.', actions: ['rest', 'flee'], effect: { morale: -8, friction: 12 }, feelingBias: 'friction', momentType: 'route-betrayal' },
  { id: 'whispering-ruins', title: 'Whispering Ruins', text: 'The ruin gives up a clue and asks for nerve.', actions: ['dig', 'inspect'], effect: { revealed: 2, danger: 3 }, feelingBias: 'surprise', momentType: 'payoff' },
  { id: 'sudden-clearing', title: 'Sudden Clearing', text: 'Fog tears open and the route feels real.', actions: ['move', 'inspect'], effect: { revealed: 1, distance: -1 }, feelingBias: 'alive', momentType: 'clean-read' },
  { id: 'exhaustion-wave', title: 'Exhaustion Wave', text: 'The crew slows at the same time.', actions: ['move', 'dig', 'flee'], effect: { morale: -9, friction: 8 }, feelingBias: 'flat', momentType: 'panic' },
];

export const CHALLENGE_MODIFIERS = [
  { id: 'heavy-fog', name: 'Heavy Fog', effect: { revealed: -1 }, description: 'Lower starting visibility, stronger inspect value.' },
  { id: 'low-morale', name: 'Low Morale', effect: { morale: -12 }, description: 'Lower start, bigger recovery stakes.' },
  { id: 'extra-relic', name: 'Extra Relic', effect: { artifact: true }, description: 'Start with a tempting artifact.' },
  { id: 'damaged-route', name: 'Damaged Route', effect: { distance: 1 }, description: 'Longer route, bigger flee payoff.' },
  { id: 'calm-start', name: 'Calm Start', effect: { danger: -10 }, description: 'Safer start with lower drama multiplier.' },
  { id: 'storm-season', name: 'Storm Season', effect: { danger: 8, eventBias: 'storm-front' }, description: 'More volatile event cards.' },
];

const BARKS = {
  preview: ['I can feel the turn waiting.', 'This choice has teeth.', 'Say it clean and I will move.'],
  move: ['Route is answering.', 'Feet first, fear after.', 'We make the map by crossing it.'],
  dig: ['The ground has a secret.', 'Greed gets one swing.', 'If it shines, we run.'],
  rest: ['Breath is a weapon too.', 'Hold still. Come back alive.', 'We buy the next turn here.'],
  help: ['I have you.', 'No one becomes a footnote.', 'Team before treasure.'],
  flee: ['Now or never.', 'This is the story button.', 'Run it to the light.'],
  inspect: ['Fog has edges.', 'Name the danger.', 'Read first, bleed less.'],
  payoff: ['That is why we came.', 'Worth the danger.', 'Now the run has a heartbeat.'],
  panic: ['The route is biting back.', 'Bad turn. Stay loud.', 'Do not let the map win.'],
  recovery: ['There. We are back in it.', 'The run has lungs again.', 'That saved more than a number.'],
  flat: ['The board barely answered.', 'That felt thin.', 'We need a sharper choice.'],
  escape: ['Lift-off. Remember this turn.', 'We made the landing light.', 'Out with the story intact.'],
  loss: ['The route keeps the ending.', 'Close enough to haunt us.', 'The expedition becomes a warning.'],
};

function hash(value) {
  let h = 2166136261;
  for (const char of String(value)) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function funRoll(seed, turn, action, salt = 'fun') {
  return hash(`${seed}|${turn}|${action}|${salt}`) / 4294967295;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function asArtifactArray(value) {
  if (Array.isArray(value)) return value;
  const count = Math.max(0, Number(value) || 0);
  return FUN_ARTIFACTS.slice(0, count);
}

export function assignFunRoles(playerCount = 1) {
  return FUN_ROLES.slice(0, Math.max(1, Math.min(FUN_ROLES.length, Number(playerCount) || 1)));
}

export function modifierForSeed(seed = '') {
  return CHALLENGE_MODIFIERS[hash(seed) % CHALLENGE_MODIFIERS.length];
}

export function initialFunState({ scenario = {}, seed = '', mode = 'standard', challenge = false } = {}) {
  const modifier = challenge ? modifierForSeed(seed) : mode === 'chaos' ? CHALLENGE_MODIFIERS.find((item) => item.id === 'storm-season') : null;
  const roles = assignFunRoles(scenario.players || 1);
  const startingArtifacts = asArtifactArray(scenario.start?.artifacts);
  const modifierArtifact = modifier?.effect?.artifact ? [FUN_ARTIFACTS[hash(`${seed}|artifact`) % FUN_ARTIFACTS.length]] : [];
  return {
    mode,
    modifier,
    roles,
    artifacts: [...startingArtifacts, ...modifierArtifact],
    digStreak: 0,
    bests: {},
  };
}

export function applyModifierToState(state = {}, modifier = null) {
  if (!modifier) return state;
  return {
    ...state,
    morale: clamp((state.morale || 0) + (modifier.effect?.morale || 0)),
    danger: clamp((state.danger || 0) + (modifier.effect?.danger || 0)),
    revealed: Math.max(0, (state.revealed || 0) + (modifier.effect?.revealed || 0)),
    distance: Math.max(0, (state.distance || 0) + (modifier.effect?.distance || 0)),
  };
}

export function actionPreviewFor(run = {}, action = 'inspect') {
  const preview = FUN_ACTION_PREVIEWS[action] || FUN_ACTION_PREVIEWS.inspect;
  const roles = run.fun?.roles || [];
  const role = roles.find((item) => (
    (action === 'move' && item.id === 'scout')
    || (['rest', 'help'].includes(action) && item.id === 'medic')
    || (action === 'flee' && item.id === 'carrier')
    || (run.state?.danger >= 65 && item.id === 'guard')
  ));
  const dangerState = run.state?.morale <= 35 || run.state?.danger >= 70 || (run.scenario?.maxTurns - run.turn <= 2 && run.state?.distance >= 2);
  const digStreak = action === 'dig' ? Number(run.fun?.digStreak || 0) + 1 : 0;
  return {
    action,
    ...preview,
    roleHook: role ? `${role.name}: ${role.ability}` : null,
    dangerHook: dangerState ? 'Comeback valve active: this can swing harder than usual.' : null,
    digHook: digStreak > 1 ? `Press-your-luck dig x${digStreak}: bigger payoff, sharper cave-in risk.` : null,
  };
}

export function artifactFor(seed, turn) {
  return FUN_ARTIFACTS[hash(`${seed}|${turn}|artifact`) % FUN_ARTIFACTS.length];
}

export function roleDelta(run = {}, action = '', delta = {}) {
  const roles = run.fun?.roles || [];
  const next = { ...delta };
  if (action === 'move' && roles.some((role) => role.id === 'scout')) next.revealed = (next.revealed || 0) + 1;
  if (['rest', 'help'].includes(action) && roles.some((role) => role.id === 'medic')) next.morale = (next.morale || 0) + 5;
  if (action === 'flee' && roles.some((role) => role.id === 'carrier') && asArtifactArray(run.state?.artifacts).length > 0) next.danger = (next.danger || 0) - 5;
  if (roles.some((role) => role.id === 'guard') && (next.danger || 0) > 6) next.danger -= 4;
  return next;
}

export function comebackDelta(run = {}, action = '', delta = {}) {
  const next = { ...delta };
  const finalPressure = (run.scenario?.maxTurns || 0) - (run.turn || 0) <= 2 && (run.state?.distance || 0) >= 2;
  if ((run.state?.morale || 0) <= 35 && action === 'rest') next.morale = (next.morale || 0) + 8;
  if ((run.state?.danger || 0) >= 70 && action === 'help') next.morale = (next.morale || 0) + 6;
  if ((run.state?.danger || 0) >= 70 && action === 'inspect') next.distance = (next.distance || 0) - 1;
  if (finalPressure && action === 'flee') next.distance = (next.distance || 0) - 1;
  return next;
}

export function secondaryEventFor(run = {}, action = 'inspect') {
  const turn = (run.turn || 0) + 1;
  const chance = run.fun?.mode === 'chaos' ? 0.58 : 0.34;
  if (funRoll(run.seed, turn, action, 'event-chance') > chance) return null;
  const candidates = FUN_EVENT_CARDS.filter((card) => card.actions.includes(action));
  if (candidates.length === 0) return null;
  const biased = run.fun?.modifier?.effect?.eventBias;
  if (biased) {
    const match = candidates.find((card) => card.id === biased);
    if (match) return match;
  }
  return candidates[Math.floor(funRoll(run.seed, turn, action, 'event-card') * candidates.length) % candidates.length];
}

export function applyEventEffect(delta = {}, event = null) {
  if (!event) return { ...delta };
  return {
    ...delta,
    morale: (delta.morale || 0) + (event.effect?.morale || 0),
    danger: (delta.danger || 0) + (event.effect?.danger || 0),
    revealed: (delta.revealed || 0) + (event.effect?.revealed || 0),
    distance: (delta.distance || 0) + (event.effect?.distance || 0),
    friction: (delta.friction || 0) + (event.effect?.friction || 0),
  };
}

export function fleeOutcomeFor(run = {}, after = {}, action = '') {
  if (action !== 'flee') return null;
  if (after.escaped && after.danger < 55) return 'clean escape';
  if (after.escaped) return 'close escape';
  if ((after.distance || 0) <= 1) return 'near miss';
  if (asArtifactArray(after.artifacts).length > 0 && (after.danger || 0) >= 70) return 'artifact dropped';
  if ((after.morale || 0) <= 25) return 'teammate left behind';
  return 'forced retreat';
}

export function barkFor({ seed = '', turn = 0, action = 'inspect', feelingLabel = '', outcome = '' } = {}) {
  const key = outcome === 'escaped'
    ? 'escape'
    : ['collapsed', 'lost', 'stranded-with-artifact'].includes(outcome)
      ? 'loss'
      : BARKS[feelingLabel]?.length
        ? feelingLabel
        : BARKS[action]?.length
          ? action
          : 'preview';
  const options = BARKS[key] || BARKS.preview;
  return options[hash(`${seed}|${turn}|${action}|${feelingLabel}|bark`) % options.length];
}

export function momentForEvent({ action = '', feelingLabel = '', after = {}, eventCard = null, fleeOutcome = null } = {}) {
  if (eventCard?.momentType) return { type: eventCard.momentType, title: eventCard.title };
  if (after.escaped) return { type: 'escape', title: fleeOutcome === 'clean escape' ? 'Clean Escape' : 'Escape Window' };
  if (feelingLabel === 'payoff') return { type: 'payoff', title: action === 'dig' ? 'Relic Hit' : 'Payoff Turn' };
  if (feelingLabel === 'panic') return { type: 'panic', title: 'Panic Turn' };
  if (feelingLabel === 'recovery') return { type: 'recovery', title: 'Recovery Turn' };
  if (feelingLabel === 'friction') return { type: 'route-betrayal', title: 'Route Betrayal' };
  if (feelingLabel === 'surprise') return { type: 'clean-read', title: 'Clean Read' };
  return null;
}

export function reactionClassFor(action = '', feelingLabel = '') {
  if (feelingLabel === 'panic') return 'fun-react-panic';
  if (feelingLabel === 'payoff') return 'fun-react-payoff';
  if (feelingLabel === 'recovery') return 'fun-react-recovery';
  return FUN_ACTION_PREVIEWS[action]?.reactionClass || 'fun-react-inspect';
}

export function longestFlatStreak(timeline = []) {
  let longest = 0;
  let current = 0;
  for (const event of timeline) {
    if (event.feelingLabel === 'flat' || event.lifePulse <= 32) current += 1;
    else current = 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

export function funQualityForRun(run = {}) {
  const timeline = run.timeline || [];
  const firstAlive = timeline.find((event) => event.feelingLabel === 'alive' || event.lifePulse >= 60);
  const payoffMoments = timeline.filter((event) => ['payoff', 'surprise'].includes(event.feelingLabel) || event.momentType === 'payoff');
  const pressureSpikes = timeline.filter((event) => event.feelingLabel === 'panic' || event.momentType === 'panic' || event.after?.danger >= 70);
  const recoveryMoments = timeline.filter((event) => event.feelingLabel === 'recovery' || event.momentType === 'recovery');
  const comebackMoments = timeline.filter((event) => event.comebackLabel);
  const shareWorthyMoment = [...payoffMoments, ...recoveryMoments, ...pressureSpikes, ...timeline.filter((event) => event.after?.escaped)].sort((a, b) => (b.lifePulse + b.agencyScore) - (a.lifePulse + a.agencyScore))[0] || null;
  const flatStreak = longestFlatStreak(timeline);
  const gates = {
    firstAlive: Boolean(firstAlive && firstAlive.turn <= 2),
    payoff: payoffMoments.length > 0,
    pressure: pressureSpikes.length > 0,
    recovery: recoveryMoments.length + comebackMoments.length > 0,
    flatStreak: flatStreak <= 1,
    shareWorthy: Boolean(shareWorthyMoment),
  };
  const passed = Object.values(gates).filter(Boolean).length;
  const funVerdict = passed >= 5 ? 'share-worthy' : passed >= 4 ? 'nearly-there' : passed >= 2 ? 'needs-spark' : 'flat';
  const recommendations = [];
  if (!gates.firstAlive) recommendations.push('Move the first meaningful board response into turns 1-2.');
  if (!gates.payoff) recommendations.push('Add artifact, escape, or discovery payoff.');
  if (!gates.pressure) recommendations.push('Add one readable danger spike.');
  if (!gates.recovery) recommendations.push('Add a recovery valve through rest or help.');
  if (!gates.flatStreak) recommendations.push('Use a clue, event card, or reveal to break flat streaks.');
  return {
    firstAliveTurn: firstAlive?.turn || null,
    payoffMoments: payoffMoments.length,
    pressureSpikes: pressureSpikes.length,
    recoveryMoments: recoveryMoments.length + comebackMoments.length,
    longestFlatStreak: flatStreak,
    shareWorthyMoment,
    gates,
    funVerdict,
    recommendations,
  };
}

export function runTitleFor({ run = {}, summary = {}, quality = null } = {}) {
  const artifacts = asArtifactArray(run.state?.artifacts);
  const artifact = artifacts[artifacts.length - 1];
  if (run.outcome === 'escaped' && summary.turns >= (summary.maxTurns || 0) - 1) return `The Turn ${summary.turns} Lift-Off`;
  if (artifact && summary.outcome === 'escaped') return `The ${artifact.name} Sprint`;
  if (quality?.shareWorthyMoment?.feelingLabel === 'recovery') return 'The Recovery Save';
  if (summary.outcome === 'collapsed') return 'The Route Won';
  if (summary.outcome === 'stranded-with-artifact') return 'The Greed Tax';
  return `${summary.scenarioName || 'Expedition'}: ${summary.arcShape || 'Run'}`;
}

export function badgesForRun(run = {}, summary = {}, quality = null) {
  const badges = [];
  if (summary.outcome === 'escaped') badges.push('First Escape');
  if (quality?.recoveryMoments > 0 && (run.state?.danger || 0) >= 55) badges.push('Clutch Recovery');
  if ((run.fun?.maxDigStreak || 0) >= 2 && asArtifactArray(run.state?.artifacts).length > 0) badges.push('Greedy Dig');
  if ((run.state?.danger || 0) <= 35 && summary.outcome === 'escaped') badges.push('Clean Run');
  if ((run.state?.savedPlayers || 0) >= (run.scenario?.players || 1) - 1 && (run.scenario?.players || 1) > 1) badges.push('Everybody Out');
  if (summary.outcome === 'escaped' && summary.turns >= (summary.maxTurns || 0)) badges.push('Last-Turn Miracle');
  if (['collapsed', 'stranded-with-artifact', 'lost'].includes(summary.outcome) && quality?.shareWorthyMoment) badges.push('Disaster Worth Sharing');
  if (quality?.firstAliveTurn && quality.firstAliveTurn <= 1) badges.push('Calm Under Fog');
  if (summary.artifacts > 0 && summary.turns <= 3) badges.push('Relic Sprint');
  if (quality?.recoveryMoments > 0 && (run.state?.savedPlayers || 0) > 0) badges.push('Team Save');
  return [...new Set(badges)].slice(0, 5);
}

export function epilogueForRun(run = {}, quality = null) {
  if (run.outcome === 'escaped') return 'The landing light catches the crew before the route can close.';
  if (run.outcome === 'stranded-with-artifact') return 'The relic made it into the story, but not out of the wild.';
  if (run.outcome === 'collapsed') return 'Morale broke before the map did.';
  if (quality?.shareWorthyMoment) return 'The run failed, but it left a moment worth replaying.';
  return 'The expedition ends as a warning for the next seed.';
}

export function personalBestsAfter(runs = []) {
  const completed = runs.filter((run) => run.completed);
  const rows = completed.map((run) => {
    const quality = funQualityForRun(run);
    return {
      run,
      artifacts: asArtifactArray(run.state?.artifacts).length,
      danger: run.state?.danger || 0,
      savedPlayers: run.state?.savedPlayers || 0,
      arcScore: run.summary?.arcScore || 0,
      challengeScore: run.summary?.challengeScore || 0,
      turns: run.turn || 0,
      quality,
    };
  });
  const byMax = (field) => [...rows].sort((a, b) => b[field] - a[field])[0] || null;
  const byMin = (field) => [...rows].sort((a, b) => a[field] - b[field])[0] || null;
  return {
    fastestEscape: rows.filter((row) => row.run.outcome === 'escaped').sort((a, b) => a.turns - b.turns)[0]?.turns || null,
    highestArcScore: byMax('arcScore')?.arcScore || null,
    mostArtifacts: byMax('artifacts')?.artifacts || null,
    lowestDangerFinish: byMin('danger')?.danger ?? null,
    mostSavedPlayers: byMax('savedPlayers')?.savedPlayers || null,
    bestChallengeScore: byMax('challengeScore')?.challengeScore || null,
  };
}

export function funReportText(quality = {}) {
  if (quality.funVerdict === 'share-worthy') return 'This run worked because it produced a clear retellable moment.';
  if (quality.funVerdict === 'nearly-there') return 'This run has a spark, but one gate still needs a stronger beat.';
  if (quality.funVerdict === 'needs-spark') return 'This run needs a sharper payoff, recovery, or pressure beat.';
  return 'This run dragged because too few inputs changed the story.';
}

export function publicArtifactNames(run = {}) {
  return asArtifactArray(run.state?.artifacts).map((artifact) => artifact.name);
}
