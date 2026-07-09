import { ACTION_LABELS, Action } from './constants.js';

export const AFTERMATH_CATEGORIES = {
  ESCAPE_PROGRESS: 'escape-progress',
  PRESSURE_SPIKE: 'pressure-spike',
  ROUTE_SAVE: 'route-save',
  TRAIT_PAYOFF: 'trait-payoff',
  TRAIT_WARNING: 'trait-warning',
  ARTIFACT_PAYOFF: 'artifact-payoff',
  CREW_SAVE: 'crew-save',
  BAD_LUCK: 'bad-luck',
  CLEAN_TURN: 'clean-turn',
  DESPERATE_TURN: 'desperate-turn',
  SETUP_TURN: 'setup-turn',
};

const CATEGORY_COPY = {
  [AFTERMATH_CATEGORIES.ESCAPE_PROGRESS]: {
    title: 'The Route Got Shorter',
    tone: 'green',
    summary: 'The crew turned this resolution into real departure progress.',
    whyItMatters: 'Every step toward landing makes the Chart & Depart choice sharper.',
    nextPrompt: 'Check whether the departure window is open before spending another turn.',
  },
  [AFTERMATH_CATEGORIES.PRESSURE_SPIKE]: {
    title: 'The Planet Raised the Price',
    tone: 'red',
    summary: 'This turn made the next escape forecast more expensive.',
    whyItMatters: 'Pressure turns delay into lost value, crew risk, or route collapse.',
    nextPrompt: 'Use the strongest reduction action before another greedy push.',
  },
  [AFTERMATH_CATEGORIES.ROUTE_SAVE]: {
    title: 'The Way Home Cleared',
    tone: 'blue',
    summary: 'The crew bought back route stability instead of only surviving.',
    whyItMatters: 'A clearer route gives the crew agency against the next cost forecast.',
    nextPrompt: 'Decide whether to depart, move home, or use the opening for one more chart.',
  },
  [AFTERMATH_CATEGORIES.TRAIT_PAYOFF]: {
    title: 'The Board Paid Attention',
    tone: 'blue',
    summary: 'The chosen action matched the targeted tile trait.',
    whyItMatters: 'Tile traits make route choices tactical instead of merely reachable.',
    nextPrompt: 'Look for another tile that changes the next decision.',
  },
  [AFTERMATH_CATEGORIES.TRAIT_WARNING]: {
    title: 'The Tile Pushed Back',
    tone: 'red',
    summary: 'A dangerous tile trait turned the choice into a louder consequence.',
    whyItMatters: 'Ignoring board warnings can turn exploration into escape cost.',
    nextPrompt: 'Route around the warning or pick the action that reduces its cost.',
  },
  [AFTERMATH_CATEGORIES.ARTIFACT_PAYOFF]: {
    title: 'Now There Is Value to Carry',
    tone: 'gold',
    summary: 'The turn produced recovered value worth protecting.',
    whyItMatters: 'Recovered value changes the goal from charting more to getting home alive.',
    nextPrompt: 'Compare one more dig against what the escape forecast puts at risk.',
  },
  [AFTERMATH_CATEGORIES.CREW_SAVE]: {
    title: 'Someone Stayed in the Run',
    tone: 'green',
    summary: 'Recovery or help turned weakness into another chance.',
    whyItMatters: 'Crew condition decides whether delay costs a teammate.',
    nextPrompt: 'Use the breathing room to move, depart, or stabilize the next weakest explorer.',
  },
  [AFTERMATH_CATEGORIES.BAD_LUCK]: {
    title: 'The Turn Bit Back',
    tone: 'red',
    summary: 'Card or stat fallout made the next turn harder.',
    whyItMatters: 'Bad luck matters most when it changes how long the crew can stay.',
    nextPrompt: 'Recover before the next action turns the damage into departure cost.',
  },
  [AFTERMATH_CATEGORIES.CLEAN_TURN]: {
    title: 'Clean Turn',
    tone: 'green',
    summary: 'The crew gained ground without obvious fallout.',
    whyItMatters: 'Clean turns are the best invitation to chart a little farther.',
    nextPrompt: 'Spend the opening deliberately: reveal, recover value, or start home.',
  },
  [AFTERMATH_CATEGORIES.DESPERATE_TURN]: {
    title: 'Still Alive, Still Expensive',
    tone: 'orange',
    summary: 'The crew survived, but the departure price is still loud.',
    whyItMatters: 'High pressure means the next delay should have a clear reason.',
    nextPrompt: 'Pick a reduction action or leave before the forecast worsens.',
  },
  [AFTERMATH_CATEGORIES.SETUP_TURN]: {
    title: 'A Foothold Appeared',
    tone: 'blue',
    summary: 'The crew converted the tile into a better base for the next decision.',
    whyItMatters: 'Setup turns matter when they make recovery or departure more realistic.',
    nextPrompt: 'Use the foothold before pressure makes it feel late.',
  },
};

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sumStatDelta(updates = []) {
  return updates.reduce((sum, update) => (
    sum + (Array.isArray(update) ? update.reduce((inner, value) => inner + toNumber(value), 0) : 0)
  ), 0);
}

