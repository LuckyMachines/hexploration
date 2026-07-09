import { Action, PROCESSING_LABELS, Tile } from './constants';
import { getActionMeta } from './actionMeta';
import { TurnState } from './turnState';

const ACTION_BARKS = {
  [Action.MOVE]: [
    'I can feel the route under my boots.',
    'One tile at a time. No wasted steps.',
    'Mark it clean and I will make it clean.',
  ],
  [Action.SETUP_CAMP]: [
    'Give me ten quiet minutes and a flat patch of ground.',
    'A fire changes what the dark thinks it owns.',
    'Stakes down. Breathe later.',
  ],
  [Action.BREAK_DOWN_CAMP]: [
    'Pack light. Leave no warm ashes.',
    'Camp folds faster when the horizon turns wrong.',
    'Taking the good luck with us.',
  ],
  [Action.DIG]: [
    'The dirt is hiding something with a pulse.',
    'If the ground answers, I am listening.',
    'Spade first. Questions after.',
  ],
  [Action.REST]: [
    'Stillness counts if you do it on purpose.',
    'I can get one good breath back.',
    'Hold the line. I need my hands steady.',
  ],
  [Action.HELP]: [
    'Signal me who needs a shoulder.',
    'Nobody crosses this place alone.',
    'Point me at the weakest link before it snaps.',
  ],
  [Action.FLEE]: [
    'If this is the run, make it sharp.',
    'I only need the landing beacon once.',
    'No heroics if the exit is open.',
  ],
  [Action.IDLE]: [
    'Quiet is still a decision.',
    'I am counting the seconds back.',
    'Nothing moved. That bothers me.',
  ],
};

const MOMENT_TITLES = {
  [Action.MOVE]: ['The Long Way Around', 'Boots Against the Grid', 'One Step Too Far'],
  [Action.SETUP_CAMP]: ['Camp Under Bad Stars', 'A Ring of Warmth', 'The Lantern Treaty'],
  [Action.BREAK_DOWN_CAMP]: ['Cold Ashes', 'Packed Before Dawn', 'No Trace Left'],
  [Action.DIG]: ['The Quiet Dig', 'Metal Below the Roots', 'A Shovel Hits Memory'],
  [Action.REST]: ['Borrowed Breath', 'One Stat Saved', 'The Still Turn'],
  [Action.HELP]: ['Hands Across the Dark', 'The Signal Holds', 'A Shared Burden'],
  [Action.FLEE]: ['The Red Line Home', 'Beacon or Bust', 'The Last Sprint'],
  [Action.IDLE]: ['The Held Breath', 'Silence Has Weight', 'Waiting Counts'],
};

const TERRAIN_MOODS = {
  [Tile.NONE]: 'the fog presses back',
  [Tile.JUNGLE]: 'the canopy clicks and settles',
  [Tile.PLAINS]: 'the grass leans like it heard you',
  [Tile.DESERT]: 'heat drags a second shadow behind you',
  [Tile.MOUNTAIN]: 'stone answers every footstep',
  [Tile.LANDING]: 'the beacon keeps a thin promise',
  [Tile.RELIC]: 'the relic hum gets inside your teeth',
};

const CUE_BY_TONE = {
  calm: ['low pulse', 'cloth rustle'],
  danger: ['red tremor', 'thin heartbeat'],
  discovery: ['bright ping', 'dust chime'],
  camp: ['soft flame', 'gear clack'],
  submit: ['lock snap', 'ink stamp'],
  fail: ['dry click', 'static cut'],
  near: ['held breath', 'edge scrape'],
};

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stableIndex(parts, length) {
  if (length <= 0) return 0;
  const input = parts.filter((part) => part !== undefined && part !== null).join('|');
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 9973;
  }
  return Math.abs(hash) % length;
}

function pick(list, parts) {
  return list[stableIndex(parts, list.length)];
}

function statPressure(stats = {}) {
  const movement = toNumber(stats.movement, 3);
  const agility = toNumber(stats.agility, 3);
  const dexterity = toNumber(stats.dexterity, 3);
  const lows = [movement, agility, dexterity].filter((value) => value <= 1).length;
  const average = (movement + agility + dexterity) / 3;
  return {
    movement,
    agility,
    dexterity,
    lows,
    average,
    isTired: lows > 0 || average < 2.2,
  };
}

