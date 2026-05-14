import { Action, ACTION_LABELS, STAT_LABELS, Tile } from './constants';
import { getActionMeta } from './actionMeta';
import { statDelta } from './formatting';

const TERRAIN_DETAIL = {
  [Tile.NONE]: {
    name: 'Uncharted',
    mood: 'Fogged and unreadable',
    clue: 'Unknown odds until the board opens it.',
  },
  [Tile.JUNGLE]: {
    name: 'Jungle',
    mood: 'Dense, noisy, and easy to lose rhythm in',
    clue: 'Movement feels costly, but discoveries can hide under cover.',
  },
  [Tile.PLAINS]: {
    name: 'Plains',
    mood: 'Open ground with nowhere to hide',
    clue: 'Good for route clarity and reading crew positions.',
  },
  [Tile.DESERT]: {
    name: 'Desert',
    mood: 'Heat pressure and long sight lines',
    clue: 'Stat pressure should be legible here.',
  },
  [Tile.MOUNTAIN]: {
    name: 'Mountain',
    mood: 'Hard footing and sharp echoes',
    clue: 'Routes should feel deliberate and expensive.',
  },
  [Tile.LANDING]: {
    name: 'Landing',
    mood: 'The promise of escape',
    clue: 'Flee stakes should be clearest here.',
  },
  [Tile.RELIC]: {
    name: 'Relic',
    mood: 'The board feels like it is listening back',
    clue: 'Digging and artifact drama should peak here.',
  },
};

const ACTION_DETAILS = {
  [Action.IDLE]: {
    effect: 'Hold position while the expedition clock advances.',
    risk: 'Lost tempo. This should still feel like a tense posture, not nothing.',
    requirement: 'No input or no valid action chosen.',
    blocked: 'Idle is only blocked by turn lock, wallet, or transaction state.',
  },
  [Action.MOVE]: {
    effect: 'Spend movement to commit a route and potentially reveal or reposition.',
    risk: 'Bad routing wastes the turn; full-budget routes should feel strained.',
    requirement: 'At least one reachable step, within movement budget.',
    blocked: 'Movement needs a selected route and a valid adjacent path.',
  },
  [Action.SETUP_CAMP]: {
    effect: 'Turn a tile into a recovery anchor for the expedition.',
    risk: 'Consumes the action tempo and depends on kit availability.',
    requirement: 'A campsite kit in active inventory.',
    blocked: 'No campsite kit is currently available.',
  },
  [Action.BREAK_DOWN_CAMP]: {
    effect: 'Recover camp gear and make the position mobile again.',
    risk: 'Trading safety for tempo.',
    requirement: 'An active campsite at the current position.',
    blocked: 'No campsite is available to pack here.',
  },
  [Action.DIG]: {
    effect: 'Search the current tile for artifacts, cards, or trouble.',
    risk: 'Dexterity pressure and event variance should be felt immediately.',
    requirement: 'A turn action and a tile worth searching.',
    blocked: 'Digging is only blocked by global turn or transaction state.',
  },
  [Action.REST]: {
    effect: 'Recover one selected stat and make exhaustion readable.',
    risk: 'Safer body, slower expedition.',
    requirement: 'Choose which stat to restore.',
    blocked: 'Rest is only blocked by global turn or transaction state.',
  },
  [Action.HELP]: {
    effect: 'Spend your action to strengthen another explorer.',
    risk: 'Social payoff with less personal tempo.',
    requirement: 'A target player and stat.',
    blocked: 'Help needs a valid target and stat option.',
  },
  [Action.FLEE]: {
    effect: 'Attempt to end the run from the landing zone.',
    risk: 'The highest-stakes click; success should feel final.',
    requirement: 'Landing position and enough recovered artifacts.',
    blocked: 'Escape needs the right place and enough discoveries.',
  },
};

const STRATEGY_DETAIL = {
  balanced: 'Checks whether a normal player discovers, recovers, and moves without one action dominating.',
  risky: 'Checks whether pressure creates drama instead of immediate collapse.',
  dig: 'Checks whether artifact hunting has enough payoff and feedback.',
  move: 'Checks whether exploration is attractive and routes produce board change.',
  rest: 'Checks whether recovery is useful without swallowing the whole game.',
  idle: 'Checks whether doing nothing is detected as a design smell.',
};