function statLossCount(updates = []) {
  return updates.reduce((sum, update) => (
    sum + (Array.isArray(update) ? update.filter((value) => toNumber(value) < 0).length : 0)
  ), 0);
}

function statGainCount(updates = []) {
  return updates.reduce((sum, update) => (
    sum + (Array.isArray(update) ? update.filter((value) => toNumber(value) > 0).length : 0)
  ), 0);
}

function inventoryItems(changes = []) {
  return changes.flatMap((change) => (Array.isArray(change) ? change.filter(Boolean) : []));
}

function gainedInventory(changes = []) {
  return changes.flatMap((change) => (Array.isArray(change) && change[0] ? [change[0]] : []));
}

function actionIds(playerActions = []) {
  return playerActions.map((item) => toNumber(item?.currentAction, -1)).filter((id) => id >= 0);
}

function actionNames(ids = []) {
  return ids.map((id) => ACTION_LABELS[id] || `Action ${id}`);
}

function hasAction(ids = [], action) {
  return ids.includes(Number(action));
}

function pressureFrom(value) {
  return toNumber(value?.pressure ?? value?.departPressure, null);
}

function escapeToneWorse(preview = null) {
  return ['artifact-risk', 'crew-risk', 'route-collapse'].includes(preview?.costType || preview?.level);
}

function makeCandidate(category, score, data = {}) {
  const copy = CATEGORY_COPY[category];
  return {
    id: `${category}-${data.players?.join('-') || 'crew'}`,
    category,
    tone: copy.tone,
    title: data.title || copy.title,
    summary: data.summary || copy.summary,
    whyItMatters: data.whyItMatters || copy.whyItMatters,
    nextPrompt: data.nextPrompt || copy.nextPrompt,
    score,
    players: data.players || [],
    actions: data.actions || [],
    statDelta: data.statDelta || 0,
    inventoryDelta: data.inventoryDelta || 0,
    pressureDelta: data.pressureDelta || 0,
    routeDelta: data.routeDelta || 0,
    trait: data.trait || null,
    card: data.card || null,
    receipts: data.receipts || [],
    escapeCost: data.escapeCost || null,
  };
}

function receipt(label, value, tone = 'neutral') {
  return { label, value, tone };
}