function buildMood({ hasSubmitted, isSpectator, turnState, routeStatus, movePath = [], stats = {}, boardInput = {} }) {
  const pressure = statPressure(stats);

  if (isSpectator) {
    return { key: 'watching', label: 'Watching', tone: 'blue', body: 'The expedition feels distant but readable.' };
  }
  if (turnState?.state === TurnState.RESOLVING || turnState?.isResolving) {
    return { key: 'braced', label: 'Braced', tone: 'blue', body: 'The explorer has gone still while the chain resolves.' };
  }
  if (hasSubmitted) {
    return { key: 'locked', label: 'Locked In', tone: 'green', body: 'The decision is made. Now the body catches up.' };
  }
  if (routeStatus?.isValid === false) {
    return { key: 'rattled', label: 'Rattled', tone: 'red', body: 'The route feels wrong underfoot.' };
  }
  if (pressure.isTired) {
    return { key: 'worn', label: 'Worn Thin', tone: 'red', body: 'Low stats make every choice feel louder.' };
  }
  if (movePath.length >= 2) {
    return { key: 'committed', label: 'Committed', tone: 'gold', body: 'Momentum is building along the planned path.' };
  }
  if (boardInput.inputCadence === 'urgent') {
    return { key: 'wired', label: 'Wired', tone: 'gold', body: 'Fast input makes the scout lean forward.' };
  }
  if (boardInput.inputCadence === 'idle' || boardInput.lastInputKind === 'idle') {
    return { key: 'listening', label: 'Listening', tone: 'neutral', body: 'No input is still a posture: eyes up, breath low.' };
  }
  return { key: 'focused', label: 'Focused', tone: 'green', body: 'The next command has weight.' };
}

function buildRisk({ activeTab, movePath = [], movement = 0, routeStatus, stats = {}, activeInventory = {}, turnState }) {
  const pressure = statPressure(stats);
  let score = 0;
  score += Math.min(42, (movePath.length / Math.max(1, movement || 1)) * 42);
  score += pressure.lows * 15;
  if (routeStatus?.isValid === false) score += 35;
  if (activeTab === Action.DIG) score += pressure.dexterity <= 1 ? 26 : 14;
  if (activeTab === Action.FLEE) score += 34;
  if (turnState?.state === TurnState.RESOLVING) score += 12;
  if (activeInventory.shield || activeInventory.campsite) score -= 8;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const level = clamped >= 72 ? 'redline' : clamped >= 46 ? 'hot' : clamped >= 22 ? 'live' : 'steady';
  const label = level === 'redline' ? 'Redline' : level === 'hot' ? 'Hot' : level === 'live' ? 'Live' : 'Steady';
  const body = routeStatus?.isValid === false
    ? routeStatus.invalidReason || 'The route is fighting the plan.'
    : activeTab === Action.DIG
      ? 'Digging turns curiosity into a wager.'
      : activeTab === Action.FLEE
        ? 'Escape attempts should feel like a held breath.'
        : `${movePath.length}/${Math.max(1, movement || 1)} movement pressure.`;

  return { score: clamped, level, label, body };
}

function buildCombo({ activeTab, movePath = [], activeInventory = {}, routeStatus, stats = {}, traitPreview = null }) {
  const pressure = statPressure(stats);
  if (traitPreview?.effect?.matched) {
    return { label: `${traitPreview.trait.label} Read`, body: traitPreview.body, tone: traitPreview.effect.warning ? 'red' : 'blue' };
  }
  if (traitPreview?.effect?.warning) {
    return { label: `${traitPreview.trait.label} Warning`, body: traitPreview.warning || traitPreview.body, tone: 'red' };
  }
  if (movePath.length > 0 && routeStatus?.isValid && activeInventory.shield) {
    return { label: 'Shielded March', body: 'The route and gear agree. The path feels earned.', tone: 'blue' };
  }
  if (movePath.length >= 2 && activeTab === Action.MOVE) {
    return { label: 'Clean Footwork', body: 'Multiple linked steps make the board feel like a phrase.', tone: 'gold' };
  }
  if (activeTab === Action.SETUP_CAMP && activeInventory.campsite) {
    return { label: 'Safe Harbor', body: 'A carried kit turns a tile into a foothold.', tone: 'green' };
  }
  if (activeTab === Action.REST && pressure.isTired) {
    return { label: 'Recovery Window', body: 'Resting while worn thin has a clear emotional payoff.', tone: 'green' };
  }
  if (activeTab === Action.HELP) {
    return { label: 'Crew Link', body: 'Helping makes another player present in your hands.', tone: 'purple' };
  }
  return { label: 'No Chain Yet', body: 'Pick, preview, and commit an action to start a sequence.', tone: 'neutral' };
}

