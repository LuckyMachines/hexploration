// Action indices match the contract's uint8 actionIndex
export const Action = {
  IDLE: 0,
  MOVE: 1,
  SETUP_CAMP: 2,
  BREAK_DOWN_CAMP: 3,
  DIG: 4,
  REST: 5,
  HELP: 6,
  FLEE: 7,
};

export const ACTION_LABELS = {
  [Action.IDLE]: 'Idle',
  [Action.MOVE]: 'Move',
  [Action.SETUP_CAMP]: 'Setup Camp',
  [Action.BREAK_DOWN_CAMP]: 'Break Down Camp',
  [Action.DIG]: 'Dig',
  [Action.REST]: 'Rest',
  [Action.HELP]: 'Help',
  [Action.FLEE]: 'Flee',
};

// Tile types from the board
export const Tile = {
  NONE: 0,
  JUNGLE: 1,
  PLAINS: 2,
  DESERT: 3,
  MOUNTAIN: 4,
  LANDING: 5,
  RELIC: 6,
};

export const TILE_LABELS = {
  [Tile.NONE]: 'Unknown',
  [Tile.JUNGLE]: 'Jungle',
  [Tile.PLAINS]: 'Plains',
  [Tile.DESERT]: 'Desert',
  [Tile.MOUNTAIN]: 'Mountain',
  [Tile.LANDING]: 'Landing',
  [Tile.RELIC]: 'Relic',
};

export const TILE_COLORS = {
  [Tile.NONE]: '#2a3224',
  [Tile.JUNGLE]: '#3a8a50',
  [Tile.PLAINS]: '#a8b060',
  [Tile.DESERT]: '#c4964a',
  [Tile.MOUNTAIN]: '#7a8088',
  [Tile.LANDING]: '#5090c0',
  [Tile.RELIC]: '#9060c0',
};

// Processing phases from the queue
export const ProcessingPhase = {
  START: 0,
  SUBMISSION: 1,
  PROCESSING: 2,
  PLAY_THROUGH: 3,
  PROCESSED: 4,
  CLOSED: 5,
  FAILED: 6,
};

export const PROCESSING_LABELS = {
  [ProcessingPhase.START]: 'Start',
  [ProcessingPhase.SUBMISSION]: 'Submission',
  [ProcessingPhase.PROCESSING]: 'Processing',
  [ProcessingPhase.PLAY_THROUGH]: 'Play Through',
  [ProcessingPhase.PROCESSED]: 'Processed',
  [ProcessingPhase.CLOSED]: 'Closed',
  [ProcessingPhase.FAILED]: 'Failed',
};

// Stat indices
export const Stat = {
  MOVEMENT: 0,
  AGILITY: 1,
  DEXTERITY: 2,
};

export const STAT_LABELS = ['Movement', 'Agility', 'Dexterity'];

export const MAX_STAT = 5;
export const MAX_GAME_PLAYERS = 4;
export const MIN_GAME_PLAYERS = 1;

// Player colors for hex markers
export const PLAYER_COLORS = ['#e8c860', '#3a8a50', '#e88040', '#5090c0'];
export const PLAYER_LABELS = ['P1', 'P2', 'P3', 'P4'];