export function deriveTurnAftermath({
  playerActions = [],
  playerIDs = [],
  cardTypes = [],
  cardsDrawn = [],
  cardResults = [],
  inventoryChanges = [],
  statUpdates = [],
  replay = null,
  departPressure = null,
  escapeCostPreview = null,
  traitPreview = null,
  previousDepartPressure = null,
} = {}) {
  const actions = actionIds(playerActions);
  const actionLabels = actionNames(actions);
  const statDelta = sumStatDelta(statUpdates);
  const losses = statLossCount(statUpdates);
  const gains = statGainCount(statUpdates);
  const gained = gainedInventory(inventoryChanges);
  const inventory = inventoryItems(inventoryChanges);
  const pressure = pressureFrom(departPressure);
  const previousPressure = previousDepartPressure === null ? null : toNumber(previousDepartPressure, null);
  const pressureDelta = previousPressure === null || pressure === null ? 0 : pressure - previousPressure;
  const routeDelta = toNumber(departPressure?.traitRoute || departPressure?.pressureReasons?.traitRoute, 0);
  const players = playerIDs.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  const hasReplay = Boolean(replay?.steps?.length);
  const candidates = [];

  if (
    playerActions.length === 0
    && playerIDs.length === 0
    && cardsDrawn.filter(Boolean).length === 0
    && inventory.length === 0
    && statDelta === 0
    && !hasReplay
    && !departPressure
    && !escapeCostPreview
    && !traitPreview?.trait
  ) {
    return null;
  }

  if (traitPreview?.trait && traitPreview.effect?.warning) {
    candidates.push(makeCandidate(AFTERMATH_CATEGORIES.TRAIT_WARNING, 92, {
      trait: traitPreview.trait,
      pressureDelta: traitPreview.effect.pressureDelta,
      routeDelta: traitPreview.effect.routeDelta,
      actions: actionLabels,
      summary: traitPreview.warning || traitPreview.body,
      receipts: [
        receipt('Tile', traitPreview.trait.label, 'red'),
        receipt('Pressure', signed(traitPreview.effect.pressureDelta), 'red'),
        receipt('Route', signed(traitPreview.effect.routeDelta), 'red'),
      ],
    }));
  }

  if (traitPreview?.trait && traitPreview.effect?.matched) {
    candidates.push(makeCandidate(AFTERMATH_CATEGORIES.TRAIT_PAYOFF, 86, {
      trait: traitPreview.trait,
      pressureDelta: traitPreview.effect.pressureDelta,
      routeDelta: traitPreview.effect.routeDelta,
      actions: actionLabels,
      summary: traitPreview.body,
      receipts: [
        receipt('Tile', traitPreview.trait.label, 'blue'),
        receipt('Preferred', traitPreview.preferredActionLabel, 'blue'),
        receipt('Pressure', signed(traitPreview.effect.pressureDelta), traitPreview.effect.pressureDelta <= 0 ? 'green' : 'gold'),
      ],
    }));
  }

  if (pressureDelta >= 8 || escapeToneWorse(escapeCostPreview)) {
    candidates.push(makeCandidate(AFTERMATH_CATEGORIES.PRESSURE_SPIKE, 78 + Math.min(18, Math.max(0, pressureDelta)), {
      pressureDelta,
      actions: actionLabels,
      escapeCost: escapeCostPreview,
      summary: escapeCostPreview?.headline || 'Depart Pressure moved against the crew.',
      receipts: [
        receipt('Pressure', pressure === null ? 'unknown' : String(pressure), 'red'),
        receipt('Forecast', escapeCostPreview?.label || escapeCostPreview?.headline || 'Cost rising', 'red'),
      ],
    }));
  }

  if (pressureDelta <= -5 || routeDelta > 0) {
    candidates.push(makeCandidate(AFTERMATH_CATEGORIES.ROUTE_SAVE, 74 + Math.min(14, Math.abs(pressureDelta)), {
      pressureDelta,
      routeDelta,
      actions: actionLabels,
      receipts: [
        receipt('Pressure', signed(pressureDelta), 'green'),
        receipt('Route', routeDelta > 0 ? `+${routeDelta}` : 'steadier', 'blue'),
      ],
    }));
  }

  if (hasAction(actions, Action.MOVE) && departPressure && departPressure.currentDistanceToLanding !== null) {
    candidates.push(makeCandidate(AFTERMATH_CATEGORIES.ESCAPE_PROGRESS, 64, {
      actions: actionLabels,
      summary: `The route now reads ${departPressure.currentDistanceToLanding} from landing.`,
      receipts: [
        receipt('Distance', `${departPressure.currentDistanceToLanding} from landing`, 'green'),
        receipt('Readiness', departPressure.readiness?.label || 'Checking departure', departPressure.readiness?.canFlee ? 'green' : 'gold'),
      ],
    }));
  }

  if (gained.length > 0 || hasAction(actions, Action.DIG)) {
    const artifactLike = gained.find((item) => /artifact|relic|cache|value|orb|idol|shard/i.test(String(item))) || gained[0];
    if (artifactLike) {
      candidates.push(makeCandidate(AFTERMATH_CATEGORIES.ARTIFACT_PAYOFF, 88, {
        inventoryDelta: gained.length,
        actions: actionLabels,
        summary: `${artifactLike} is now value the crew has to carry out.`,
        receipts: [
          receipt('Gained', artifactLike, 'gold'),
          receipt('Forecast', escapeCostPreview?.headline || 'Protect the value', 'gold'),
        ],
      }));
    }
  }

  if (hasAction(actions, Action.REST) || hasAction(actions, Action.HELP) || gains >= 2) {
    candidates.push(makeCandidate(AFTERMATH_CATEGORIES.CREW_SAVE, 68 + Math.min(12, gains * 3), {
      statDelta,
      actions: actionLabels,
      summary: 'The crew recovered enough that the next choice has room to matter.',
      receipts: [
        receipt('Recovered', `${gains} stat gain${gains === 1 ? '' : 's'}`, 'green'),
        receipt('Action', actionLabels.join(' / ') || 'Recovery', 'green'),
      ],
    }));
  }

  if (losses > 0 || statDelta <= -3) {
    candidates.push(makeCandidate(AFTERMATH_CATEGORIES.BAD_LUCK, 62 + Math.min(16, losses * 4), {
      statDelta,
      actions: actionLabels,
      card: cardsDrawn.find(Boolean) || cardTypes.find(Boolean) || null,
      summary: 'The turn left marks on the crew before the next decision.',
      receipts: [
        receipt('Hurt', `${losses} stat loss${losses === 1 ? '' : 'es'}`, 'red'),
        receipt('Card', cardsDrawn.find(Boolean) || cardResults.find(Boolean) || 'Fallout', 'red'),
      ],
    }));
  }

  if (hasAction(actions, Action.SETUP_CAMP) || hasAction(actions, Action.BREAK_DOWN_CAMP)) {
    candidates.push(makeCandidate(AFTERMATH_CATEGORIES.SETUP_TURN, 54, {
      actions: actionLabels,
      summary: 'The crew spent the turn changing its foothold on the board.',
      receipts: [receipt('Action', actionLabels.join(' / '), 'blue')],
    }));
  }

  if (pressure !== null && pressure >= 75) {
    candidates.push(makeCandidate(AFTERMATH_CATEGORIES.DESPERATE_TURN, 58 + Math.min(22, pressure - 75), {
      pressureDelta,
      escapeCost: escapeCostPreview,
      summary: `${departPressure?.band?.label || 'High pressure'} ${pressure}: staying another turn needs a reason.`,
      receipts: [
        receipt('Pressure', String(pressure), 'red'),
        receipt('Depart', departPressure?.readiness?.label || escapeCostPreview?.headline || 'Urgent', 'red'),
      ],
    }));
  }

  if (statDelta >= 0 && losses === 0 && (gained.length > 0 || pressureDelta <= 0 || hasAction(actions, Action.MOVE))) {
    candidates.push(makeCandidate(AFTERMATH_CATEGORIES.CLEAN_TURN, 50 + Math.min(16, gains + gained.length * 4), {
      statDelta,
      inventoryDelta: gained.length,
      pressureDelta,
      actions: actionLabels,
      receipts: [
        receipt('Stats', statDelta >= 0 ? `+${statDelta}` : String(statDelta), 'green'),
        receipt('Inventory', gained.length ? `${gained.length} gain${gained.length === 1 ? '' : 's'}` : 'steady', 'gold'),
      ],
    }));
  }

  const selected = candidates.sort((a, b) => b.score - a.score)[0] || makeCandidate(AFTERMATH_CATEGORIES.CLEAN_TURN, 1, {
    actions: actionLabels,
    receipts: hasReplay ? [receipt('Replay', `${replay.steps.length} chain step${replay.steps.length === 1 ? '' : 's'}`, 'blue')] : [],
  });

  return {
    ...selected,
    receipts: selected.receipts.slice(0, 3),
    allCandidates: candidates.map(({ allCandidates, ...candidate }) => candidate).slice(0, 6),
  };
}