function buildNearMiss({ risk, routeStatus, movePath = [], movement = 0, boardInput = {} }) {
  const exactlyFull = movePath.length > 0 && movePath.length === movement;
  if (routeStatus?.isValid === false) {
    return { active: true, label: 'Bad Step', body: 'The tile refuses the route. Undoing now feels physical.' };
  }
  if (exactlyFull && risk.score >= 35) {
    return { active: true, label: 'Exact Fit', body: 'Every movement pip is spent. No slack, no waste.' };
  }
  if (boardInput.invalidCount > 0) {
    return { active: true, label: 'Close Call', body: 'The cursor found the edge and snapped back.' };
  }
  if (risk.score >= 70) {
    return { active: true, label: 'Too Quiet', body: 'The plan works, but the meter does not like it.' };
  }
  return { active: false, label: 'Clean', body: 'No near miss registered.' };
}

function buildRareBeat({ location, events = [], activeTab, risk, traitPreview = null }) {
  if (traitPreview?.trait) {
    return {
      label: traitPreview.trait.label,
      body: traitPreview.body,
      tone: traitPreview.effect?.warning ? 'red' : traitPreview.effect?.matched ? 'green' : 'blue',
    };
  }
  const seed = stableIndex([location, events.length, activeTab, risk.level], 10);
  if (seed === 0 || activeTab === Action.DIG) {
    return { label: 'Lucky Find', body: 'Something catches the light before the rules know what it is.', tone: 'gold' };
  }
  if (seed === 1 || risk.level === 'redline') {
    return { label: 'Bad Omen', body: 'A quiet warning moves through the board.', tone: 'red' };
  }
  return { label: 'Small Sign', body: 'The place notices the expedition noticing it.', tone: 'blue' };
}

function buildPreview({ activeTab, movePath = [], routeStatus, risk, activeInventory = {}, traitPreview = null, aftermathMoment = null, expeditionArc = null }) {
  if (aftermathMoment) return { label: aftermathMoment.title, body: aftermathMoment.nextPrompt || aftermathMoment.summary };
  if (expeditionArc) return { label: expeditionArc.label, body: expeditionArc.directive };
  if (traitPreview?.effect?.warning) return { label: `${traitPreview.trait.label} Warning`, body: traitPreview.warning || traitPreview.body };
  if (traitPreview?.effect?.matched) return { label: `${traitPreview.trait.label} Match`, body: traitPreview.body };
  if (routeStatus?.isValid === false) {
    return { label: 'Recover', body: 'Undo the bad step and the explorer visibly settles.' };
  }
  if (activeTab === Action.MOVE) {
    return movePath.length > 0
      ? { label: 'Commit Route', body: `${movePath.length} planned step${movePath.length === 1 ? '' : 's'} with ${risk.label.toLowerCase()} tension.` }
      : { label: 'Aim First', body: 'Hovering a tile becomes a lean, then a ghost, then a step.' };
  }
  if (activeTab === Action.SETUP_CAMP) {
    return activeInventory.campsite
      ? { label: 'Make Shelter', body: 'The tile warms up and the crew gets a visible anchor.' }
      : { label: 'Missing Kit', body: 'The explorer checks empty straps instead of building.' };
  }
  if (activeTab === Action.DIG) return { label: 'Break Ground', body: 'The board answers with either a glint or a warning.' };
  if (activeTab === Action.REST) return { label: 'Stabilize', body: 'Stillness becomes recovery instead of waiting.' };
  if (activeTab === Action.HELP) return { label: 'Reach Out', body: 'A signal line makes the crew feel present.' };
  if (activeTab === Action.FLEE) return { label: 'Run For It', body: 'The submit button should feel like a flare pin.' };
  return { label: 'Hold', body: 'Doing nothing still changes the explorer posture.' };
}