const SCENARIO_DETAIL = {
  'solo-balanced': 'Can one normal player experience a readable arc?',
  'solo-risky': 'Does risky play create tension before it creates failure?',
  'solo-dig-rush': 'Does digging produce artifact drama quickly enough?',
  'solo-escape-rush': 'Does the escape loop become legible from the landing plan?',
  '4p-cautious': 'Do multiplayer recovery choices keep the crew alive?',
  '4p-chaos': 'Does four-player volatility produce useful drama instead of noise?',
  benchmark: 'Do the main strategies expose balance, boredom, and exploit patterns?',
};

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function conditionForStats(stats = {}) {
  const values = [
    toNumber(stats.movement),
    toNumber(stats.agility),
    toNumber(stats.dexterity),
  ];
  const min = Math.min(...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (min <= 0) return { label: 'Collapsing', tone: 'red', detail: 'One stat has hit zero. This is an emergency state.' };
  if (min <= 1) return { label: 'Shaken', tone: 'red', detail: 'At least one stat is nearly gone.' };
  if (total <= 7) return { label: 'Winded', tone: 'gold', detail: 'The explorer can act, but every choice has pressure.' };
  if (total >= 12) return { label: 'Steady', tone: 'green', detail: 'Stats support confident planning.' };
  return { label: 'Alert', tone: 'blue', detail: 'Stable enough to choose, pressured enough to care.' };
}

export function statDetail(value) {
  const number = toNumber(value);
  if (number <= 0) return 'empty';
  if (number <= 1) return 'critical';
  if (number <= 2) return 'strained';
  if (number <= 3) return 'ready';
  return 'strong';
}

export function getActionDetail(action) {
  return ACTION_DETAILS[action] || ACTION_DETAILS[Action.IDLE];
}

export function getActionStake(action, context = {}) {
  const label = ACTION_LABELS[action] || getActionMeta(action).label;
  const details = getActionDetail(action);
  const routePressure = context.movement > 0 ? (context.movePath?.length || 0) / context.movement : 0;
  const condition = conditionForStats(context.stats);
  const danger = condition.tone === 'red' || routePressure >= 1 || action === Action.FLEE;
  const tone = danger ? 'red' : routePressure >= 0.65 || action === Action.DIG ? 'gold' : 'blue';
  return {
    label,
    tone,
    effect: details.effect,
    risk: details.risk,
    requirement: details.requirement,
    band: danger ? 'dangerous' : tone === 'gold' ? 'strained' : 'safe',
  };
}

export function getBlockedDetail(action, reason) {
  if (!reason) return '';
  const details = getActionDetail(action);
  return `${reason} ${details.blocked}`;
}

export function tilePersona(tile = Tile.NONE, alias = '') {
  const details = TERRAIN_DETAIL[tile] || TERRAIN_DETAIL[Tile.NONE];
  return {
    ...details,
    alias: alias || 'unknown',
    title: `${details.name} ${alias || 'tile'}`,
  };
}

export function summarizeStatUpdates(statUpdate = []) {
  if (!statUpdate || statUpdate.length < 3) return [];
  return statUpdate.map((value, index) => ({
    label: STAT_LABELS[index],
    value: toNumber(value),
    delta: statDelta(value),
    condition: statDetail(value),
  })).filter((item) => item.value !== 0);
}

export function summarizeInventoryChange(inventoryChange = []) {
  if (!inventoryChange || inventoryChange.length === 0) return [];
  return inventoryChange
    .filter((item) => item && item !== '')
    .map((item, index) => ({
      item,
      tone: index === 0 ? 'gain' : index === 1 ? 'loss' : 'note',
      label: index === 0 ? 'Gained' : index === 1 ? 'Lost' : 'Note',
    }));
}

export function cardOutcomeDetail({ cardType, cardDrawn, cardResult, statUpdate, inventoryChange } = {}) {
  const stats = summarizeStatUpdates(statUpdate);
  const inventory = summarizeInventoryChange(inventoryChange);
  const parts = [];
  if (cardType) parts.push(`${cardType} deck`);
  if (cardDrawn) parts.push(cardDrawn);
  if (stats.length > 0) parts.push(`${stats.length} stat delta${stats.length === 1 ? '' : 's'}`);
  if (inventory.length > 0) parts.push(`${inventory.length} inventory note${inventory.length === 1 ? '' : 's'}`);
  return {
    headline: parts.join(' / ') || 'Card outcome',
    body: cardResult || 'The card resolved without a visible text result.',
  };
}

export function getScenarioQuestion(name) {
  return SCENARIO_DETAIL[name] || 'What design question should this scenario answer?';
}

export function getStrategyQuestion(name) {
  return STRATEGY_DETAIL[name] || 'Custom strategy: inspect action mix, pressure, and stalled turns.';
}

export function diagnoseEndState(summary = {}) {
  const reasons = summary.failureReasons || [];
  if (summary.gameOver && summary.totalArtifacts > 0) return 'Run ended with artifacts recovered.';
  if (reasons.length > 0) return reasons.join(' / ');
  if ((summary.boringTurns || []).length > 0) return 'The run still has flat turns that need sharper feedback.';
  if (summary.invalidAttempts > 0) return 'Some attempted actions were invalid; improve affordances or strategy rules.';
  return 'No major failure reason surfaced yet.';
}