export function aftermathToneClass(tone = 'neutral') {
  return {
    red: 'border-signal-red/45 bg-signal-red/10 text-signal-red',
    orange: 'border-desert/45 bg-desert/10 text-desert',
    gold: 'border-compass/45 bg-compass/10 text-compass-bright',
    green: 'border-oxide-green/40 bg-oxide-green/10 text-oxide-green',
    blue: 'border-blueprint/40 bg-blueprint/10 text-blueprint',
    neutral: 'border-exp-border bg-exp-dark/35 text-exp-text-dim',
  }[tone] || 'border-exp-border bg-exp-dark/35 text-exp-text-dim';
}

export function actionAftermathCopy(action, context = {}) {
  const label = ACTION_LABELS[Number(action)] || 'Action';
  const preview = context.escapeCostPreview;
  if (Number(action) === Action.MOVE) return preview?.costType === 'route-collapse' ? 'Move is now route triage.' : 'Move decides whether the map stays usable.';
  if (Number(action) === Action.DIG) return preview?.headline ? `Dig must answer ${preview.headline}.` : 'Dig turns curiosity into carried risk.';
  if (Number(action) === Action.REST) return 'Rest buys one more meaningful decision.';
  if (Number(action) === Action.HELP) return 'Help keeps a teammate from becoming the cost.';
  if (Number(action) === Action.FLEE) return 'Flee turns the whole run into an outcome.';
  if (Number(action) === Action.SETUP_CAMP) return 'Camp creates a foothold for the next turn.';
  return `${label} changed the board state.`;
}

export function cardAftermathTone({ cardResult = '', statUpdate = [], inventoryChange = [] } = {}) {
  const statDelta = sumStatDelta([statUpdate]);
  const gained = gainedInventory([inventoryChange]).length;
  const result = String(cardResult || '').toLowerCase();
  if (statDelta < 0 || /lost|damage|hurt|fail|wound|collapse/.test(result)) return 'red';
  if (gained > 0 || /gain|found|recover|success|artifact|relic/.test(result)) return 'gold';
  if (statDelta > 0 || /rest|help|heal|boost/.test(result)) return 'green';
  return 'blue';
}

function signed(value = 0) {
  const number = toNumber(value);
  return number > 0 ? `+${number}` : String(number);
}