function buildSoundCues({ activeTab, risk, hasSubmitted, routeStatus, combo, traitPreview = null }) {
  const cues = [];
  if (traitPreview?.trait) cues.push({ key: `trait-${traitPreview.trait.id}`, label: traitPreview.effect?.warning ? 'warning ping' : 'map ping', tone: traitPreview.effect?.warning ? 'red' : 'blue' });
  if (hasSubmitted) cues.push({ key: 'submit', label: CUE_BY_TONE.submit[0], tone: 'green' });
  if (routeStatus?.isValid === false) cues.push({ key: 'fail', label: CUE_BY_TONE.fail[0], tone: 'red' });
  if (risk.level === 'hot' || risk.level === 'redline') cues.push({ key: 'danger', label: CUE_BY_TONE.danger[0], tone: 'red' });
  if (activeTab === Action.DIG) cues.push({ key: 'discovery', label: CUE_BY_TONE.discovery[0], tone: 'gold' });
  if (activeTab === Action.SETUP_CAMP) cues.push({ key: 'camp', label: CUE_BY_TONE.camp[0], tone: 'green' });
  cues.push({ key: 'combo', label: combo.tone === 'neutral' ? CUE_BY_TONE.calm[0] : CUE_BY_TONE.near[0], tone: combo.tone });
  return cues.slice(0, 4);
}

function buildRhythm({ boardInput = {}, movePath = [], activeTab }) {
  const mode = boardInput.inputMode || 'mouse';
  const cadence = boardInput.inputCadence || 'idle';
  const beats = [
    boardInput.lastInputKind || 'wait',
    movePath.length > 0 ? `${movePath.length} step${movePath.length === 1 ? '' : 's'}` : 'no route',
    getActionMeta(activeTab).key,
  ];
  return {
    label: `${mode} / ${cadence}`,
    beats,
  };
}

function buildTurnScene({ phase, queueTelemetry = {}, location, stats = {}, activeTab, risk }) {
  const pressure = statPressure(stats);
  const phaseLabel = PROCESSING_LABELS[Number(queueTelemetry.phase ?? 0)] || phase || 'Unknown';
  const terrainMood = TERRAIN_MOODS[Tile.NONE];
  return {
    title: `${phaseLabel} at ${location || 'unknown'}`,
    body: `${getActionMeta(activeTab).label} posture, ${risk.label.toLowerCase()} risk, ${pressure.isTired ? 'tired hands' : 'steady hands'}; ${terrainMood}.`,
  };
}

function buildNamedMoment({ activeTab, location, movePath = [], risk, hasSubmitted, traitPreview = null, aftermathMoment = null, expeditionArc = null }) {
  if (aftermathMoment) {
    return { title: aftermathMoment.title, body: aftermathMoment.summary };
  }
  if (expeditionArc && ['redline', 'final-call'].includes(expeditionArc.id)) {
    return { title: expeditionArc.label, body: expeditionArc.directive };
  }
  if (traitPreview?.effect?.warning) {
    return { title: `${traitPreview.trait.label} Warning`, body: traitPreview.warning || traitPreview.body };
  }
  if (traitPreview?.effect?.matched) {
    return { title: `${traitPreview.trait.label} Play`, body: traitPreview.body };
  }
  const titles = MOMENT_TITLES[activeTab] || MOMENT_TITLES[Action.IDLE];
  const title = pick(titles, [activeTab, location, movePath.length, risk.level, hasSubmitted ? 'locked' : 'open']);
  const body = hasSubmitted
    ? 'The turn is sealed and becomes a story beat.'
    : movePath.length > 0
      ? `The planned route points toward ${movePath[movePath.length - 1]}.`
      : `${getActionMeta(activeTab).copy}`;
  return { title, body };
}

