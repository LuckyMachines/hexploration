import { Action } from './constants';

export const ACTION_META = {
  [Action.IDLE]: {
    key: 'idle',
    label: 'Idle',
    color: '#6a7560',
    tone: 'neutral',
    tool: 'watch',
    stance: 'listening',
    copy: 'Hold position and let the expedition clock advance.',
  },
  [Action.MOVE]: {
    key: 'move',
    label: 'Move',
    color: '#e8c860',
    tone: 'gold',
    tool: 'compass',
    stance: 'route',
    copy: 'Trace a reachable path that charts useful ground without losing the way home.',
  },
  [Action.SETUP_CAMP]: {
    key: 'camp',
    label: 'Camp',
    color: '#40a080',
    tone: 'green',
    tool: 'stakes',
    stance: 'build',
    copy: 'Set up a campsite at the current tile when a kit is available.',
  },
  [Action.BREAK_DOWN_CAMP]: {
    key: 'pack',
    label: 'Pack Camp',
    color: '#40a080',
    tone: 'green',
    tool: 'pack',
    stance: 'pack',
    copy: 'Break down the current campsite and reclaim expedition gear.',
  },
  [Action.DIG]: {
    key: 'dig',
    label: 'Dig',
    color: '#c4964a',
    tone: 'gold',
    tool: 'spade',
    stance: 'dig',
    copy: 'Search the current tile for artifacts, relics, or trouble.',
  },
  [Action.REST]: {
    key: 'rest',
    label: 'Rest',
    color: '#5090c0',
    tone: 'blue',
    tool: 'breath',
    stance: 'recover',
    copy: 'Recover one selected stat and stabilize the explorer.',
  },
  [Action.HELP]: {
    key: 'help',
    label: 'Help',
    color: '#9060c0',
    tone: 'purple',
    tool: 'signal',
    stance: 'aid',
    copy: 'Support another explorer with a selected stat.',
  },
  [Action.FLEE]: {
    key: 'flee',
    label: 'Flee',
    color: '#d44040',
    tone: 'red',
    tool: 'flare',
    stance: 'escape',
    copy: 'Depart from the landing zone with enough recovered value.',
  },
};

export function getActionMeta(action) {
  return ACTION_META[action] || ACTION_META[Action.MOVE];
}

export function normalizeActionName(action) {
  return getActionMeta(action).label;
}