function buildBark({ activeTab, mood, location, movePath = [], risk, traitPreview = null, aftermathMoment = null, expeditionArc = null }) {
  if (aftermathMoment?.category === 'pressure-spike') return { line: 'That turn bought knowledge with pressure.', tone: 'red' };
  if (aftermathMoment?.category === 'route-save') return { line: 'The way home got clearer.', tone: 'blue' };
  if (aftermathMoment?.category === 'artifact-payoff') return { line: 'Now we have something worth carrying out.', tone: 'gold' };
  if (aftermathMoment?.category === 'crew-save') return { line: 'That kept someone in the run.', tone: 'green' };
  if (expeditionArc?.id === 'survey') return { line: 'We still do not know enough.', tone: 'blue' };
  if (expeditionArc?.id === 'greed-window') return { line: 'That payoff is starting to look expensive.', tone: 'gold' };
  if (expeditionArc?.id === 'departure-window') return { line: 'We have enough to make leaving real.', tone: 'green' };
  if (expeditionArc?.id === 'redline') return { line: 'Every delay has teeth now.', tone: 'red' };
  if (expeditionArc?.id === 'final-call') return { line: 'This is the run-defining choice.', tone: 'red' };
  if (traitPreview?.effect?.warning) {
    return { line: `${traitPreview.trait.label} makes this choice expensive.`, tone: 'red' };
  }
  if (traitPreview?.effect?.matched) {
    return { line: `${traitPreview.trait.label} is the clean read.`, tone: 'blue' };
  }
  const action = risk.level === 'redline' ? Action.FLEE : activeTab;
  const line = pick(ACTION_BARKS[action] || ACTION_BARKS[Action.IDLE], [action, mood.key, location, movePath.length, risk.level]);
  return {
    line,
    tone: mood.tone,
  };
}

function buildJournalEntries({ events = [], namedMoment, rareBeat, location, activeTab }) {
  const eventEntries = events.slice(-4).map((event, index) => ({
    id: event.key || `${event.name}-${index}`,
    title: event.name,
    body: event.args?.playerID !== undefined
      ? `P${event.args.playerID} left a mark on the chain.`
      : 'The expedition state shifted.',
    tone: event.name?.includes('Fail') || event.name?.includes('Kick') ? 'red' : 'blue',
  }));

  return [
    {
      id: `moment-${location || 'unknown'}-${activeTab}`,
      title: namedMoment.title,
      body: namedMoment.body,
      tone: 'gold',
    },
    {
      id: `rare-${rareBeat.label}-${location || 'unknown'}`,
      title: rareBeat.label,
      body: rareBeat.body,
      tone: rareBeat.tone,
    },
    ...eventEntries,
  ].slice(0, 6);
}

export function buildActionDrama(action, context = {}) {
  const activeTab = action;
  const risk = buildRisk({ ...context, activeTab });
  const preview = buildPreview({ ...context, activeTab, risk });
  const namedMoment = buildNamedMoment({ ...context, activeTab, risk, hasSubmitted: false });
  const meta = getActionMeta(activeTab);
  return {
    title: namedMoment.title,
    label: preview.label,
    body: preview.body,
    riskLabel: risk.label,
    riskScore: risk.score,
    cue: context.traitPreview?.effect?.warning ? 'warning ping' : context.traitPreview?.trait ? 'map ping' : activeTab === Action.DIG ? 'bright ping' : activeTab === Action.FLEE ? 'red tremor' : 'lock snap',
    receipt: `${meta.label} locked as "${namedMoment.title}".`,
  };
}

export function buildFunTelemetry(context = {}) {
  const {
    activeTab = Action.MOVE,
    hasSubmitted = false,
    location = '',
    movePath = [],
    events = [],
  } = context;
  const mood = buildMood(context);
  const risk = buildRisk(context);
  const combo = buildCombo(context);
  const nearMiss = buildNearMiss({ ...context, risk });
  const rareBeat = buildRareBeat({ ...context, risk });
  const preview = buildPreview({ ...context, risk });
  const rhythm = buildRhythm(context);
  const turnScene = buildTurnScene({ ...context, risk });
  const namedMoment = buildNamedMoment({ ...context, activeTab, location, movePath, risk, hasSubmitted });
  const bark = buildBark({ ...context, activeTab, mood, location, movePath, risk });
  const soundCues = buildSoundCues({ ...context, risk, combo });
  const journalEntries = buildJournalEntries({ events, namedMoment, rareBeat, location, activeTab });

  return {
    mood,
    bark,
    risk,
    combo,
    nearMiss,
    rareBeat,
    preview,
    rhythm,
    turnScene,
    namedMoment,
    soundCues,
    journalEntries,
  };
}
